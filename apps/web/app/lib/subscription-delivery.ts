/**
 * 구독 배송 건 생성 — "구독은 배송일마다 배송 건(Order)이 따로 있다"
 *
 * 월 결제 주문(type SUBSCRIPTION)은 돈의 기록이고, 배송·피킹·기사 출력은 배송일별
 * 배송 건(type SUBSCRIPTION_DELIVERY, 금액 0)을 본다. 그래야
 *   - 두 번째 배송일부터 구독 고객이 코스 편성에서 빠지지 않고
 *   - 첫 배송일에 한 달치 품목이 한꺼번에 실리지 않으며
 *   - 생산 집계가 선택분과 주문 품목을 이중으로 세지 않는다.
 *
 * 마감(전날 14시) 전에는 고객이 메뉴를 바꿀 수 있으므로 호출될 때마다 현재 선택분으로 품목을 다시 맞추고,
 * 마감 후에는 그대로 둔다(작업지시서 확정). 멱등이라 리포트·집계가 열릴 때마다 불러도 된다.
 */
import { prisma } from "@repo/db";
import { isOrderable } from "./cutoff";
import { pickAndJudgeAddress } from "./address-resolve";
import { suspensionsOn, type Suspension } from "./delivery-zone";
import { PAID_PERIOD_STATUSES } from "./subscription-cycle";

export const DELIVERY_ORDER_TYPE = "SUBSCRIPTION_DELIVERY" as const;

/** 배송 관리·기사 출력이 보는 주문 유형 (월 결제 주문은 제외) */
export const DELIVERABLE_ORDER_TYPES = ["SINGLE", DELIVERY_ORDER_TYPE] as const;

function dayRange(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start.getTime() + 86400000);
  return { start, end };
}

function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function ensureSubscriptionDeliveries(date: Date): Promise<{ created: number; updated: number; removed: number }> {
  const { start, end } = dayRange(date);
  // 캘린더에서 꺼진 날짜(휴일)는 배송 건을 만들지 않는다
  const day = await prisma.deliveryCalendar.findUnique({ where: { date: start }, select: { isActive: true } });
  if (day && !day.isActive) return { created: 0, updated: 0, removed: 0 };
  const editable = isOrderable(ymd(start)); // 마감 전이면 선택분 변경을 따라간다

  const selections = await prisma.subscriptionSelection.findMany({
    where: {
      deliveryDate: { gte: start, lt: end },
      subscriptionPeriod: {
        // 결제된 주기만 — 미결제(PENDING) 주기 선택분이 공짜 배송으로 나가던 구멍
        status: { in: [...PAID_PERIOD_STATUSES] },
        subscription: { status: { notIn: ["CANCELLED", "PAUSED"] } },
      },
    },
    include: {
      product: { select: { id: true, price: true } },
      subscriptionPeriod: { select: { subscription: { select: { id: true, userId: true, addressId: true } } } },
    },
  });

  // 구독별 품목 합치기
  const bySub = new Map<string, { userId: string; addressId: string | null; items: Map<string, { quantity: number; unitPrice: number }> }>();
  for (const s of selections) {
    const sub = s.subscriptionPeriod.subscription;
    let entry = bySub.get(sub.id);
    if (!entry) { entry = { userId: sub.userId, addressId: sub.addressId, items: new Map() }; bySub.set(sub.id, entry); }
    const cur = entry.items.get(s.productId);
    const unitPrice = s.unitPrice ?? s.product.price;
    if (cur) cur.quantity += s.quantity; else entry.items.set(s.productId, { quantity: s.quantity, unitPrice });
  }

  const existing = await prisma.order.findMany({
    where: { type: DELIVERY_ORDER_TYPE, deliveryDate: { gte: start, lt: end } },
    include: { items: true },
  });
  const existingBySub = new Map(existing.filter((o) => o.subscriptionId).map((o) => [o.subscriptionId!, o]));

  let created = 0, updated = 0, removed = 0;
  // 이 날짜의 권역별 배송 중지 — 중지된 권역의 배송 건은 보류로 만들어 코스에서 뺀다 (한 번만 읽는다)
  const suspension = await suspensionsOn(start);
  const suspendedFor = (zoneId: string | null): Suspension | null => suspension.all ?? (zoneId ? suspension.byZone.get(zoneId) ?? null : null);

  for (const [subId, entry] of bySub) {
    const itemsData = [...entry.items].map(([productId, v]) => ({ productId, quantity: v.quantity, unitPrice: v.unitPrice, totalPrice: 0 }));
    const cur = existingBySub.get(subId);

    if (!cur) {
      const judged = await pickAndJudgeAddress(entry.userId, entry.addressId);
      const addr = judged?.address ?? null;
      let hold = judged?.hold ?? { deliveryHold: true, deliveryHoldReason: "배송지 없음" };
      const susp = suspendedFor(addr?.zoneId ?? null);
      if (susp && !hold.deliveryHold) hold = { deliveryHold: true, deliveryHoldReason: `권역 배송 중지 — ${susp.reason}` };
      try {
      await prisma.order.create({
        data: {
          orderNo: `W2O-${ymd(start).replace(/-/g, "")}-S${subId.slice(-4).toUpperCase()}`,
          userId: entry.userId,
          subscriptionId: subId,
          addressId: addr?.id ?? null,
          type: DELIVERY_ORDER_TYPE,
          status: "PAID", // 배송 대상으로 잡히는 상태. 실제 결제는 월 주문에 있다
          totalAmount: 0,
          deliveryFee: 0,
          deliveryDate: start,
          paidAt: new Date(),
          deliveryHold: hold.deliveryHold,
          deliveryHoldReason: hold.deliveryHoldReason,
          items: { create: itemsData },
        },
      });
      created++;
      } catch (err) {
        // 리포트와 인쇄 화면이 동시에 열리면 같은 배송 건을 두 요청이 만든다 — 유니크 위반은 "이미 있음" 으로 넘긴다
        if ((err as { code?: string }).code !== "P2002") throw err;
      }
      continue;
    }

    if (!editable || ["SHIPPING", "DELIVERED", "CANCELLED", "REFUNDED"].includes(cur.status)) continue;

    // 마감 전: 품목이 달라졌으면 현재 선택분으로 교체
    const same =
      cur.items.length === itemsData.length &&
      itemsData.every((it) => cur.items.some((c) => c.productId === it.productId && c.quantity === it.quantity));
    if (!same) {
      await prisma.$transaction([
        prisma.orderItem.deleteMany({ where: { orderId: cur.id } }),
        prisma.orderItem.createMany({ data: itemsData.map((it) => ({ ...it, orderId: cur.id })) }),
      ]);
      updated++;
    }
  }

  // 마감 전: 선택분이 사라진(해지·일시정지·건너뛰기) 배송 건은 제거
  if (editable) {
    for (const o of existing) {
      if (o.subscriptionId && !bySub.has(o.subscriptionId) && !["SHIPPING", "DELIVERED"].includes(o.status)) {
        await prisma.delivery.deleteMany({ where: { orderId: o.id } });
        await prisma.orderItem.deleteMany({ where: { orderId: o.id } });
        await prisma.order.delete({ where: { id: o.id } });
        removed++;
      }
    }
  }

  return { created, updated, removed };
}
