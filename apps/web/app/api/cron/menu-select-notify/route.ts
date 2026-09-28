import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { sendAlimtalkSafe, TEMPLATE } from "../../../lib/notification";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

/**
 * 메뉴 선택 알림: 배송일 3일 전(D-3) 발송 (매일 09:00 실행)
 *
 * 대상: ACTIVE 구독 중 selectionMode='MANUAL'(맞춤 정기구독) 사용자
 * 의도: 배송 3일 전 "메뉴 확인" CTA → 원하면 교체, 아니면 그대로 배송
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  // 시크릿이 비어 있으면 열리는 게 아니라 닫힌다 (fail-closed)
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const targetDateStr = threeDaysLater.toISOString().split("T")[0]!;

    const startOfDay = new Date(targetDateStr + "T00:00:00Z");
    const endOfDay = new Date(targetDateStr + "T23:59:59Z");

    const deliveryDay = await prisma.deliveryCalendar.findFirst({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
        isActive: true,
      },
    });

    if (!deliveryDay) {
      return NextResponse.json({
        success: true,
        message: `${targetDateStr}은 배송일이 아닙니다`,
        sent: 0,
      });
    }

    // ACTIVE + MANUAL 모드 구독자 조회
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        selectionMode: "MANUAL",
      },
      include: { user: true },
    });

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const month = threeDaysLater.getMonth() + 1;

    // 오늘 이미 이 안내를 받은 사람은 건너뛴다.
    // 크론이 두 번 돌거나 손으로 한 번 더 돌려도 같은 날 두 통이 가지 않게.
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const alreadySent = new Set(
      (
        await prisma.notification.findMany({
          where: { templateCode: "SUB_SELECT_MENU", createdAt: { gte: todayStart } },
          select: { userId: true },
        })
      ).map((n) => n.userId),
    );

    for (const sub of subscriptions) {
      try {
        if (alreadySent.has(sub.userId)) {
          skipped++;
          continue;
        }
        if (sub.user.phone) {
          await sendAlimtalkSafe({
            userId: sub.user.id,
            to: sub.user.phone,
            templateCode: TEMPLATE.SUB_SELECT_MENU,
            variables: {
              고객명: sub.user.name,
              월: String(month),
            },
          });
          sent++;
        }
      } catch {
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      targetDate: targetDateStr,
      total: subscriptions.length,
      sent,
      skipped,
      failed,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error("Cron menu-select-notify error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
