import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import type { RefundReason } from "@prisma/client";
import { requireAuth } from "../../../../lib/auth-guard";
import { removeRemainingForCancel } from "../../../../lib/subscription-settle";
import { feeFor, getRefundFeePercent } from "../../../../lib/refund-policy";

const REASONS: RefundReason[] = ["TASTE", "DELIVERY", "PRICE", "PERSONAL", "HEALTH", "COMPETITOR", "OTHER"];

/**
 * POST: 구독 해지  { reason: RefundReason, reasonDetail?: string }
 * 남은 결제 배송분 + 크레딧은 환불 "신청" 으로 남는다. 담당자가 사유를 보고 수수료를 정한 뒤 처리한다 (자동 환불 없음).
 * 사유는 이탈 원인 통계에 쓰므로 필수.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const userId = (session!.user as { id: string }).id;
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { reason?: string; reasonDetail?: string };
    const reason = REASONS.includes(body.reason as RefundReason) ? (body.reason as RefundReason) : null;
    if (!reason) {
      return NextResponse.json({ error: "해지 사유를 선택해주세요." }, { status: 400 });
    }
    const reasonDetail = (body.reasonDetail ?? "").toString().trim().slice(0, 500) || null;

    const subscription = await prisma.subscription.findUnique({ where: { id } });
    if (!subscription || subscription.userId !== userId) {
      return NextResponse.json({ error: "구독을 찾을 수 없습니다." }, { status: 404 });
    }
    if (subscription.status === "CANCELLED") {
      return NextResponse.json({ error: "이미 해지된 구독입니다." }, { status: 400 });
    }

    // 남은 배송분 제거 → 금액 산정. 크레딧도 해지 후엔 쓸 데가 없으니 함께 신청에 포함
    const remaining = await removeRemainingForCancel(id);
    const credit = subscription.creditBalance;
    const requestedAmount = remaining.amount + credit;
    const now = new Date();

    // 돈이 나간 주문 (부분 취소 대상): 남은 배송분의 주기 주문 → 없으면 최근 결제된 주기 주문
    let orderId = remaining.orderId;
    if (!orderId) {
      const lastPaid = await prisma.subscriptionPeriod.findFirst({
        where: { subscriptionId: id, status: { in: ["PAID", "DELIVERING", "COMPLETED"] }, orderId: { not: null } },
        orderBy: { paidAt: "desc" },
        select: { orderId: true },
      });
      orderId = lastPaid?.orderId ?? null;
    }

    const [, req] = await prisma.$transaction([
      prisma.subscription.update({
        where: { id },
        data: { status: "CANCELLED", cancelledAt: now, nextBillingDate: null, nextDeliveryDate: null, creditBalance: 0, pauseMode: null },
      }),
      prisma.refundRequest.create({
        data: {
          userId,
          subscriptionId: id,
          orderId,
          kind: "SUBSCRIPTION_CANCEL",
          reason,
          reasonDetail,
          requestedAmount,
          // 돌려줄 금액이 없으면 사유 기록만 남기고 바로 종료
          status: requestedAmount > 0 ? "PENDING" : "COMPLETED",
          adminNote: requestedAmount > 0 ? null : "환불 대상 금액 없음 (사유 기록)",
          refundAmount: requestedAmount > 0 ? null : 0,
          processedAt: requestedAmount > 0 ? null : now,
        },
        select: { id: true, status: true, requestedAmount: true },
      }),
    ]);

    const feePercent = await getRefundFeePercent();
    const fee = feeFor(requestedAmount, feePercent);
    const message =
      requestedAmount > 0
        ? `해지되었습니다. 남은 배송 ${remaining.count}회분 ${remaining.amount.toLocaleString()}원${credit > 0 ? ` + 크레딧 ${credit.toLocaleString()}원` : ""} = ${requestedAmount.toLocaleString()}원의 환불 신청이 접수됐습니다. 담당자 검토 후 약관에 따른 취소 수수료 ${feePercent}%(${fee.toLocaleString()}원)를 뺀 약 ${(requestedAmount - fee).toLocaleString()}원이 결제 수단으로 환불됩니다.`
        : "해지되었습니다. 환불 대상 금액은 없습니다.";

    return NextResponse.json({ ok: true, refundRequest: req, remainingAmount: remaining.amount, credit, requestedAmount, message });
  } catch (err) {
    console.error("POST /api/subscriptions/[id]/cancel error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
