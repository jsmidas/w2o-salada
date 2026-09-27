import { prisma } from "@repo/db";

/**
 * 기사가 볼 수 있는 코스 — 자기 계정이 연결된 활성 코스.
 * 관리자는 점검용으로 활성 코스 전체를 본다.
 */
export async function routesForDriver(userId: string, isAdmin: boolean) {
  return prisma.deliveryRoute.findMany({
    where: isAdmin ? { isActive: true } : { isActive: true, driverUserId: userId },
    orderBy: [{ departOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, color: true, vehicleNo: true, driverUserId: true },
  });
}

/** 이 배송 건이 기사의 코스에 속하는지 — 남의 코스 건은 건드릴 수 없다 */
export async function canTouchDelivery(deliveryId: string, userId: string, isAdmin: boolean) {
  const d = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    select: { id: true, status: true, routeId: true, scheduledDate: true, route: { select: { driverUserId: true, isActive: true } } },
  });
  if (!d) return { ok: false as const, reason: "배송 건을 찾을 수 없습니다.", delivery: null };
  if (!d.routeId || !d.route) return { ok: false as const, reason: "코스가 배정되지 않은 배송입니다.", delivery: d };
  if (!isAdmin && d.route.driverUserId !== userId) return { ok: false as const, reason: "내 코스의 배송이 아닙니다.", delivery: d };
  return { ok: true as const, reason: null, delivery: d };
}
