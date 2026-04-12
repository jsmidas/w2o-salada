import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../../lib/auth-guard";

// Valid state transitions
const STATE_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["PAID", "FAILED"],
  PAID: ["PREPARING", "CANCELLED"],
  PREPARING: ["SHIPPING"],
  SHIPPING: ["DELIVERED"],
  CANCELLED: ["REFUNDED"],
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin("orders");
  if (error) return error;

  try {
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: true,
        items: { include: { product: true } },
        payments: true,
        delivery: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json(order);
  } catch (err) {
    console.error("GET /api/admin/orders/[id] error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin("orders");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: "변경할 상태를 지정해주세요." },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({ where: { id } });

    if (!order) {
      return NextResponse.json(
        { error: "주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const allowedTransitions = STATE_TRANSITIONS[order.status] ?? [];
    if (!allowedTransitions.includes(status)) {
      return NextResponse.json(
        {
          error: `${order.status} 상태에서 ${status}(으)로 변경할 수 없습니다.`,
        },
        { status: 400 }
      );
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        user: true,
        items: { include: { product: true } },
        payments: true,
        delivery: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/admin/orders/[id] error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
