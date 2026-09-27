import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../../lib/auth-guard";
import { afterDeliveryStatusChange, type DeliveryTransition } from "../../../../lib/delivery-status";

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
      const VALID = ["PENDING", "IN_TRANSIT", "DELIVERED", "FAILED"];
      if (!VALID.includes(status)) return NextResponse.json({ error: `배송 상태가 올바르지 않습니다: ${status}` }, { status: 400 });
      // 완료된 배송은 되돌리지 않는다 (되돌리면 주문 상태·알림톡이 어긋난다)
      if (delivery.status === "DELIVERED" && status !== "DELIVERED") {
        return NextResponse.json({ error: "배송 완료된 건은 상태를 되돌릴 수 없습니다." }, { status: 400 });
      }
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

    // 배송 상태 전환 시 주문 상태 동기화 + 알림톡 발송 (기사 앱과 같은 규칙)
    if (status && status !== delivery.status) {
      await afterDeliveryStatusChange({
        orderId: updated.order.id,
        user: updated.order.user,
        from: delivery.status,
        to: status as DeliveryTransition,
      });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/admin/delivery/[id] error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
