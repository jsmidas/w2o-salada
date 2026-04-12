import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../../lib/auth-guard";
import { sendAlimtalkSafe, TEMPLATE } from "../../../../lib/notification";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin("orders");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, driverId, sortOrder } = body;

    const delivery = await prisma.delivery.findUnique({ where: { id } });

    if (!delivery) {
      return NextResponse.json(
        { error: "배송 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};

    if (status) {
      data.status = status;
    }
    if (driverId !== undefined) {
      data.driverId = driverId;
    }
    if (sortOrder !== undefined) {
      data.sortOrder = sortOrder;
    }

    const updated = await prisma.delivery.update({
      where: { id },
      data,
      include: {
        order: {
          include: {
            user: true,
            address: true,
            items: { include: { product: true } },
          },
        },
      },
    });

    // 배송 상태 전환 시 주문 상태 동기화 + 알림톡 발송
    if (status && status !== delivery.status) {
      const user = updated.order.user;
      // IN_TRANSIT = 배송 출발
      if (status === "IN_TRANSIT") {
        await prisma.order.update({
          where: { id: updated.order.id },
          data: { status: "SHIPPING" },
        });
        if (user.phone) {
          await sendAlimtalkSafe({
            userId: user.id,
            to: user.phone,
            templateCode: TEMPLATE.DELIVERY_START,
            variables: { 고객명: user.name },
          });
        }
      }
      // DELIVERED = 배송 완료
      if (status === "DELIVERED") {
        await prisma.order.update({
          where: { id: updated.order.id },
          data: { status: "DELIVERED", deliveredAt: new Date() },
        });
        if (user.phone) {
          await sendAlimtalkSafe({
            userId: user.id,
            to: user.phone,
            templateCode: TEMPLATE.DELIVERY_DONE,
            variables: { 고객명: user.name },
          });
        }
      }
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/admin/delivery/[id] error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
