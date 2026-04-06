import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { sendAlimtalkSafe, TEMPLATE } from "../../../lib/notification";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

/**
 * 메뉴 선택 알림: 배송일 7일 전 발송 (매일 09:00 실행)
 *
 * 대상: ACTIVE 구독 중 selectionMode='MANUAL'인 사용자
 * 조건: 7일 후 배송일이 있고, 해당 날짜에 메뉴 미선택 상태
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const targetDateStr = sevenDaysLater.toISOString().split("T")[0]!;

    // 7일 후 배송일이 있는지 확인
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
    const month = sevenDaysLater.getMonth() + 1;

    for (const sub of subscriptions) {
      try {
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
