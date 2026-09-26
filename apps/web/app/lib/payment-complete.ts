/**
 * 결제 승인 뒤 공통 후처리 — 토스 결제창 승인(/api/payments)과 등록 카드 결제(/api/payments/saved-card)가 같이 쓴다.
 *
 * 하는 일: 주문 PAID + 결제 기록 + ("이번 주기만"/자동 갱신) 구독·주기 활성화 + 주문 완료 알림톡.
 * 등록 카드로 자동 갱신 구독을 시작한 경우 billingKey·카드 표시 정보를 새 구독에 복사한다.
 */
import { prisma } from "@repo/db";
import { sendAlimtalkSafe, TEMPLATE } from "./notification";

export type TossPaymentData = {
  paymentKey?: string;
  method?: string;
  receipt?: { url?: string };
  [key: string]: unknown;
};

export type CompletePaymentParams = {
  orderNo: string;
  amount: number;
  toss: TossPaymentData;
  /** 암호화된 빌링키 — 등록 카드 결제일 때만 */
  billingKey?: string | null;
  card?: { cardCompany: string | null; cardNumber: string | null } | null;
};

function formatDeliveryDate(d: Date | null): string {
  if (!d) return "다음";
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;
}

export async function completeOrderPayment(params: CompletePaymentParams) {
  const { orderNo, amount, toss, billingKey, card } = params;
  const now = new Date();

  const order = await prisma.order.update({
    where: { orderNo },
    data: { status: "PAID", paymentKey: toss.paymentKey ?? null, paidAt: now },
    include: { user: true },
  });

  if (order.subscriptionId) {
    const sub = await prisma.subscription.findUnique({
      where: { id: order.subscriptionId },
      select: { autoRenew: true, billingKey: true },
    });
    // 자동 갱신 구독인데 아직 빌링키가 없으면(등록 카드로 시작) 그 카드를 이 구독에 붙인다
    const attachCard = Boolean(sub?.autoRenew && !sub.billingKey && billingKey);
    await prisma.subscription.update({
      where: { id: order.subscriptionId },
      data: {
        status: "ACTIVE",
        startedAt: now,
        ...(attachCard
          ? { billingKey, cardCompany: card?.cardCompany ?? null, cardNumber: card?.cardNumber ?? null }
          : {}),
      },
    });
    await prisma.subscriptionPeriod.updateMany({
      where: { subscriptionId: order.subscriptionId, status: "PENDING", OR: [{ orderId: order.id }, { orderId: null }] },
      data: { status: "PAID", paidAt: now, orderId: order.id },
    });
  }

  await prisma.payment.create({
    data: {
      orderId: order.id,
      paymentKey: toss.paymentKey ?? null,
      method: toss.method ?? null,
      amount,
      status: "DONE",
      billingKey: billingKey ?? null,
      receiptUrl: toss.receipt?.url ?? null,
      rawResponse: JSON.stringify(toss),
    },
  });

  if (order.user.phone) {
    await sendAlimtalkSafe({
      userId: order.user.id,
      to: order.user.phone,
      templateCode: TEMPLATE.ORDER_PAID,
      variables: {
        고객명: order.user.name,
        주문번호: order.orderNo,
        배송일: formatDeliveryDate(order.deliveryDate),
      },
    });
  }

  return order;
}
