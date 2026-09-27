import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@repo/db";
import type { Prisma } from "@prisma/client";
import { sendAlimtalkSafe, TEMPLATE } from "../../../lib/notification";
import { pushDuePrices } from "../../../lib/effective-price";
import { decryptBillingKey } from "../../../lib/billing-crypto";
import { pickAddressForUser } from "../../../lib/address-resolve";
import { holdFromStatus } from "../../../lib/geo";
import { billingDateFor, nextCycleWindow, previewCycle, type CycleItem } from "../../../lib/subscription-cycle";
import type { SlotMap, WeekdaySlotMap } from "../../../lib/auto-assign";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY ?? "";
const MAX_RETRY = 3;
const DAY = 86400000;

/**
 * 자동 갱신 결제 (Vercel Cron, vercel.json 의 시각은 UTC)
 *
 * 롤링 주기: 마지막 결제 주기 endDate 부터 cycleWeeks 주. 금액 = 그 주기 배송일 × 선택 상품가 − 크레딧.
 *
 * 이중 청구를 막는 세 겹 (2026-09-28 점검 후):
 *  1) 선점 — 루프 시작에서 nextBillingDate 를 내일로 먼저 옮긴다(조건부 update). 같은 구독을 두 실행이 동시에 잡지 못한다
 *  2) 앵커 — 토스를 부르기 전에 PENDING 주문·주기·선택분을 먼저 만들고, 그 주문번호를 토스 orderId + Idempotency-Key 로 쓴다
 *  3) 복구 — 토스는 결제됐는데 DB 마무리가 실패한 경우, 다음 실행이 PENDING 갱신 주문을 토스에서 조회해 새 청구 없이 마무리한다
 * 결제 실패는 Payment(FAILED) 로 남겨 7일 내 3회면 구독을 PAUSED 로 돌린다.
 */
