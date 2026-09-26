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
        address: true,
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
    const { status, resolveHold, holdNote } = body as {
      status?: string;
      resolveHold?: boolean;
      holdNote?: string | null;
    };

    // 배송지 확인 처리 — 담당자가 고객과 통화한 결과를 기록하고 큐에서 뺀다 (상태 전환과 별개)
    if (resolveHold !== undefined || holdNote !== undefined) {
      const data: Record<string, unknown> = {};
      if (holdNote !== undefined) data.deliveryHoldNote = holdNote ? String(holdNote).trim() : null;
      if (resolveHold === true) data.deliveryHoldResolvedAt = new Date();
      if (resolveHold === false) { data.deliveryHoldResolvedAt = null; data.deliveryHold = true; }
      const updated = await prisma.order.update({
        where: { id },
        data,
        select: { id: true, addressId: true, deliveryHold: true, deliveryHoldReason: true, deliveryHoldResolvedAt: true, deliveryHoldNote: true },
      });
      // 같은 배송지의 다른 보류 주문도 한 통화로 끝난 것 — 함께 처리해 두 번 전화하지 않게 한다
      let siblings = 0;
      if (resolveHold === true && updated.addressId) {
        const r = await prisma.order.updateMany({
          where: { id: { not: id }, addressId: updated.addressId, deliveryHold: true, deliveryHoldResolvedAt: null },
          data: { deliveryHoldResolvedAt: new Date(), deliveryHoldNote: (data.deliveryHoldNote as string | null) ?? undefined },
        });
        siblings = r.count;
      }
      if (!status) return NextResponse.json({ ...updated, siblingsResolved: siblings });
    }

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
      data: { status: status as import("@prisma/client").OrderStatus },
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
