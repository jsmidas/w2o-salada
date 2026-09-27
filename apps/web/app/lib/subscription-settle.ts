/**
 * 구독 정산 — 일시정지·해지 때 "이미 결제했지만 아직 안 나간 배송분"을 어떻게 할지.
 *
 *  - 크레딧 적립(CREDIT): 남은 배송분 금액을 creditBalance 에 쌓아 다음 자동결제에서 차감 (건너뛰기와 같은 방식)
 *  - 주기 연장(EXTEND):   일시정지 동안 놓친 배송을 재개 후 주기 뒤쪽 배송일로 옮기고 주기 종료일·결제일을 그만큼 민다
 *  - 해지:                남은 배송분 + 크레딧을 환불 "신청" 으로 남긴다. 돈은 담당자가 검토(수수료)한 뒤 토스 부분 취소로 돌려준다
 *
 * "남은 배송분" = 결제된 주기의 선택분 중 아직 주문 마감이 지나지 않은 날짜. 마감이 지난 날짜는 이미 조리에 들어가 배송된다.
 */
import { prisma } from "@repo/db";
import type { Prisma } from "@prisma/client";
import { cutoffAt, firstOrderableDate } from "./cutoff";
import { billingDateFor, PAID_PERIOD_STATUSES, utcMidnight } from "./subscription-cycle";

const DAY = 86400000;

/** 아직 바꿀 수 있는 가장 이른 배송일 (UTC 자정) */
export function settleFloor(): Date {
  return new Date(`${firstOrderableDate()}T00:00:00.000Z`);
}

type Tx = Prisma.TransactionClient;

export type RemainingRow = {
  id: string;
  deliveryDate: Date;
  quantity: number;
  unitPrice: number | null;
  product: { price: number };
  subscriptionPeriod: { id: string; orderId: string | null; endDate: Date | null };
};

export type Remaining = { rows: RemainingRow[]; amount: number; dates: Date[]; count: number; orderId: string | null };

/** 결제된 주기에서 아직 마감 전인 선택분과 금액 */
export async function remainingPaidSelections(subscriptionId: string): Promise<Remaining> {
  const floor = settleFloor();
  const rows = await prisma.subscriptionSelection.findMany({
    where: {
      deliveryDate: { gte: floor },
      subscriptionPeriod: { subscriptionId, status: { in: [...PAID_PERIOD_STATUSES] } },
    },
    select: {
      id: true, deliveryDate: true, quantity: true, unitPrice: true,
      product: { select: { price: true } },
      subscriptionPeriod: { select: { id: true, orderId: true, endDate: true } },
    },
    orderBy: { deliveryDate: "asc" },
  });
  const amount = rows.reduce((s, r) => s + (r.unitPrice ?? r.product.price) * r.quantity, 0);
  const dates = Array.from(new Set(rows.map((r) => r.deliveryDate.getTime()))).map((t) => new Date(t));
  // 돈이 나간 주문: 가장 최근 결제 주기의 주문 (환불 부분 취소 대상)
  const orderId = rows.length > 0 ? rows[rows.length - 1]!.subscriptionPeriod.orderId : null;
  return { rows, amount, dates, count: dates.length, orderId };
}

/** 선택분과 아직 안 나간 배송 건 제거 */
async function removeRows(tx: Tx, subscriptionId: string, rows: RemainingRow[]) {
  if (rows.length === 0) return;
  await tx.subscriptionSelection.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  const dates = Array.from(new Set(rows.map((r) => r.deliveryDate.getTime()))).map((t) => new Date(t));
  const orders = await tx.order.findMany({
    where: { subscriptionId, type: "SUBSCRIPTION_DELIVERY", deliveryDate: { in: dates }, status: { in: ["PENDING", "PAID"] } },
    select: { id: true },
  });
  for (const o of orders) {
    await tx.delivery.deleteMany({ where: { orderId: o.id } });
    await tx.orderItem.deleteMany({ where: { orderId: o.id } });
    await tx.order.delete({ where: { id: o.id } });
  }
}

/** 일시정지(크레딧): 남은 배송분을 지우고 그 금액을 크레딧으로 */
export async function settleAsCredit(subscriptionId: string): Promise<{ amount: number; count: number }> {
  const r = await remainingPaidSelections(subscriptionId);
  await prisma.$transaction(async (tx) => {
    await removeRows(tx, subscriptionId, r.rows);
    if (r.amount > 0) {
      await tx.subscription.update({ where: { id: subscriptionId }, data: { creditBalance: { increment: r.amount } } });
    }
  });
  return { amount: r.amount, count: r.count };
}

