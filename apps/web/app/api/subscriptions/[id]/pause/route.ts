import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAuth } from "../../../../lib/auth-guard";
import { remainingPaidSelections, settleAsCredit } from "../../../../lib/subscription-settle";

/**
 * POST: 구독 일시정지  { mode?: "CREDIT" | "EXTEND" }
 * - CREDIT(기본): 결제했지만 아직 안 나간 배송분을 크레딧으로 적립 → 다음 결제에서 차감
 * - EXTEND: 배송분은 그대로 두고, 재개할 때 놓친 배송을 주기 뒤로 이어 붙인다 (주기 연장)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const userId = (session!.user as { id: string }).id;
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { mode?: string };
    const mode = body.mode === "EXTEND" ? "EXTEND" : "CREDIT";

    const subscription = await prisma.subscription.findUnique({ where: { id } });
    if (!subscription || subscription.userId !== userId) {
      return NextResponse.json({ error: "구독을 찾을 수 없습니다." }, { status: 404 });
    }
    if (subscription.status !== "ACTIVE") {
      return NextResponse.json({ error: "이용 중인 구독만 일시정지할 수 있습니다." }, { status: 400 });
    }

    const now = new Date();
    let credited = 0;
    let count = 0;
    if (mode === "CREDIT") {
      const r = await settleAsCredit(id);
      credited = r.amount;
      count = r.count;
    } else {
      const r = await remainingPaidSelections(id);
      count = r.count;
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: { status: "PAUSED", pausedAt: now, pauseMode: mode },
      select: { id: true, status: true, pausedAt: true, pauseMode: true, creditBalance: true },
    });

    const message =
      mode === "CREDIT"
        ? credited > 0
          ? `남은 배송 ${count}회분 ${credited.toLocaleString()}원을 크레딧으로 적립했습니다. 재개 후 다음 결제에서 차감됩니다.`
          : "일시정지했습니다. 결제된 남은 배송분은 없습니다."
        : count > 0
          ? `일시정지했습니다. 재개하면 남은 배송 ${count}회를 이어서 받습니다.`
          : "일시정지했습니다.";

    return NextResponse.json({ ...updated, mode, credited, remainingCount: count, message });
  } catch (err) {
    console.error("POST /api/subscriptions/[id]/pause error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
