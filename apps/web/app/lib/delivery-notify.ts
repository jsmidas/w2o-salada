/**
 * 배송 도착 알림톡
 *
 * 새벽 3~6시에 배송이 끝나지만 그 시각에 알림을 보내지는 않는다 —
 * 잠든 사람을 깨우는 알림은 득보다 실이 크다. 아침 07:30 크론이 그날 배송분을
 * 모아서 보내고, 배송 사진을 볼 수 있는 /delivery/<토큰> 주소를 버튼에 담는다.
 *
 * 07:30 이 지난 뒤에 완료 처리된 건(지연·재배송)은 크론을 기다리면 하루가 밀리므로
 * 그 자리에서 바로 보낸다. 어느 경로로 보내든 arrivedNotifiedAt 로 중복을 막는다.
 */
import { prisma } from "@repo/db";
import { ensureDeliveryToken } from "./delivery-token";
import { sendAlimtalk, TEMPLATE } from "./notification";

/** 도착 알림을 보내는 시각 (KST) */
export const ARRIVAL_NOTIFY_HOUR = 7;
export const ARRIVAL_NOTIFY_MINUTE = 30;

/** 지금이 KST 기준 07:30 을 지났는가 */
export function pastArrivalNotifyTime(now: Date = new Date()): boolean {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const minutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  return minutes >= ARRIVAL_NOTIFY_HOUR * 60 + ARRIVAL_NOTIFY_MINUTE;
}

type NotifyResult = "sent" | "skipped" | "failed";

/**
 * 배송 1건의 도착 알림을 보낸다. 이미 보냈거나 완료 상태가 아니면 아무것도 하지 않는다.
 * 알림톡이 나간 뒤에만 arrivedNotifiedAt 을 찍으므로, 실패한 건은 다음 크론이 다시 집는다.
 */
export async function notifyArrival(deliveryId: string): Promise<NotifyResult> {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    select: {
      id: true,
      status: true,
      arrivedNotifiedAt: true,
      order: { select: { user: { select: { id: true, name: true, phone: true } } } },
    },
  });
  if (!delivery) return "skipped";
  if (delivery.status !== "DELIVERED") return "skipped";
  if (delivery.arrivedNotifiedAt) return "skipped";

  const user = delivery.order.user;
  if (!user.phone) return "skipped";

  const token = await ensureDeliveryToken(delivery.id);
  if (!token) return "failed";

  // 이미 보낸 건을 다시 집지 않도록 먼저 선점한다. 동시에 두 요청이 들어와도 한쪽만 이긴다.
  const claimed = await prisma.delivery.updateMany({
    where: { id: delivery.id, arrivedNotifiedAt: null },
    data: { arrivedNotifiedAt: new Date() },
  });
  if (claimed.count === 0) return "skipped";

  const result = await sendAlimtalk({
    userId: user.id,
    to: user.phone,
    templateCode: TEMPLATE.DELIVERY_DONE,
    variables: { 고객명: user.name, 링크: token },
  });

  if (!result.ok) {
    // 못 보냈으면 표시를 되돌려 다음 크론이 다시 시도하게 둔다
    await prisma.delivery
      .update({ where: { id: delivery.id }, data: { arrivedNotifiedAt: null } })
      .catch(() => {});
    return "failed";
  }
  return "sent";
}

/**
 * 아직 도착 알림이 나가지 않은 완료 배송을 모아 보낸다 (07:30 크론).
 * 어제 새벽 배송까지 집도록 범위를 이틀로 잡되, 그보다 오래된 건은 건드리지 않는다.
 */
export async function notifyArrivalsDue(now: Date = new Date()): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  const since = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const targets = await prisma.delivery.findMany({
    where: {
      status: "DELIVERED",
      arrivedNotifiedAt: null,
      completedAt: { gte: since },
    },
    select: { id: true },
    orderBy: { completedAt: "asc" },
    take: 500,
  });

  const tally = { sent: 0, failed: 0, skipped: 0 };
  for (const t of targets) {
    const r = await notifyArrival(t.id).catch(() => "failed" as NotifyResult);
    tally[r]++;
  }
  return tally;
}
