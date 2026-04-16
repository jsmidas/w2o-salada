import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAuth } from "../../../lib/auth-guard";
import { encryptBillingKey } from "../../../lib/billing-crypto";

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY ?? "";

// POST: 빌링키 발급 완료 → 첫 결제 실행
export async function POST(request: Request) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const { authKey, customerKey, orderId, amount, orderNo, subscriptionId } = await request.json();

    if (!authKey || !customerKey) {
      return NextResponse.json({ error: "authKey, customerKey 필수" }, { status: 400 });
    }

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

    // 3. DB 업데이트
    try {
      const userId = (session!.user as { id: string }).id;

      // 주문 상태 업데이트
      if (orderId) {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: "PAID",
            paymentKey: paymentData.paymentKey,
            paidAt: new Date(),
          },
        });

        await prisma.payment.create({
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
      }

      // 구독 처리: subscriptionId 있으면 기존 구독 활성화, 없으면 신규 생성 (레거시 호환)
      if (subscriptionId) {
        await prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            status: "ACTIVE",
            billingKey: encryptedBillingKey,
            startedAt: new Date(),
            nextBillingDate: getNextBillingDate(),
          },
        });
      } else {
        await prisma.subscription.create({
          data: {
            userId,
            planType: "REGULAR",
            frequency: "BIWEEKLY",
            status: "ACTIVE",
            billingKey: encryptedBillingKey,
            price: amount,
            startedAt: new Date(),
            nextBillingDate: getNextBillingDate(),
            nextDeliveryDate: getNextDeliveryDate(),
          },
        });
      }
    } catch (dbErr) {
      console.warn("DB 저장 실패 (결제는 완료됨):", dbErr);
    }

    return NextResponse.json({
      success: true,
      orderNo,
      totalAmount: amount,
      billingKey: billingKey.slice(0, 8) + "...", // 일부만 노출
    });
  } catch (err) {
    console.error("POST /api/subscribe/billing error:", err);
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
