import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAuth } from "../../../../lib/auth-guard";
import { syncNextDeliveryDate } from "../../../../lib/subscription-cycle";
import { extendAfterPause } from "../../../../lib/subscription-settle";

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
    // 주기 연장으로 정지했으면 놓친 배송을 주기 뒤로 이어 붙인다 (endDate·결제일도 그만큼 밀림)
    const extended = subscription.pauseMode === "EXTEND" ? await extendAfterPause(subscription) : { moved: 0, newEndDate: null };

    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        status: "ACTIVE",
        pausedAt: null,
        pauseMode: null,
        ...(!extended.newEndDate && subscription.autoRenew && subscription.nextBillingDate && subscription.nextBillingDate < now ? { nextBillingDate: now } : {}),
      },
    });
    const nextDelivery = await syncNextDeliveryDate(updated);

    const message = extended.moved > 0
      ? `구독을 재개했습니다. 정지 중 놓친 배송 ${extended.moved}건을 주기 뒤로 옮겼습니다.`
      : "구독을 재개했습니다.";
    return NextResponse.json({ ...updated, nextDeliveryDate: nextDelivery, extended, message });
  } catch (err) {
    console.error("POST /api/subscriptions/[id]/resume error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
