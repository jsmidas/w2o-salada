import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { sendAlimtalkSafe, TEMPLATE } from "../../../lib/notification";
import { pushDuePrices } from "../../../lib/effective-price";
import { decryptBillingKey } from "../../../lib/billing-crypto";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY ?? "";
const MAX_RETRY = 3;

// POST: 자동 갱신 결제 실행 (매일 06:00 실행)
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    await pushDuePrices(now);

    // 결제일이 도래한 활성 구독 조회
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        billingKey: { not: null },
        nextBillingDate: { lte: now },
      },
      include: { user: true },
    });

    let charged = 0;
    let failed = 0;
    const results: { subId: string; status: string; error?: string }[] = [];

    for (const sub of subscriptions) {
      try {
        // 다음 달 결제 금액 계산
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59);

        // 다음 달 배송일 수 조회
        const deliveryDays = await prisma.deliveryCalendar.findMany({
          where: { date: { gte: nextMonth, lte: nextMonthEnd }, isActive: true },
          include: { menuAssignments: { include: { product: true }, orderBy: { sortOrder: "asc" } } },
        });

        // 금액 계산
        let amount = 0;
        for (const day of deliveryDays) {
          const topItems = day.menuAssignments.slice(0, sub.itemsPerDelivery);
          for (const m of topItems) {
            amount += m.product.price;
          }
        }

        if (amount <= 0) {
          results.push({ subId: sub.id, status: "skipped", error: "금액 0원" });
          continue;
        }

        // 주문번호 생성
        const today = now.toISOString().slice(0, 10).replace(/-/g, "");
        const count = await prisma.order.count({ where: { orderNo: { startsWith: `W2O-${today}` } } });
        const orderNo = `W2O-${today}-${String(count + 1).padStart(4, "0")}`;

        // 빌링키 복호화 (레거시 평문은 그대로 통과)
        const plainBillingKey = decryptBillingKey(sub.billingKey);

        // 토스 빌링키 결제
        const paymentRes = await fetch(`https://api.tosspayments.com/v1/billing/${plainBillingKey}`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(TOSS_SECRET_KEY + ":").toString("base64")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customerKey: sub.userId,
            amount,
            orderId: orderNo,
            orderName: "W2O 정기구독 자동갱신",
          }),
        });

        const paymentData = await paymentRes.json();

        if (!paymentRes.ok) {
          // 결제 실패
          failed++;

          // 재시도 카운트 체크 (기존 실패 Payment 수)
          const failCount = await prisma.payment.count({
            where: {
              order: { subscriptionId: sub.id },
              status: "FAILED",
              createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
            },
          });

          if (failCount + 1 >= MAX_RETRY) {
            // 3회 실패 → 구독 일시정지
            await prisma.subscription.update({
              where: { id: sub.id },
              data: { status: "PAUSED", pausedAt: now },
            });
          }

          // 실패 알림
          if (sub.user.phone) {
            await sendAlimtalkSafe({
              userId: sub.user.id,
              to: sub.user.phone,
              templateCode: TEMPLATE.SUB_RENEWAL_FAILED,
              variables: { 고객명: sub.user.name },
            });
          }

          results.push({ subId: sub.id, status: "failed", error: paymentData.message });
          continue;
        }

        // 결제 성공 → DB 업데이트
        const order = await prisma.order.create({
          data: {
            orderNo,
            userId: sub.userId,
            type: "SUBSCRIPTION",
            status: "PAID",
            totalAmount: amount,
            deliveryFee: 0,
            subscriptionId: sub.id,
            paymentKey: paymentData.paymentKey,
            paidAt: now,
          },
        });

        await prisma.payment.create({
          data: {
            orderId: order.id,
            paymentKey: paymentData.paymentKey,
            method: paymentData.method,
            amount,
            status: "DONE",
            billingKey: sub.billingKey, // 이미 암호화된 저장값 유지
            receiptUrl: paymentData.receipt?.url ?? null,
            rawResponse: JSON.stringify(paymentData),
          },
        });

        // SubscriptionPeriod 생성
        const periodMonth = nextMonth.getMonth() + 1;
        const periodYear = nextMonth.getFullYear();

        await prisma.subscriptionPeriod.create({
          data: {
            subscriptionId: sub.id,
            year: periodYear,
            month: periodMonth,
            status: "PAID",
            totalAmount: amount,
            orderId: order.id,
            paidAt: now,
          },
        });

        // 다음 결제일 갱신 (다음 달 같은 날)
        const nextBilling = new Date(periodYear, periodMonth, now.getDate());
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            price: amount,
            nextBillingDate: nextBilling,
            renewalNotifiedAt: null, // 알림 초기화
          },
        });

        // 성공 알림
        if (sub.user.phone) {
          await sendAlimtalkSafe({
            userId: sub.user.id,
            to: sub.user.phone,
            templateCode: TEMPLATE.SUB_RENEWED,
            variables: {
              고객명: sub.user.name,
              금액: amount.toLocaleString(),
            },
          });
        }

        charged++;
        results.push({ subId: sub.id, status: "charged" });
      } catch (err) {
        failed++;
        results.push({ subId: sub.id, status: "error", error: String(err) });
      }
    }

    return NextResponse.json({
      success: true,
      total: subscriptions.length,
      charged,
      failed,
      results,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error("Cron renewal-charge error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
