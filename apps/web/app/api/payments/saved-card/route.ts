import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@repo/db";
import { requireAuth } from "../../../lib/auth-guard";
import { chargeSavedCard, findSavedCard, savedCardLabel } from "../../../lib/saved-card";
import { completeOrderPayment } from "../../../lib/payment-complete";
import { groupOrderName, groupState, loadPaymentGroup } from "../../../lib/payment-group";

// GET: 내 등록 카드 (없으면 { card: null })
export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  const userId = (session!.user as { id: string }).id;
  const card = await findSavedCard(userId);
  if (!card) return NextResponse.json({ card: null });
  return NextResponse.json({
    card: { subscriptionId: card.subscriptionId, cardCompany: card.cardCompany, cardNumber: card.cardNumber, label: savedCardLabel(card) },
  });
}

// POST: 등록 카드로 주문 결제  { orderId }  (orderId = Order.id)
// 실패해도 주문은 PENDING 그대로 두어 클라이언트가 카드 결제창으로 이어갈 수 있게 한다.
export async function POST(request: Request) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const userId = (session!.user as { id: string }).id;
  const body = await request.json().catch(() => ({}));
  const orderId = String(body.orderId ?? "");
  if (!orderId) return NextResponse.json({ error: "orderId 필수" }, { status: 400 });

  try {
    // 결제 묶음(배송일이 다른 주문 N건) 전체를 한 번에 결제한다
    const group = await loadPaymentGroup(orderId);
    if (!group || group.orders.some((o) => o.userId !== userId)) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }
    const first = group.orders[0]!;
    const state = groupState(group.orders);
    if (state === "PAID") {
      return NextResponse.json({ success: true, alreadyPaid: true, orderNo: first.orderNo });
    }
    if (state !== "PENDING") {
      return NextResponse.json({ error: "이미 처리된 주문입니다." }, { status: 400 });
    }
    if (group.totalAmount <= 0) {
      return NextResponse.json({ error: "결제 금액이 없습니다." }, { status: 400 });
    }

    const card = await findSavedCard(userId);
    if (!card) return NextResponse.json({ error: "등록된 카드가 없습니다." }, { status: 404 });

    const items = await prisma.orderItem.findMany({
      where: { orderId: { in: group.orders.map((o) => o.id) } },
      select: { product: { select: { name: true } } },
    });
    const orderName = first.subscriptionId ? "W2O 구독" : groupOrderName(items.map((i) => i.product.name));

    const charged = await chargeSavedCard({ card, userId, orderNo: group.paymentOrderId, amount: group.totalAmount, orderName });
    if (!charged.ok) {
      return NextResponse.json({ error: charged.error, code: charged.code }, { status: 402 });
    }

    for (const o of group.orders) {
      try {
        await completeOrderPayment({
          orderNo: o.orderNo,
          amount: o.totalAmount,
          toss: charged.data,
          billingKey: card.billingKey,
          card: { cardCompany: card.cardCompany, cardNumber: card.cardNumber },
        });
      } catch (dbErr) {
        console.warn("DB 저장 실패 (등록 카드 결제는 완료됨):", o.orderNo);
        Sentry.captureException(dbErr, { level: "error", tags: { area: "payment", phase: "saved-card-db" }, extra: { orderNo: o.orderNo, paymentOrderId: group.paymentOrderId, paymentKey: charged.data.paymentKey } });
      }
    }

    return NextResponse.json({ success: true, orderNo: first.orderNo, orderNos: group.orders.map((o) => o.orderNo), card: savedCardLabel(card) });
  } catch (err) {
    console.error("POST /api/payments/saved-card error:", err);
    Sentry.captureException(err, { level: "error", tags: { area: "payment", phase: "saved-card" } });
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
