import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../../../lib/auth-guard";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin("orders");
  if (error) return error;

  try {
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { payments: true },
    });

    if (!order) {
      return NextResponse.json(
        { error: "주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (order.status !== "CANCELLED" && order.status !== "PAID") {
      return NextResponse.json(
        { error: "환불할 수 없는 주문 상태입니다. (PAID 또는 CANCELLED만 가능)" },
        { status: 400 }
      );
    }

    const payment = order.payments[0];

    const result = await prisma.$transaction(async (tx: any) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: { status: "REFUNDED" },
      });

      if (payment) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "CANCELLED" },
        });
      }

      return updatedOrder;
    });

    return NextResponse.json({
      message: "환불이 완료되었습니다.",
      order: result,
    });
  } catch (err) {
    console.error("POST /api/admin/orders/[id]/refund error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
