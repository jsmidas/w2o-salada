import { NextRequest, NextResponse } from "next/server";
import { requireDriver } from "../../../../../lib/auth-guard";
import { canTouchDelivery } from "../../../../../lib/driver-access";
import { transitionDelivery } from "../../../../../lib/delivery-status";

/**
 * 배송 불가 처리 — 사유 필수. 주문 상태는 바꾸지 않고 관리자가 후속 처리한다.
 * POST /api/driver/deliveries/:id/fail  body { memo }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session, isAdmin } = await requireDriver();
  if (error) return error;
  const me = session!.user as { id: string };

  try {
    const { id } = await params;
    const access = await canTouchDelivery(id, me.id, isAdmin);
    if (!access.ok) return NextResponse.json({ error: access.reason }, { status: 403 });
    if (access.delivery!.status === "DELIVERED") {
      return NextResponse.json({ error: "이미 완료된 배송입니다." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const memo = typeof body.memo === "string" ? body.memo.trim() : "";
    if (!memo) return NextResponse.json({ error: "배송 불가 사유를 입력해 주세요." }, { status: 400 });

    await transitionDelivery(id, "FAILED", { memo });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/driver/deliveries/[id]/fail error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
