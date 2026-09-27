import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAuth } from "../../../lib/auth-guard";
import { holdFromStatus } from "../../../lib/geo";

const ADDRESS_SELECT = {
  id: true, label: true, name: true, phone: true, zipCode: true, address1: true, address2: true,
  buildingName: true, areaStatus: true, distanceKm: true, dropLocation: true, entranceMethod: true, floor: true,
} as const;

// GET: 구독 상세 조회 (본인 구독만)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const userId = (session!.user as { id: string }).id;
    const { id } = await params;

    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        address: { select: ADDRESS_SELECT },
      },
    });

    if (!subscription || subscription.userId !== userId) {
      return NextResponse.json({ error: "구독을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json(subscription);
  } catch (err) {
    console.error("GET /api/subscriptions/[id] error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// PATCH: 구독 메뉴/주기/배송지 변경
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const userId = (session!.user as { id: string }).id;
    const { id } = await params;
    const body = await request.json();

    const subscription = await prisma.subscription.findUnique({ where: { id } });
    if (!subscription || subscription.userId !== userId) {
      return NextResponse.json({ error: "구독을 찾을 수 없습니다." }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.frequency) data.frequency = body.frequency;
    if (body.planType) data.planType = body.planType;
    if (body.selectionMode === "AUTO" || body.selectionMode === "MANUAL") {
      data.selectionMode = body.selectionMode;
    }

    // 배송지 변경 — 본인 배송지만. 아직 배송 전인 이 구독의 주문도 새 배송지로 옮긴다
    let movedOrders = 0;
    if (typeof body.addressId === "string" && body.addressId !== subscription.addressId) {
      const addr = await prisma.address.findUnique({ where: { id: body.addressId } });
      if (!addr || addr.userId !== userId) {
        return NextResponse.json({ error: "배송지를 찾을 수 없습니다." }, { status: 400 });
      }
      data.addressId = addr.id;

      const hold = holdFromStatus(addr.areaStatus, addr.distanceKm);
      const todayKst = new Date(Date.now() + 9 * 3600 * 1000);
      todayKst.setUTCHours(0, 0, 0, 0);
      const res = await prisma.order.updateMany({
        where: {
          subscriptionId: id,
          status: { in: ["PENDING", "PAID"] },
          OR: [{ deliveryDate: null }, { deliveryDate: { gte: new Date(todayKst.getTime() - 9 * 3600 * 1000) } }],
        },
        data: { addressId: addr.id, deliveryHold: hold.deliveryHold, deliveryHoldReason: hold.deliveryHoldReason, deliveryHoldResolvedAt: null },
      });
      movedOrders = res.count;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "변경할 값이 없습니다." }, { status: 400 });
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data,
      include: { items: { include: { product: true } }, address: { select: ADDRESS_SELECT } },
    });

    return NextResponse.json({ ...updated, movedOrders });
  } catch (err) {
    console.error("PATCH /api/subscriptions/[id] error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
