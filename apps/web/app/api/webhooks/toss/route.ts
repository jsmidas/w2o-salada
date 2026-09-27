import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { completeOrderPayment } from "../../../lib/payment-complete";
import { groupState, loadPaymentGroup } from "../../../lib/payment-group";
import { fetchTossPayment } from "../../../lib/toss-lookup";

/**
 * POST /api/webhooks/toss — 토스 결제 상태 웹훅 (PAYMENT_STATUS_CHANGED)
 *
 * 승인은 됐는데 우리 DB 마무리가 실패해 PENDING 으로 남은 주문을 되살리는 안전망.
 * 웹훅 본문은 믿지 않고 paymentKey 로 토스에 다시 조회한 결과만 쓴다 (서명 검증 대체).
 * 토스 개발자센터 > 웹훅에 https://www.w2o.co.kr/api/webhooks/toss 를 등록해야 동작한다.
 * 토스는 2xx 가 아니면 재전송하므로, 처리할 게 없어도 200 을 돌려준다.
 */
export async function POST(request: Request) {
  let body: { eventType?: string; data?: { paymentKey?: string; orderId?: string; status?: string } } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true, ignored: "invalid json" });
  }

  const paymentKey = body.data?.paymentKey;
  if (body.eventType !== "PAYMENT_STATUS_CHANGED" || !paymentKey) {
    return NextResponse.json({ ok: true, ignored: body.eventType ?? "no event" });
  }

  try {
    const payment = await fetchTossPayment(paymentKey);
    if (!payment || payment.status !== "DONE" || !payment.orderId) {
      return NextResponse.json({ ok: true, ignored: payment?.status ?? "lookup failed" });
    }

    const group = await loadPaymentGroup(payment.orderId);
    if (!group) return NextResponse.json({ ok: true, ignored: "unknown order" });
    if (groupState(group.orders) !== "PENDING") return NextResponse.json({ ok: true, ignored: "already handled" });
    if (group.totalAmount !== payment.totalAmount) {
      Sentry.captureMessage("토스 웹훅 금액 불일치", { level: "warning", tags: { area: "payment", phase: "webhook" }, extra: { orderId: payment.orderId, expected: group.totalAmount, received: payment.totalAmount } });
      return NextResponse.json({ ok: true, ignored: "amount mismatch" });
    }

    for (const o of group.orders) {
      await completeOrderPayment({ orderNo: o.orderNo, amount: o.totalAmount, toss: payment });
    }
    return NextResponse.json({ ok: true, completed: group.orders.map((o) => o.orderNo) });
  } catch (err) {
    Sentry.captureException(err, { level: "error", tags: { area: "payment", phase: "webhook" }, extra: { paymentKey } });
    // 우리 쪽 오류 — 토스가 다시 보내도록 5xx
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
