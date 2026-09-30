import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAuth } from "../../../lib/auth-guard";
import { holdFromStatus, rejudgeAndStore } from "../../../lib/geo";
import { checkOrderable } from "../../../lib/delivery-zone";
import { remainingPaidSelections } from "../../../lib/subscription-settle";
import { getRefundFeePercent } from "../../../lib/refund-policy";

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

    // 일시정지·해지 화면에서 "남은 배송분이 얼마인지" 보여주기 위한 정산 정보
    const [remaining, refundRequests, feePercent] = await Promise.all([
      subscription.status === "ACTIVE" || subscription.status === "PAUSED" ? remainingPaidSelections(id) : null,
      getRefundFeePercent(),
      prisma.refundRequest.findMany({
        where: { subscriptionId: id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, kind: true, status: true, requestedAmount: true, feeAmount: true, refundAmount: true, createdAt: true, processedAt: true, adminNote: true },
      }),
    ]);

    return NextResponse.json({
      ...subscription,
      settlement: { remainingCount: remaining?.count ?? 0, remainingAmount: remaining?.amount ?? 0, creditBalance: subscription.creditBalance, feePercent },
      refundRequests,
    });
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
      const found = await prisma.address.findUnique({ where: { id: body.addressId } });
      if (!found || found.userId !== userId) {
        return NextResponse.json({ error: "배송지를 찾을 수 없습니다." }, { status: 400 });
      }
      // 구독 배송지는 현재 권역 규칙으로 다시 판정한다. ZONES 모드 권역 밖·차단 규칙 주소로는 바꿀 수 없다
      const { zone, address: addr } = await rejudgeAndStore(found);
      const zoneCheck = await checkOrderable({ areaStatus: addr.areaStatus, zoneId: addr.zoneId, canOrder: zone.canOrder, areaReason: zone.reason, mode: zone.mode }, []);
      if (zoneCheck.blocked) {
        return NextResponse.json({ error: `이 배송지로는 변경할 수 없습니다. ${zoneCheck.blocked.message}`, code: zoneCheck.blocked.code }, { status: 400 });
      }
      data.addressId = addr.id;

      const hold = holdFromStatus(addr.areaStatus, addr.distanceKm, undefined, zone.matchedBy === "LEGACY" ? null : zone.reason);
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