export async function POST(request: Request) {
  // 시크릿이 비어 있으면 열리는 게 아니라 닫힌다 (fail-closed)
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    await pushDuePrices(now);

    const subscriptions = await prisma.subscription.findMany({
      where: { status: "ACTIVE", autoRenew: true, billingKey: { not: null }, nextBillingDate: { lte: now } },
      include: { user: true },
    });

    let charged = 0, failed = 0, recovered = 0;
    const results: { subId: string; status: string; error?: string }[] = [];

    for (const sub of subscriptions) {
      // 1) 선점 — 실패하면 내일 이 값(now+1일)으로 다시 잡힌다
      const claim = await prisma.subscription.updateMany({
        where: { id: sub.id, status: "ACTIVE", nextBillingDate: { lte: now } },
        data: { nextBillingDate: new Date(now.getTime() + DAY) },
      });
      if (claim.count === 0) {
        results.push({ subId: sub.id, status: "skipped", error: "다른 실행이 처리 중" });
        continue;
      }

      try {
        // 3) 복구 — 이전 실행이 남긴 PENDING 갱신 주문이 토스에서 결제 완료면 새 청구 없이 마무리
        const pending = await findPendingRenewal(sub.id);
        if (pending) {
          const paid = await tossLookupByOrderId(pending.order.orderNo);
          if (paid?.status === "DONE") {
            await finalizeRenewal({ sub, order: pending.order, period: pending.period, paymentData: paid, now });
            recovered++;
            results.push({ subId: sub.id, status: "recovered" });
            continue;
          }
        }

        const { startDate, endDate } = await nextCycleWindow(sub);
        const slots = (sub.slots as SlotMap | null) ?? { salad: sub.itemsPerDelivery };
        const weekdaySlots = sub.weekdaySlots as WeekdaySlotMap | null;
        const preview = await previewCycle({ subscriptionId: sub.id, slots, weekdaySlots, startDate, endDate });

        if (preview.items.length === 0) {
          // 배송 캘린더가 아직 없으면 내일 다시 (선점에서 이미 하루 미뤘다)
          Sentry.captureMessage("갱신 결제 보류: 다음 주기 배송일 없음", { level: "warning", tags: { area: "subscription", phase: "renewal-deferred" }, extra: { subId: sub.id, startDate, endDate } });
          results.push({ subId: sub.id, status: "deferred", error: "다음 주기 배송일 없음" });
          continue;
        }

        const credit = Math.min(sub.creditBalance, preview.amount);
        const amount = preview.amount - credit;
        const firstDate = preview.items[0]!.deliveryDate;

        // 배송지: 구독 고정 배송지 → 기본 배송지
        const addr = await pickAddressForUser(sub.userId, sub.addressId);
        const hold = addr ? holdFromStatus(addr.areaStatus, addr.distanceKm) : { deliveryHold: true, deliveryHoldReason: "배송지 없음" };

        // 2) 앵커 — PENDING 주문·주기·선택분을 토스 호출 전에 확정 (이전 실패 주문이 있으면 재사용)
        const orderNo = renewalOrderNo(now);
        const { order, period } = await prepareRenewal({
          sub, pending, orderNo, amount, credit, firstDate, startDate, endDate, items: preview.items,
          addressId: addr?.id ?? null, hold,
        });

        // 청구
        let paymentData: TossPaymentData = {};
        if (amount > 0) {
          const r = await tossBillingCharge({
            billingKeyEncrypted: sub.billingKey!,
            customerKey: sub.userId,
            amount,
            orderNo,
            orderName: `W2O ${sub.cycleWeeks}주 구독 자동갱신`,
          });
          if (!r.ok) {
            failed++;
            await recordFailure({ sub, order, period, amount, raw: r.data, now });
            if (sub.user.phone) {
              await sendAlimtalkSafe({ userId: sub.user.id, to: sub.user.phone, templateCode: TEMPLATE.SUB_RENEWAL_FAILED, variables: { 고객명: sub.user.name } });
            }
            results.push({ subId: sub.id, status: "failed", error: r.data.message ?? r.data.code });
            continue;
          }
          paymentData = r.data;
        }

        // 마무리 — 한 트랜잭션
        await finalizeRenewal({ sub, order, period, paymentData, now });

        if (sub.user.phone) {
          await sendAlimtalkSafe({
            userId: sub.user.id,
            to: sub.user.phone,
            templateCode: TEMPLATE.SUB_RENEWED,
            variables: { 고객명: sub.user.name, 금액: amount.toLocaleString(), 기간: `${sub.cycleWeeks}주`, 배송횟수: String(preview.deliveryDates.length) },
          });
        }

        charged++;
        results.push({ subId: sub.id, status: amount > 0 ? "charged" : "credited" });
      } catch (err) {
        failed++;
        results.push({ subId: sub.id, status: "error", error: err instanceof Error ? err.message : "unknown" });
        Sentry.captureException(err, { level: "error", tags: { area: "subscription", phase: "renewal-charge" }, extra: { subId: sub.id, userId: sub.userId } });
      }
    }

    return NextResponse.json({ success: true, total: subscriptions.length, charged, failed, recovered, results, timestamp: now.toISOString() });
  } catch (err) {
    console.error("Cron renewal-charge error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// Vercel Cron 은 GET 으로 호출한다 (인증은 POST 와 동일)
export async function GET(request: Request) {
  return POST(request);
}

// ───────────────────────────── helpers ─────────────────────────────

type TossPaymentData = { paymentKey?: string; method?: string; receipt?: { url?: string }; status?: string; message?: string; code?: string };
type SubRow = Prisma.SubscriptionGetPayload<{ include: { user: true } }>;
type OrderRow = Prisma.OrderGetPayload<{ select: { id: true; orderNo: true; totalAmount: true; discountAmount: true; deliveryDate: true } }>;
type PeriodRow = Prisma.SubscriptionPeriodGetPayload<{ select: { id: true; endDate: true } }>;

const ORDER_SELECT = { id: true, orderNo: true, totalAmount: true, discountAmount: true, deliveryDate: true } as const;
const PERIOD_SELECT = { id: true, endDate: true } as const;

/** 갱신 주문번호 — "-R" 표식으로 첫 결제 주문과 구분한다 */
function renewalOrderNo(now: Date): string {
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `W2O-${ymd}-R${rand}`;
}

function tossAuth() {
  return `Basic ${Buffer.from(TOSS_SECRET_KEY + ":").toString("base64")}`;
}

async function tossBillingCharge(p: { billingKeyEncrypted: string; customerKey: string; amount: number; orderNo: string; orderName: string }):
  Promise<{ ok: true; data: TossPaymentData } | { ok: false; data: TossPaymentData }> {
  const plainBillingKey = decryptBillingKey(p.billingKeyEncrypted);
  const res = await fetch(`https://api.tosspayments.com/v1/billing/${plainBillingKey}`, {
    method: "POST",
    headers: {
      Authorization: tossAuth(),
      "Content-Type": "application/json",
      // 같은 주문번호로 두 번 부르면 토스가 두 번째를 첫 응답으로 돌려준다 (네트워크 재시도 안전)
      "Idempotency-Key": p.orderNo,
    },
    body: JSON.stringify({ customerKey: p.customerKey, amount: p.amount, orderId: p.orderNo, orderName: p.orderName }),
  });
  const data = (await res.json().catch(() => ({}))) as TossPaymentData;
  return res.ok ? { ok: true, data } : { ok: false, data };
}

/** 주문번호로 토스 결제 조회 — 없으면 null */
async function tossLookupByOrderId(orderNo: string): Promise<TossPaymentData | null> {
  const res = await fetch(`https://api.tosspayments.com/v1/payments/orders/${encodeURIComponent(orderNo)}`, {
    headers: { Authorization: tossAuth() },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as TossPaymentData | null;
}

/** 이전 실행이 남긴 PENDING 갱신 주문(+주기) */
async function findPendingRenewal(subscriptionId: string): Promise<{ order: OrderRow; period: PeriodRow } | null> {
  const order = await prisma.order.findFirst({
    where: { subscriptionId, type: "SUBSCRIPTION", status: "PENDING", orderNo: { contains: "-R" } },
    orderBy: { createdAt: "desc" },
    select: ORDER_SELECT,
  });
  if (!order) return null;
  const period = await prisma.subscriptionPeriod.findFirst({ where: { orderId: order.id, status: "PENDING" }, select: PERIOD_SELECT });
  return period ? { order, period } : null;
}

/** PENDING 주문·주기·선택분 확정. 이전 실패 주문이 있으면 그 행을 재사용해 품목·금액만 현재 값으로 갱신 */
async function prepareRenewal(p: {
  sub: SubRow;
  pending: { order: OrderRow; period: PeriodRow } | null;
  orderNo: string;
  amount: number;
  credit: number;
  firstDate: Date;
  startDate: Date;
  endDate: Date;
  items: CycleItem[];
  addressId: string | null;
  hold: { deliveryHold: boolean; deliveryHoldReason: string | null };
}): Promise<{ order: OrderRow; period: PeriodRow }> {
  const { sub, pending, orderNo, amount, credit, firstDate, startDate, endDate, items, addressId, hold } = p;
  const orderItems = items.map((it) => ({ productId: it.productId, quantity: it.quantity, unitPrice: it.unitPrice, totalPrice: it.unitPrice * it.quantity }));
  const periodBase = {
    year: startDate.getUTCFullYear(),
    month: startDate.getUTCMonth() + 1,
    startDate,
    endDate,
    weeks: sub.cycleWeeks,
    status: "PENDING" as const,
    totalAmount: amount,
  };

  return prisma.$transaction(async (tx) => {
    let order: OrderRow;
    let period: PeriodRow;

    if (pending) {
      await tx.orderItem.deleteMany({ where: { orderId: pending.order.id } });
      await tx.subscriptionSelection.deleteMany({ where: { subscriptionPeriodId: pending.period.id } });
      order = await tx.order.update({
        where: { id: pending.order.id },
        data: { orderNo, totalAmount: amount, discountAmount: credit, deliveryDate: firstDate, addressId, ...hold, items: { create: orderItems } },
        select: ORDER_SELECT,
      });
      period = await tx.subscriptionPeriod.update({ where: { id: pending.period.id }, data: periodBase, select: PERIOD_SELECT });
    } else {
      order = await tx.order.create({
        data: {
          orderNo,
          userId: sub.userId,
          addressId,
          ...hold,
          type: "SUBSCRIPTION",
          status: "PENDING",
          totalAmount: amount,
          discountAmount: credit, // 크레딧 차감분 — 복구 경로에서 creditBalance 정산에 쓴다
          deliveryFee: 0,
          subscriptionId: sub.id,
          deliveryDate: firstDate,
          items: { create: orderItems },
        },
        select: ORDER_SELECT,
      });
      // 다음 배송 미리보기(/api/subscribe/next)가 같은 창으로 먼저 만든 PENDING 주기가 있으면 그 행을 쓴다
      const existing = await tx.subscriptionPeriod.findFirst({ where: { subscriptionId: sub.id, status: "PENDING", startDate }, select: { id: true } });
      if (existing) {
        await tx.subscriptionSelection.deleteMany({ where: { subscriptionPeriodId: existing.id } });
        period = await tx.subscriptionPeriod.update({ where: { id: existing.id }, data: { ...periodBase, orderId: order.id }, select: PERIOD_SELECT });
      } else {
        period = await tx.subscriptionPeriod.create({ data: { subscriptionId: sub.id, orderId: order.id, ...periodBase }, select: PERIOD_SELECT });
      }
    }

    await tx.subscriptionSelection.createMany({
      data: items.map((it) => ({ subscriptionPeriodId: period.id, deliveryDate: it.deliveryDate, productId: it.productId, quantity: it.quantity, unitPrice: it.unitPrice })),
    });
    return { order, period };
  });
}

/** 결제 실패 기록. 7일 내 3회면 구독 PAUSED + 앵커 주문·주기 정리 */
async function recordFailure(p: { sub: SubRow; order: OrderRow; period: PeriodRow; amount: number; raw: TossPaymentData; now: Date }) {
  const { sub, order, period, amount, raw, now } = p;
  await prisma.payment.create({
    data: { orderId: order.id, amount, status: "FAILED", billingKey: sub.billingKey, rawResponse: JSON.stringify(raw) },
  });
  const failCount = await prisma.payment.count({
    where: { order: { subscriptionId: sub.id }, status: "FAILED", createdAt: { gte: new Date(now.getTime() - 7 * DAY) } },
  });
  if (failCount >= MAX_RETRY) {
    await prisma.$transaction([
      prisma.subscription.update({ where: { id: sub.id }, data: { status: "PAUSED", pausedAt: now } }),
      prisma.order.update({ where: { id: order.id }, data: { status: "FAILED" } }),
      prisma.subscriptionSelection.deleteMany({ where: { subscriptionPeriodId: period.id } }),
      prisma.subscriptionPeriod.update({ where: { id: period.id }, data: { status: "CANCELLED" } }),
    ]);
    Sentry.captureMessage("구독 자동 갱신 3회 실패 → 일시정지", { level: "warning", tags: { area: "subscription", phase: "renewal-paused" }, extra: { subId: sub.id, userId: sub.userId } });
  }
}

/** 토스 결제 성공(또는 조회로 확인) 후 DB 마무리 — 한 트랜잭션 */
async function finalizeRenewal(p: { sub: SubRow; order: OrderRow; period: PeriodRow; paymentData: TossPaymentData; now: Date }) {
  const { sub, order, period, paymentData, now } = p;
  const amount = order.totalAmount;
  const credit = order.discountAmount;
  const firstDate = order.deliveryDate ?? now;
  const endDate = period.endDate ?? new Date(now.getTime() + sub.cycleWeeks * 7 * DAY);

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: "PAID", paymentKey: paymentData.paymentKey ?? null, paidAt: now },
    });
    if (amount > 0) {
      await tx.payment.create({
        data: {
          orderId: order.id,
          paymentKey: paymentData.paymentKey ?? null,
          method: paymentData.method ?? null,
          amount,
          status: "DONE",
          billingKey: sub.billingKey,
          receiptUrl: paymentData.receipt?.url ?? null,
          rawResponse: JSON.stringify(paymentData),
        },
      });
    }
    await tx.subscriptionPeriod.update({ where: { id: period.id }, data: { status: "PAID", paidAt: now, totalAmount: amount } });
    await tx.subscription.update({
      where: { id: sub.id },
      data: {
        price: amount,
        creditBalance: { decrement: credit },
        nextBillingDate: billingDateFor(endDate),
        nextDeliveryDate: firstDate,
        renewalNotifiedAt: null,
      },
    });
  });
}
