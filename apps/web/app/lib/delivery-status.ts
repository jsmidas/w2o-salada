import { prisma } from "@repo/db";
import { notifyArrival, pastArrivalNotifyTime } from "./delivery-notify";

/**
 * 배송 상태 전환의 부수효과 — 주문 상태 동기화 + 고객 알림톡.
 * 관리자 배송 화면과 기사 앱이 같은 규칙을 타도록 한곳에 둔다.
 *
 *  IN_TRANSIT (출발)  → Order.SHIPPING (알림 없음 — 새벽 3시에 알림을 보내지 않는다)
 *  DELIVERED  (완료)  → Order.DELIVERED + deliveredAt + '배송 도착' 알림톡(아침 07:30)
 *  FAILED / PENDING   → 주문 상태는 건드리지 않는다 (관리자가 판단). FAILED 도 completedAt(처리 시각)을 남긴다
 */
export type DeliveryTransition = "PENDING" | "IN_TRANSIT" | "DELIVERED" | "FAILED";

export async function afterDeliveryStatusChange(args: {
  orderId: string;
  /** 도착 알림을 보낼 배송 건. 넘기지 않으면 알림은 07:30 크론에 맡긴다 */
  deliveryId?: string;
  user: { id: string; name: string; phone: string | null };
  from: string;
  to: DeliveryTransition;
}) {
  const { orderId, deliveryId, user, from, to } = args;
  if (from === to) return;

  if (to === "IN_TRANSIT") {
    await prisma.order.update({ where: { id: orderId }, data: { status: "SHIPPING" } });
  }

  if (to === "DELIVERED") {
    await prisma.order.update({ where: { id: orderId }, data: { status: "DELIVERED", deliveredAt: new Date() } });
    // 새벽에 끝난 배송은 07:30 크론이 모아서 보낸다. 그 시각이 지난 뒤 처리된 건만 바로 보낸다
    if (deliveryId && pastArrivalNotifyTime()) {
      await notifyArrival(deliveryId).catch((err) => console.error("도착 알림 실패:", err));
    }
  }
}

/**
 * 배송 1건의 상태를 바꾸고 부수효과까지 처리한다.
 * photoUrl / memo 는 넘긴 경우에만 덮어쓴다.
 */
export async function transitionDelivery(
  deliveryId: string,
  to: DeliveryTransition,
  extra: { photoUrl?: string; memo?: string | null } = {},
) {
  const before = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: { order: { select: { id: true, user: { select: { id: true, name: true, phone: true } } } } },
  });
  if (!before) return null;

  const data: Record<string, unknown> = { status: to };
  if (extra.photoUrl !== undefined) data.photoUrl = extra.photoUrl;
  if (extra.memo !== undefined) data.memo = extra.memo;
  if (to === "IN_TRANSIT" && !before.startedAt) data.startedAt = new Date();
  // completedAt = 처리 시각 (완료·배송 못함 모두). 기사 화면·관리자 목록에 KST 로 표시한다
  if (to === "DELIVERED" || to === "FAILED") data.completedAt = new Date();
  if (to === "PENDING") { data.startedAt = null; data.completedAt = null; }

  const updated = await prisma.delivery.update({ where: { id: deliveryId }, data });
  await afterDeliveryStatusChange({
    orderId: before.order.id,
    deliveryId,
    user: before.order.user,
    from: before.status,
    to,
  });
  return updated;
}

/** KST 기준 오늘 (YYYY-MM-DD) — 새벽 3~6시에 배송하므로 "오늘"이 곧 배송일이다 */
export function todayKst(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 배송일 문자열을 관리자 화면과 같은 방식으로 [시작, 다음날) 범위로 만든다 */
export function dayRange(date: string): { start: Date; end: Date } | null {
  const start = new Date(date + "T00:00:00");
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}
