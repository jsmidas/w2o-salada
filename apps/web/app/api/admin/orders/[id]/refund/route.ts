import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../../../lib/auth-guard";
import { refundOrder, RefundError } from "../../../../../lib/order-refund";

/**
 * POST /api/admin/orders/[id]/refund  { reason?: string }
 * 토스 결제 취소를 실제로 호출한 뒤 주문을 REFUNDED 로 바꾼다. PAID · CANCELLED 상태만.
 * (PREPARING 이후는 이미 조리에 들어간 것이라 관리자 판단으로 상태를 먼저 되돌려야 한다)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin("orders");
  if (error) return error;

  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    const reason = (body.reason ?? "").trim() || "관리자 환불";

    const order = await prisma.order.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!order) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }
    if (order.status === "REFUNDED") {
      return NextResponse.json({ message: "이미 환불된 주문입니다.", refundedAmount: 0 });
    }
    if (order.status !== "CANCELLED" && order.status !== "PAID") {
      return NextResponse.json(
        { error: "환불할 수 없는 주문 상태입니다. (PAID 또는 CANCELLED만 가능)" },
        { status: 400 }
      );
    }

    const result = await refundOrder({ orderId: id, reason, finalStatus: "REFUNDED" });
    const updated = await prisma.order.findUnique({ where: { id }, include: { payments: true } });

    return NextResponse.json({
      message: result.refundedAmount > 0
        ? `${result.refundedAmount.toLocaleString()}원 결제가 취소되었습니다.`
        : "결제 기록이 없어 상태만 환불 처리했습니다.",
      refundedAmount: result.refundedAmount,
      order: updated,
    });
  } catch (err) {
    if (err instanceof RefundError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("POST /api/admin/orders/[id]/refund error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
