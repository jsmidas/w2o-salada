/**
 * 결제 묶음 — 배송일이 다른 상품을 한 번에 결제하기 위한 단위.
 *
 * 주문(Order)은 배송일 1개 = 1건으로 만든다(배송 리포트·생산 집계·기사 출력이 배송일로 조회하므로).
 * 장바구니에 배송일이 여러 개면 주문을 N 건 만들고 같은 paymentGroupNo 를 붙여, 토스에는
 * 그 그룹번호 하나로 합계 금액을 결제한다. 주문 1건이면 그룹 없이 orderNo 로 결제한다(기존과 동일).
 *
 * 토스 orderId ↔ 우리 식별자:  paymentGroupNo(있으면) / orderNo(없으면)
 */
import { prisma } from "@repo/db";
import type { OrderStatus } from "@prisma/client";

export type GroupOrder = {
  id: string;
  orderNo: string;
  userId: string;
  status: OrderStatus;
  totalAmount: number;
  paymentKey: string | null;
  subscriptionId: string | null;
  paymentGroupNo: string | null;
  deliveryDate: Date | null;
};

const SELECT = {
  id: true, orderNo: true, userId: true, status: true, totalAmount: true,
  paymentKey: true, subscriptionId: true, paymentGroupNo: true, deliveryDate: true,
} as const;

export type PaymentGroup = {
  orders: GroupOrder[];
  /** 토스에 넘기는 orderId — 그룹번호 또는 단일 주문번호 */
  paymentOrderId: string;
  totalAmount: number;
};

/**
 * Order.id, orderNo, paymentGroupNo 중 무엇이 오든 결제 단위를 찾는다.
 * (토스 successUrl 이 우리 id 와 토스 orderId 를 둘 다 실어 오므로 셋 다 받아준다)
 */
export async function loadPaymentGroup(ref: string): Promise<PaymentGroup | null> {
  if (!ref) return null;
  let base = await prisma.order.findUnique({ where: { id: ref }, select: SELECT });
  if (!base) base = await prisma.order.findUnique({ where: { orderNo: ref }, select: SELECT });

  let orders: GroupOrder[];
  if (base) {
    orders = base.paymentGroupNo
      ? await prisma.order.findMany({ where: { paymentGroupNo: base.paymentGroupNo }, select: SELECT, orderBy: { deliveryDate: "asc" } })
      : [base];
  } else {
    orders = await prisma.order.findMany({ where: { paymentGroupNo: ref }, select: SELECT, orderBy: { deliveryDate: "asc" } });
    if (orders.length === 0) return null;
  }
  const groupNo = orders[0]!.paymentGroupNo;
  return {
    orders,
    paymentOrderId: groupNo ?? orders[0]!.orderNo,
    totalAmount: orders.reduce((s, o) => s + o.totalAmount, 0),
  };
}

/** 묶음의 상태 — 전부 PAID / 전부 PENDING / 그 외 */
export function groupState(orders: GroupOrder[]): "PAID" | "PENDING" | "OTHER" {
  if (orders.every((o) => o.status === "PAID")) return "PAID";
  if (orders.every((o) => o.status === "PENDING")) return "PENDING";
  return "OTHER";
}

/** 결제창·알림에 쓰는 주문명 */
export function groupOrderName(names: string[], fallback = "W2O 주문"): string {
  const uniq = Array.from(new Set(names));
  if (uniq.length === 0) return fallback;
  return uniq.length > 1 ? `${uniq[0]} 외 ${uniq.length - 1}건` : uniq[0]!;
}
