import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../../lib/auth-guard";
import { transitionDelivery, type DeliveryTransition } from "../../../../lib/delivery-status";

const VALID: DeliveryTransition[] = ["PENDING", "IN_TRANSIT", "DELIVERED", "FAILED"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin("orders");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, driverId, sortOrder, memo } = body;

    const delivery = await prisma.delivery.findUnique({ where: { id } });

    if (!delivery) {
      return NextResponse.json(
        { error: "배송 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (status !== undefined) {
      if (!VALID.includes(status)) {
        return NextResponse.json({ error: `배송 상태가 올바르지 않습니다: ${status}` }, { status: 400 });
      }
      // 완료된 배송은 되돌리지 않는다 (되돌리면 주문 상태·알림톡이 어긋난다)
      if (delivery.status === "DELIVERED" && status !== "DELIVERED") {
        return NextResponse.json({ error: "배송 완료된 건은 상태를 되돌릴 수 없습니다." }, { status: 400 });
      }
    }

    // 코스·순번은 상태와 무관하게 그대로 저장한다
    const plain: Record<string, unknown> = {};
    if (driverId !== undefined) plain.driverId = driverId;
    if (sortOrder !== undefined) plain.sortOrder = sortOrder;
    if (Object.keys(plain).length > 0) {
      await prisma.delivery.update({ where: { id }, data: plain });
    }

    // 상태 전환은 기사 앱과 같은 함수를 탄다 — completedAt·주문 상태·도착 알림이 한곳에서 처리된다.
    // 기사가 사진을 남기지 못한 건을 관리자가 대신 완료 처리하는 경로이기도 하다(사진 없이 완료된다).
    if (status !== undefined && status !== delivery.status) {
      await transitionDelivery(id, status as DeliveryTransition, {
        ...(typeof memo === "string" ? { memo: memo.trim() || null } : {}),
      });
    } else if (typeof memo === "string") {
      await prisma.delivery.update({ where: { id }, data: { memo: memo.trim() || null } });
    }

    const updated = await prisma.delivery.findUnique({
      where: { id },
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

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/admin/delivery/[id] error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
