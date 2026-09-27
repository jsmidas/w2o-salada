/**
 * 주문 취소·환불 — 토스 결제 취소 API 를 실제로 호출한 뒤에만 DB 상태를 바꾼다.
 *
 * 2026-09-28 점검 전까지는 DB 상태만 REFUNDED 로 바꾸고 "환불 완료" 를 표시해
 * 카드 청구가 그대로 남았다. 이제 순서는 토스 취소 성공 → DB 갱신(트랜잭션).
 *
 * - PAID → CANCELLED (관리자 "취소" 버튼): 전액 취소. 돈은 이 시점에 돌아간다
 * - CANCELLED → REFUNDED: 장부 정리만 (이미 취소된 결제는 다시 부르지 않는다)
 * - PAID → REFUNDED (환불 API): 전액 취소 후 바로 REFUNDED
 * - 결제 기록이 없거나 0원(크레딧 전액 차감)이면 토스 호출 없이 상태만 바꾼다
 */
import { prisma } from "@repo/db";
import type { OrderStatus, PaymentStatus } from "@prisma/client";

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY ?? "";

export class RefundError extends Error {
  constructor(message: string, public readonly code?: string, public readonly status = 502) {
    super(message);
  }
}

type TossCancelResponse = { status?: string; cancels?: unknown[]; message?: string; code?: string; [k: string]: unknown };

/** 토스 결제 취소 (전액 또는 cancelAmount). 이미 취소된 결제는 성공으로 본다 */
export async function cancelTossPayment(params: {
  paymentKey: string;
  cancelReason: string;
  cancelAmount?: number;
  idempotencyKey: string;
}): Promise<{ data: TossCancelResponse; alreadyCancelled: boolean }> {
  if (!TOSS_SECRET_KEY) throw new RefundError("토스 시크릿 키가 설정되지 않았습니다.", "NO_SECRET", 500);
  const { paymentKey, cancelReason, cancelAmount, idempotencyKey } = params;

  const res = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(TOSS_SECRET_KEY + ":").toString("base64")}`,
      "Content-Type": "application/json",
      // 같은 취소를 두 번 눌러도 토스가 한 번만 처리한다
      "Idempotency-Key": idempotencyKey.slice(0, 300),
    },
    body: JSON.stringify({ cancelReason, ...(cancelAmount !== undefined ? { cancelAmount } : {}) }),
  });
  const data = (await res.json().catch(() => ({}))) as TossCancelResponse;
  if (res.ok) return { data, alreadyCancelled: false };
  if (data.code === "ALREADY_CANCELED_PAYMENT") return { data, alreadyCancelled: true };
  throw new RefundError(`토스 결제 취소 실패: ${data.message ?? res.status}`, data.code);
}

/**
 * 주문의 결제를 취소하고 상태를 finalStatus 로 바꾼다.
 * 토스 호출이 실패하면 RefundError 를 던지고 DB 는 건드리지 않는다.
 */
export async function refundOrder(params: {
  orderId: string;
  reason: string;
  finalStatus: Extract<OrderStatus, "CANCELLED" | "REFUNDED">;
}): Promise<{ refundedAmount: number; tossCalled: boolean }> {
  const { orderId, reason, finalStatus } = params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!order) throw new RefundError("주문을 찾을 수 없습니다.", "NOT_FOUND", 404);

  // 돈이 실제로 나간 결제: 최신 DONE 건. 이미 취소·환불된 건이면 토스를 다시 부르지 않는다
  const done = order.payments.find((p) => p.status === "DONE");
  const paymentKey = done?.paymentKey ?? order.paymentKey ?? null;
  const refundable = done && done.amount > 0 && paymentKey;

  let tossRaw: string | null = null;
  let tossCalled = false;
  if (refundable) {
    // 배송일이 다른 주문을 묶어 한 번에 결제했으면 이 주문 몫만 부분 취소한다 (다른 배송일 주문은 살아 있다)
    const r = await cancelTossPayment({
      paymentKey: paymentKey!,
      cancelReason: reason,
      ...(order.paymentGroupNo ? { cancelAmount: done.amount } : {}),
      idempotencyKey: `cancel-${order.id}-${done.id}`,
    });
    tossRaw = JSON.stringify(r.data);
    tossCalled = !r.alreadyCancelled;
  }

  const paymentStatus: PaymentStatus = finalStatus === "REFUNDED" ? "REFUNDED" : "CANCELLED";
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { status: finalStatus } });
    if (done) {
      await tx.payment.update({
        where: { id: done.id },
        data: { status: paymentStatus, cancelReason: reason, cancelledAt: now, ...(tossRaw ? { rawResponse: tossRaw } : {}) },
      });
    } else {
      // 이미 CANCELLED 로 바뀐 결제를 REFUNDED 로 정리하는 경우
      await tx.payment.updateMany({
        where: { orderId: order.id, status: "CANCELLED" },
        data: { status: paymentStatus },
      });
    }
  });

  return { refundedAmount: refundable ? done.amount : 0, tossCalled };
}
