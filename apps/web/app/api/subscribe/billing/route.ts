import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@repo/db";
import { requireAuth } from "../../../lib/auth-guard";
import { encryptBillingKey } from "../../../lib/billing-crypto";

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY ?? "";

// POST: 빌링키 발급 완료 → 첫 결제 실행
export async function POST(request: Request) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const body = (await request.json()) as { authKey?: string; customerKey?: string; orderId?: string };
    const { authKey, customerKey, orderId } = body;
    const userId = (session!.user as { id: string }).id;

    if (!authKey || !customerKey || !orderId) {
      return NextResponse.json({ error: "authKey, customerKey, orderId 필수" }, { status: 400 });
    }
    // 토스 customerKey 는 결제창을 연 사용자 id — 세션과 다르면 남의 카드 등록 시도
    if (customerKey !== userId) {
      return NextResponse.json({ error: "결제 정보가 일치하지 않습니다." }, { status: 403 });
    }

    // 금액·주문번호·구독은 클라이언트가 아니라 DB 의 주문에서 가져온다 (URL 파라미터 변조 방지)
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNo: true, userId: true, status: true, totalAmount: true, subscriptionId: true },
    });
    if (!order || order.userId !== userId) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }
    if (order.status === "PAID") {
      // 성공 페이지 새로고침 등 재호출 — 이미 결제됐으면 그대로 성공
      return NextResponse.json({ success: true, orderNo: order.orderNo, totalAmount: order.totalAmount, alreadyPaid: true });
    }
    if (order.status !== "PENDING") {
      return NextResponse.json({ error: "결제할 수 없는 주문 상태입니다." }, { status: 400 });
    }
    const amount = order.totalAmount;
    const orderNo = order.orderNo;

    // 1. 빌링키 발급
    const billingRes = await fetch("https://api.tosspayments.com/v1/billing/authorizations/issue", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(TOSS_SECRET_KEY + ":").toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ authKey, customerKey }),
    });

    const billingData = await billingRes.json();

    if (!billingRes.ok) {
      return NextResponse.json(
        { error: billingData.message ?? "빌링키 발급 실패", code: billingData.code },
        { status: 400 }
      );
    }

    const billingKey = billingData.billingKey;
    // DB 저장용 암호화본 (토스 API 호출엔 평문 사용)
    const encryptedBillingKey = encryptBillingKey(billingKey);
    // 등록 카드 표시용 (마이페이지·"등록 카드로 바로 결제" 라벨)
    const cardCompany: string | null = billingData.cardCompany ?? null;
    const cardNumber: string | null = billingData.cardNumber ?? billingData.card?.number ?? null;

    // 구독은 주문에 연결된 것만 (URL 의 subscriptionId 는 쓰지 않는다)
    const targetSubscriptionId: string | null = order.subscriptionId ?? null;
    if (targetSubscriptionId) {
      const owner = await prisma.subscription.findUnique({ where: { id: targetSubscriptionId }, select: { userId: true } });
      if (!owner || (owner.userId !== userId && owner.userId !== "guest")) {
        return NextResponse.json({ error: "구독 정보가 일치하지 않습니다." }, { status: 403 });
      }
    }

    // 2. 빌링키로 첫 결제
    const paymentRes = await fetch("https://api.tosspayments.com/v1/billing/" + billingKey, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(TOSS_SECRET_KEY + ":").toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerKey,
        amount,
        orderId: orderNo,
        orderName: "W2O 정기구독",
      }),
    });

    const paymentData = await paymentRes.json();

    if (!paymentRes.ok) {
      return NextResponse.json(
        { error: paymentData.message ?? "첫 결제 실패", code: paymentData.code },
        { status: 400 }
      );
    }

    // 3. DB 업데이트 — 주문·결제·구독·주기를 한 트랜잭션으로 (중간 실패로 반쪽 상태가 남지 않게)
    try {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: "PAID",
            paymentKey: paymentData.paymentKey,
            paidAt: new Date(),
          },
        });

        await tx.payment.create({
          data: {
            orderId,
            paymentKey: paymentData.paymentKey,
            method: paymentData.method,
            amount,
            status: "DONE",
            billingKey: encryptedBillingKey,
            receiptUrl: paymentData.receipt?.url ?? null,
            rawResponse: JSON.stringify(paymentData),
          },
        });

        // 구독 처리: 주문에 연결된 구독 활성화(guest 신청분은 결제자에게 귀속), 없으면 신규 생성 (레거시 호환)
        if (targetSubscriptionId) {
          const sub = await tx.subscription.findUnique({ where: { id: targetSubscriptionId }, select: { nextBillingDate: true } });
          await tx.subscription.update({
            where: { id: targetSubscriptionId },
            data: {
              userId,
              status: "ACTIVE",
              billingKey: encryptedBillingKey,
              cardCompany,
              cardNumber,
              startedAt: new Date(),
              // 롤링 주기: /api/subscribe 가 주기 종료 이틀 전으로 정해둔 값을 쓴다. 레거시(없음)만 한 달 뒤
              nextBillingDate: sub?.nextBillingDate ?? getNextBillingDate(),
            },
          });
          // 첫 주기 결제 완료
          await tx.subscriptionPeriod.updateMany({
            where: { subscriptionId: targetSubscriptionId, status: "PENDING", OR: [{ orderId }, { orderId: null }] },
            data: { status: "PAID", paidAt: new Date(), orderId },
          });
        } else {
          await tx.subscription.create({
            data: {
              userId,
              planType: "REGULAR",
              frequency: "BIWEEKLY",
              status: "ACTIVE",
              billingKey: encryptedBillingKey,
              cardCompany,
              cardNumber,
              price: amount,
              startedAt: new Date(),
              nextBillingDate: getNextBillingDate(),
              nextDeliveryDate: getNextDeliveryDate(),
            },
          });
        }
      });
    } catch (dbErr) {
      console.warn("DB 저장 실패 (결제는 완료됨):", dbErr);
      // 토스 빌링키는 발급됐는데 DB 저장 실패 — 결제 vs 구독 상태 불일치
      Sentry.captureException(dbErr, {
        level: "error",
        tags: { area: "subscription", phase: "billing-issue-db" },
        extra: { orderId, subscriptionId: targetSubscriptionId },
      });
    }

    return NextResponse.json({
      success: true,
      orderNo,
      totalAmount: amount,
      billingKey: billingKey.slice(0, 8) + "...", // 일부만 노출
    });
  } catch (err) {
    console.error("POST /api/subscribe/billing error:", err);
    Sentry.captureException(err, {
      level: "error",
      tags: { area: "subscription", phase: "billing-issue" },
    });
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

function getNextBillingDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function getNextDeliveryDate(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  // 다음 화요일 또는 목요일
  const daysUntilTue = (2 - dayOfWeek + 7) % 7 || 7;
  const daysUntilThu = (4 - dayOfWeek + 7) % 7 || 7;
  const daysUntilNext = Math.min(daysUntilTue, daysUntilThu);
  return new Date(now.getTime() + daysUntilNext * 24 * 60 * 60 * 1000);
}
