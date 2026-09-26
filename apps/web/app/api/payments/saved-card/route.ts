import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@repo/db";
import { requireAuth } from "../../../lib/auth-guard";
import { chargeSavedCard, findSavedCard, savedCardLabel } from "../../../lib/saved-card";
import { completeOrderPayment } from "../../../lib/payment-complete";

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
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNo: true, userId: true, status: true, totalAmount: true, paymentKey: true, subscriptionId: true, items: { select: { product: { select: { name: true } } } } },
    });
    if (!order || order.userId !== userId) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }
    if (order.status === "PAID") {
      return NextResponse.json({ success: true, alreadyPaid: true, orderNo: order.orderNo });
    }
    if (order.status !== "PENDING") {
      return NextResponse.json({ error: "이미 처리된 주문입니다." }, { status: 400 });
    }
    if (order.totalAmount <= 0) {
      return NextResponse.json({ error: "결제 금액이 없습니다." }, { status: 400 });
    }

    const card = await findSavedCard(userId);
    if (!card) return NextResponse.json({ error: "등록된 카드가 없습니다." }, { status: 404 });

    const names = order.items.map((i) => i.product.name);
    const orderName = order.subscriptionId
      ? "W2O 구독"
      : names.length > 1 ? `${names[0]} 외 ${names.length - 1}건` : (names[0] ?? "W2O 주문");

    const charged = await chargeSavedCard({ card, userId, orderNo: order.orderNo, amount: order.totalAmount, orderName });
    if (!charged.ok) {
      return NextResponse.json({ error: charged.error, code: charged.code }, { status: 402 });
    }

    try {
      await completeOrderPayment({
        orderNo: order.orderNo,
        amount: order.totalAmount,
        toss: charged.data,
        billingKey: card.billingKey,
        card: { cardCompany: card.cardCompany, cardNumber: card.cardNumber },
      });
    } catch (dbErr) {
      console.warn("DB 저장 실패 (등록 카드 결제는 완료됨):", order.orderNo);
      Sentry.captureException(dbErr, { level: "error", tags: { area: "payment", phase: "saved-card-db" }, extra: { orderNo: order.orderNo, paymentKey: charged.data.paymentKey } });
    }

    return NextResponse.json({ success: true, orderNo: order.orderNo, card: savedCardLabel(card) });
  } catch (err) {
    console.error("POST /api/payments/saved-card error:", err);
    Sentry.captureException(err, { level: "error", tags: { area: "payment", phase: "saved-card" } });
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