/** 해지: 남은 배송분을 지우고 금액만 돌려준다 (환불 신청 생성은 호출부에서) */
export async function removeRemainingForCancel(subscriptionId: string): Promise<Remaining> {
  const r = await remainingPaidSelections(subscriptionId);
  await prisma.$transaction((tx) => removeRows(tx, subscriptionId, r.rows));
  return r;
}

/**
 * 재개(주기 연장): 일시정지 동안 놓친 배송을 주기 뒤 활성 배송일로 옮긴다.
 * "놓친 배송" = 정지 시작 시점에 아직 마감 전이었고(조리 안 됨), 지금은 마감이 지난 날짜의 선택분.
 * 정지 전에 이미 마감된 날짜는 배송이 나갔으므로 제외한다.
 */
export async function extendAfterPause(subscription: { id: string; pausedAt: Date | null }): Promise<{ moved: number; newEndDate: Date | null }> {
  const { id: subscriptionId, pausedAt } = subscription;
  if (!pausedAt) return { moved: 0, newEndDate: null };
  const floor = settleFloor();
  const pausedFrom = utcMidnight(pausedAt);

  const candidates = await prisma.subscriptionSelection.findMany({
    where: {
      deliveryDate: { gte: pausedFrom, lt: floor },
      subscriptionPeriod: { subscriptionId, status: { in: [...PAID_PERIOD_STATUSES] } },
    },
    select: { id: true, deliveryDate: true, subscriptionPeriodId: true, subscriptionPeriod: { select: { endDate: true } } },
    orderBy: { deliveryDate: "asc" },
  });
  // 정지 시점에 마감 전이었던 날짜만
  const missed = candidates.filter((c) => cutoffAt(c.deliveryDate.toISOString().slice(0, 10)) > pausedAt);
  if (missed.length === 0) return { moved: 0, newEndDate: null };

  const periodId = missed[0]!.subscriptionPeriodId;
  const missedDates = Array.from(new Set(missed.map((m) => m.deliveryDate.getTime()))).sort((a, b) => a - b).map((t) => new Date(t));

  // 옮길 곳: 그 주기의 마지막 선택일 이후(그리고 주문 가능일 이후)의 활성 배송일
  const last = await prisma.subscriptionSelection.aggregate({ where: { subscriptionPeriodId: periodId }, _max: { deliveryDate: true } });
  const after = new Date(Math.max(last._max.deliveryDate?.getTime() ?? 0, floor.getTime() - DAY));
  const targets = await prisma.deliveryCalendar.findMany({
    where: { isActive: true, date: { gt: after } },
    orderBy: { date: "asc" },
    take: missedDates.length,
    select: { date: true },
  });
  if (targets.length === 0) return { moved: 0, newEndDate: null };

  let moved = 0;
  let newEndDate: Date | null = null;
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < targets.length; i++) {
      const from = missedDates[i]!;
      const to = targets[i]!.date;
      const r = await tx.subscriptionSelection.updateMany({ where: { subscriptionPeriodId: periodId, deliveryDate: from }, data: { deliveryDate: to } });
      moved += r.count;
      // 놓친 날짜에 남아 있던(배송 안 나간) 배송 건 정리
      const stale = await tx.order.findMany({ where: { subscriptionId, type: "SUBSCRIPTION_DELIVERY", deliveryDate: from, status: { in: ["PENDING", "PAID"] } }, select: { id: true } });
      for (const o of stale) {
        await tx.delivery.deleteMany({ where: { orderId: o.id } });
        await tx.orderItem.deleteMany({ where: { orderId: o.id } });
        await tx.order.delete({ where: { id: o.id } });
      }
    }
    // 주기 종료일(exclusive)·결제일을 마지막 이동 배송일 다음날로
    const lastTarget = targets[targets.length - 1]!.date;
    const endDate = new Date(utcMidnight(lastTarget).getTime() + DAY);
    const period = await tx.subscriptionPeriod.findUnique({ where: { id: periodId }, select: { endDate: true } });
    if (!period?.endDate || period.endDate < endDate) {
      await tx.subscriptionPeriod.update({ where: { id: periodId }, data: { endDate } });
      await tx.subscription.update({ where: { id: subscriptionId }, data: { nextBillingDate: billingDateFor(endDate) } });
      newEndDate = endDate;
    }
  });
  return { moved, newEndDate };
}

export const REFUND_REASON_LABELS: Record<string, string> = {
  TASTE: "맛·품질",
  DELIVERY: "배송",
  PRICE: "가격",
  PERSONAL: "개인 사정",
  HEALTH: "건강·식단 변화",
  COMPETITOR: "다른 서비스",
  OTHER: "기타",
};
