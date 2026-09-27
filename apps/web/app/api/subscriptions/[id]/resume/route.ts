import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAuth } from "../../../../lib/auth-guard";
import { syncNextDeliveryDate } from "../../../../lib/subscription-cycle";

// POST: 구독 재개
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const userId = (session!.user as { id: string }).id;
    const { id } = await params;

    const subscription = await prisma.subscription.findUnique({ where: { id } });
    if (!subscription || subscription.userId !== userId) {
      return NextResponse.json({ error: "구독을 찾을 수 없습니다." }, { status: 404 });
    }

    if (subscription.status !== "PAUSED") {
      return NextResponse.json(
        { error: "일시정지된 구독만 재개할 수 있습니다." },
        { status: 400 },
      );
    }

    // 정지 중에 지난 결제일은 "지금" 으로 — 다음 크론이 오늘 기준 주기(과거 날짜 제외)로 청구한다
    const now = new Date();
    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        status: "ACTIVE",
        pausedAt: null,
        ...(subscription.autoRenew && subscription.nextBillingDate && subscription.nextBillingDate < now ? { nextBillingDate: now } : {}),
      },
    });
    await syncNextDeliveryDate(updated);

    return NextResponse.json(updated);
  } catch (err) {
    console.error("POST /api/subscriptions/[id]/resume error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
