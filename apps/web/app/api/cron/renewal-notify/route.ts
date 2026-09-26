import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { sendAlimtalkSafe, TEMPLATE } from "../../../lib/notification";
import { nextCycleWindow, previewCycle } from "../../../lib/subscription-cycle";
import type { SlotMap, WeekdaySlotMap } from "../../../lib/auto-assign";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const NOTICE_DAYS = 7;

/**
 * POST: 갱신 7일 전 사전 알림 (매일 09:00)
 * 변동 금액 정기결제는 결제 전 고지가 필수 — 다음 주기의 실제 배송 횟수·수량으로 예정 금액을 계산해 보낸다.
 * 결제 후 건너뛴 배송분(크레딧)이 있으면 차감액도 함께.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + NOTICE_DAYS * 24 * 60 * 60 * 1000);

    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        autoRenew: true,
        billingKey: { not: null },
        nextBillingDate: { lte: windowEnd, gte: now },
      },
      include: { user: true },
    });

    let sent = 0, failed = 0, skipped = 0;
    for (const sub of subscriptions) {
      try {
        // 이번 결제 건에 대해 이미 알렸으면 건너뛴다 (결제일 10일 이내에 보낸 기록)
        if (sub.renewalNotifiedAt && sub.nextBillingDate && sub.nextBillingDate.getTime() - sub.renewalNotifiedAt.getTime() < 10 * 86400000) {
          skipped++;
          continue;
        }
        const { startDate, endDate } = await nextCycleWindow(sub);
        const preview = await previewCycle({
          subscriptionId: sub.id,
          slots: (sub.slots as SlotMap | null) ?? { salad: sub.itemsPerDelivery },
          weekdaySlots: sub.weekdaySlots as WeekdaySlotMap | null,
          startDate,
          endDate,
        });
        const credit = Math.min(sub.creditBalance, preview.amount);
        const charge = preview.amount - credit;

        if (sub.user.phone) {
          await sendAlimtalkSafe({
            userId: sub.user.id,
            to: sub.user.phone,
            templateCode: TEMPLATE.SUB_RENEWAL_NOTICE,
            variables: {
              고객명: sub.user.name,
              금액: charge.toLocaleString(),
              결제일: sub.nextBillingDate ? `${sub.nextBillingDate.getUTCMonth() + 1}월 ${sub.nextBillingDate.getUTCDate()}일` : "",
              배송횟수: String(preview.deliveryDates.length),
              기간: `${sub.cycleWeeks}주`,
              차감: credit > 0 ? `${credit.toLocaleString()}원 차감` : "",
            },
          });
        }
        await prisma.subscription.update({ where: { id: sub.id }, data: { renewalNotifiedAt: now } });
        sent++;
      } catch {
        failed++;
      }
    }

    return NextResponse.json({ success: true, total: subscriptions.length, sent, skipped, failed, timestamp: now.toISOString() });
  } catch (err) {
    console.error("Cron renewal-notify error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
