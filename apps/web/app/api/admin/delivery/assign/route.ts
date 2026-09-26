import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../../lib/auth-guard";

/**
 * 코스 배정 일괄 저장
 * body: { assignments: [{ deliveryId, routeId: string | null, sortOrder }] }
 *  - routeId 는 DeliveryRoute.id. null 이면 미배정
 *  - driverId(레거시 라벨)에는 코스명을 같이 써 둔다 (출력본·과거 코드 호환)
 *  - 배정된 배송지에는 lastRouteId 를 기억시켜 다음 배송일에 자동으로 같은 코스가 채워지게 한다
 */
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;

  try {
    const body = await request.json();
    const assignments: Array<{ deliveryId: string; routeId?: string | null; routeLabel?: string | null; sortOrder: number }> =
      body.assignments ?? [];

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return NextResponse.json({ error: "assignments 배열이 필요합니다." }, { status: 400 });
    }

    const routeIds = [...new Set(assignments.map((a) => a.routeId).filter((v): v is string => !!v))];
    const routes = await prisma.deliveryRoute.findMany({ where: { id: { in: routeIds } }, select: { id: true, name: true } });
    const routeName = new Map(routes.map((r) => [r.id, r.name]));
    for (const id of routeIds) {
      if (!routeName.has(id)) return NextResponse.json({ error: `존재하지 않는 코스: ${id}` }, { status: 400 });
    }

    const deliveries = await prisma.delivery.findMany({
      where: { id: { in: assignments.map((a) => a.deliveryId) } },
      select: { id: true, order: { select: { addressId: true } } },
    });
    const addressOf = new Map(deliveries.map((d) => [d.id, d.order.addressId]));

    await prisma.$transaction(
      assignments.flatMap((a) => {
        const routeId = a.routeId || null;
        const ops: ReturnType<typeof prisma.delivery.update>[] = [
          prisma.delivery.update({
            where: { id: a.deliveryId },
            data: {
              routeId,
              driverId: routeId ? routeName.get(routeId)! : null,
              sortOrder: Number.isFinite(a.sortOrder) ? a.sortOrder : 0,
            },
          }),
        ];
        const addressId = addressOf.get(a.deliveryId);
        if (routeId && addressId) {
          ops.push(prisma.address.update({ where: { id: addressId }, data: { lastRouteId: routeId } }) as never);
        }
        return ops;
      }),
    );

    return NextResponse.json({ success: true, updated: assignments.length });
  } catch (err) {
    console.error("POST /api/admin/delivery/assign error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
