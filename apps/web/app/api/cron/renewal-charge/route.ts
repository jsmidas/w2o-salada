import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@repo/db";
import { sendAlimtalkSafe, TEMPLATE } from "../../../lib/notification";
import { pushDuePrices } from "../../../lib/effective-price";
import { decryptBillingKey } from "../../../lib/billing-crypto";
import { pickAddressForUser } from "../../../lib/address-resolve";
import { holdFromStatus } from "../../../lib/geo";
import { billingDateFor, nextCycleWindow, previewCycle } from "../../../lib/subscription-cycle";
import type { SlotMap, WeekdaySlotMap } from "../../../lib/auto-assign";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY ?? "";
const MAX_RETRY = 3;

/**
 * POST: 자동 갱신 결제 (매일 06:00)
 * 롤링 주기: 마지막 주기 endDate 부터 cycleWeeks 주. 금액 = 그 주기 배송일 × 선택 상품가 − 크레딧.
 * 성공하면 월 결제 주문(SUBSCRIPTION) + 주기(PAID) + 배송일별 선택을 만들고 다음 결제일을 주기 종료 이틀 전으로 옮긴다.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    await pushDuePrices(now);

    const subscriptions = await prisma.subscription.findMany({
      where: { status: "ACTIVE", autoRenew: true, billingKey: { not: null }, nextBillingDate: { lte: now } },
      include: { user: true },
    });

    let charged = 0, failed = 0;
    const results: { subId: string; status: string; error?: string }[] = [];

    for (const sub of subscriptions) {
      try {
        const { startDate, endDate } = await nextCycleWindow(sub);
        const slots = (sub.slots as SlotMap | null) ?? { salad: sub.itemsPerDelivery };
        const weekdaySlots = sub.weekdaySlots as WeekdaySlotMap | null;
        const preview = await previewCycle({ subscriptionId: sub.id, slots, weekdaySlots, startDate, endDate });

        if (preview.items.length === 0) {
          // 배송 캘린더가 아직 없으면 내일 다시 시도 (결제일만 하루 미룸)
          await prisma.subscription.update({ where: { id: sub.id }, data: { nextBillingDate: new Date(now.getTime() + 86400000) } });
          results.push({ subId: sub.id, status: "deferred", error: "다음 주기 배송일 없음" });
          continue;
        }

        const credit = Math.min(sub.creditBalance, preview.amount);
        const amount = preview.amount - credit;

        const today = now.toISOString().slice(0, 10).replace(/-/g, "");
        const count = await prisma.order.count({ where: { orderNo: { startsWith: `W2O-${today}` } } });
        const orderNo = `W2O-${today}-${String(count + 1).padStart(4, "0")}`;

        let paymentData: { paymentKey?: string; method?: string; receipt?: { url?: string }; message?: string } = {};
        if (amount > 0) {
          const plainBillingKey = decryptBillingKey(sub.billingKey!);
          const paymentRes = await fetch(`https://api.tosspayments.com/v1/billing/${plainBillingKey}`, {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(TOSS_SECRET_KEY + ":").toString("base64")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ customerKey: sub.userId, amount, orderId: orderNo, orderName: `W2O ${sub.cycleWeeks}주 구독 자동갱신` }),
          });
          paymentData = await paymentRes.json();

          if (!paymentRes.ok) {
            failed++;
            const failCount = await prisma.payment.count({
              where: { order: { subscriptionId: sub.id }, status: "FAILED", createdAt: { gte: new Date(now.getTime() - 7 * 86400000) } },
            });
            if (failCount + 1 >= MAX_RETRY) {
              await prisma.subscription.update({ where: { id: sub.id }, data: { status: "PAUSED", pausedAt: now } });
            }
            if (sub.user.phone) {
              await sendAlimtalkSafe({ userId: sub.user.id, to: sub.user.phone, templateCode: TEMPLATE.SUB_RENEWAL_FAILED, variables: { 고객명: sub.user.name } });
            }
            results.push({ subId: sub.id, status: "failed", error: paymentData.message });
            continue;
          }
        }

        // 배송지: 구독 고정 배송지 → 기본 배송지
        const addr = await pickAddressForUser(sub.userId, sub.addressId);
        const hold = addr ? holdFromStatus(addr.areaStatus, addr.distanceKm) : { deliveryHold: true, deliveryHoldReason: "배송지 없음" };
        const firstDate = preview.items[0]!.deliveryDate;

        const order = await prisma.order.create({
          data: {
            orderNo,
            userId: sub.userId,
            addressId: addr?.id ?? null,
            deliveryHold: hold.deliveryHold,
            deliveryHoldReason: hold.deliveryHoldReason,
            type: "SUBSCRIPTION",
            status: "PAID",
            totalAmount: amount,
            deliveryFee: 0,
            subscriptionId: sub.id,
            deliveryDate: firstDate,
            paymentKey: paymentData.paymentKey ?? null,
            paidAt: now,
            items: { create: preview.items.map((it) => ({ productId: it.productId, quantity: it.quantity, unitPrice: it.unitPrice, totalPrice: it.unitPrice * it.quantity })) },
          },
        });

        if (amount > 0) {
          await prisma.payment.create({
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

        const period = await prisma.subscriptionPeriod.create({
          data: {
            subscriptionId: sub.id,
            year: startDate.getUTCFullYear(),
            month: startDate.getUTCMonth() + 1,
            startDate,
            endDate,
            weeks: sub.cycleWeeks,
            status: "PAID",
            totalAmount: amount,
            orderId: order.id,
            paidAt: now,
          },
        });
        await prisma.subscriptionSelection.createMany({
          data: preview.items.map((it) => ({ subscriptionPeriodId: period.id, deliveryDate: it.deliveryDate, productId: it.productId, quantity: it.quantity, unitPrice: it.unitPrice })),
        });

        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            price: amount,
            creditBalance: sub.creditBalance - credit,
            nextBillingDate: billingDateFor(endDate),
            nextDeliveryDate: firstDate,
            renewalNotifiedAt: null,
          },
        });

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
        results.push({ subId: sub.id, status: "error", error: String(err) });
        Sentry.captureException(err, { level: "error", tags: { area: "subscription", phase: "renewal-charge" }, extra: { subId: sub.id, userId: sub.userId } });
      }
    }

    return NextResponse.json({ success: true, total: subscriptions.length, charged, failed, results, timestamp: now.toISOString() });
  } catch (err) {
    console.error("Cron renewal-charge error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
