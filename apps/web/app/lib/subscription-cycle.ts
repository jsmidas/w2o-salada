/**
 * 구독 청구 주기(롤링) — 달력 월이 아니라 "첫 배송일부터 N주"
 *
 *   주기 = [startDate, endDate)  endDate = startDate + weeks*7일
 *   결제일 = endDate - 2일 06:00 (다음 주기 첫 배송 이틀 전, 갱신 알림은 그 7일 전)
 *   금액   = 그 주기 안의 실제 배송일 × 그날 선택 상품가 − 크레딧(결제 후 건너뛴 배송분)
 *
 * 금액은 매 주기 달라질 수 있다. 토스 빌링키 결제는 매번 금액을 지정하므로 문제없고,
 * 대신 결제 7일 전 알림에 예정 금액을 반드시 넣는다.
 */
import { prisma } from "@repo/db";
import { autoAssignForDelivery, slotsForDate, type SlotMap, type WeekdaySlotMap } from "./auto-assign";

export const CYCLE_WEEK_OPTIONS = [2, 4, 6, 8] as const;
export const BILLING_LEAD_DAYS = 2;

const DAY = 86400000;

export function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function cycleWindow(start: Date, weeks: number): { startDate: Date; endDate: Date } {
  const startDate = utcMidnight(start);
  return { startDate, endDate: new Date(startDate.getTime() + weeks * 7 * DAY) };
}

export function billingDateFor(endDate: Date): Date {
  return new Date(utcMidnight(endDate).getTime() - BILLING_LEAD_DAYS * DAY);
}

export type CycleItem = { deliveryDate: Date; productId: string; quantity: number; unitPrice: number };

/**
 * 다음 주기의 배송일별 선택을 미리 계산한다 (DB 쓰기 없음).
 * AUTO/MANUAL 모두 슬롯 기준 자동 배정으로 채우고, MANUAL 고객은 마감 전에 바꾸면 된다.
 */
export async function previewCycle(params: {
  subscriptionId: string;
  slots: SlotMap;
  weekdaySlots?: WeekdaySlotMap | null; // 요일별 구성 — 있는 요일은 slots 대신 이걸 쓴다
  startDate: Date;
  endDate: Date;
}): Promise<{ items: CycleItem[]; amount: number; deliveryDates: Date[] }> {
  const { subscriptionId, slots: baseSlots, weekdaySlots, startDate, endDate } = params;
  const days = await prisma.deliveryCalendar.findMany({
    where: { isActive: true, date: { gte: startDate, lt: endDate } },
    orderBy: { date: "asc" },
    select: { date: true },
  });
  const items: CycleItem[] = [];
  const productIds = new Set<string>();
  for (const d of days) {
    const slots = slotsForDate(baseSlots, weekdaySlots, d.date);
    const r = await autoAssignForDelivery({ subscriptionId, slots, deliveryDate: d.date });
    for (const f of r.filled) {
      items.push({ deliveryDate: d.date, productId: f.productId, quantity: 1, unitPrice: 0 });
      productIds.add(f.productId);
    }
  }
  if (productIds.size > 0) {
    const prices = await prisma.product.findMany({ where: { id: { in: [...productIds] } }, select: { id: true, price: true } });
    const priceOf = new Map(prices.map((p) => [p.id, p.price]));
    for (const it of items) it.unitPrice = priceOf.get(it.productId) ?? 0;
  }
  const amount = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
  return { items, amount, deliveryDates: days.map((d) => d.date) };
}

/** 이 구독의 다음 주기 창 — 마지막 주기의 endDate 부터. 주기 정보가 없는 레거시 구독은 다음 배송일부터 */
export async function nextCycleWindow(subscription: { id: string; cycleWeeks: number; nextDeliveryDate: Date | null }) {
  const last = await prisma.subscriptionPeriod.findFirst({
    where: { subscriptionId: subscription.id, endDate: { not: null } },
    orderBy: { endDate: "desc" },
    select: { endDate: true },
  });
  const start = last?.endDate ?? subscription.nextDeliveryDate ?? new Date();
  return cycleWindow(start, subscription.cycleWeeks || 4);
}

/** 배송일이 속한 주기. 없으면 다음 주기(PENDING)를 만들어 돌려준다 — 다음 배송 미리보기용 */
export async function getOrCreatePeriodForDate(subscription: { id: string; cycleWeeks: number; nextDeliveryDate: Date | null }, date: Date) {
  const d = utcMidnight(date);
  const covering = await prisma.subscriptionPeriod.findFirst({
    where: { subscriptionId: subscription.id, startDate: { lte: d }, endDate: { gt: d } },
    orderBy: { startDate: "desc" },
  });
  if (covering) return covering;

  // 레거시(연·월만 있는) 주기
  const legacy = await prisma.subscriptionPeriod.findFirst({
    where: { subscriptionId: subscription.id, startDate: null, year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 },
  });
  if (legacy) return legacy;

  const { startDate, endDate } = await nextCycleWindow(subscription);
  const win = d >= startDate && d < endDate ? { startDate, endDate } : cycleWindow(d, subscription.cycleWeeks || 4);
  return prisma.subscriptionPeriod.create({
    data: {
      subscriptionId: subscription.id,
      year: win.startDate.getUTCFullYear(),
      month: win.startDate.getUTCMonth() + 1,
      startDate: win.startDate,
      endDate: win.endDate,
      weeks: subscription.cycleWeeks || 4,
      status: "PENDING",
      totalAmount: 0,
    },
  });
}

export function formatCycle(startDate: Date | string | null, endDate: Date | string | null, weeks?: number | null): string {
  if (!startDate || !endDate) return "";
  const s = new Date(startDate), e = new Date(new Date(endDate).getTime() - DAY);
  const f = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  return `${f(s)}~${f(e)}${weeks ? ` (${weeks}주)` : ""}`;
}
