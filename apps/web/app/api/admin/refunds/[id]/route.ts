import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../../lib/auth-guard";
import { partialRefundOrder, RefundError } from "../../../../lib/order-refund";

/**
 * PATCH /api/admin/refunds/[id]
 *  { action: "approve", feeAmount?: number, adminNote?: string }  — 수수료를 뺀 금액을 토스 부분 취소로 환불 → COMPLETED
 *  { action: "manual",  feeAmount?: number, adminNote?: string }  — 계좌이체 등으로 밖에서 돌려준 뒤 완료 표시
 *  { action: "reject",  adminNote: string }                        — 거절 (크레딧 환불이면 크레딧 복구)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await requireAdmin("subscriptions");
  if (error) return error;

  try {
    const { id } = await params;
    const body = (await request.json()) as { action?: string; feeAmount?: number; adminNote?: string };
    const adminId = (session!.user as { id: string }).id;
    const now = new Date();

    const req = await prisma.refundRequest.findUnique({ where: { id }, include: { order: { select: { id: true, paymentKey: true } } } });
    if (!req) return NextResponse.json({ error: "신청을 찾을 수 없습니다." }, { status: 404 });
    if (req.status !== "PENDING" && req.status !== "APPROVED") {
      return NextResponse.json({ error: "이미 처리된 신청입니다." }, { status: 400 });
    }

    const note = body.adminNote?.toString().trim() || null;

    if (body.action === "reject") {
      if (!note) return NextResponse.json({ error: "거절 사유를 적어주세요." }, { status: 400 });
      await prisma.$transaction(async (tx) => {
        await tx.refundRequest.update({ where: { id }, data: { status: "REJECTED", adminNote: note, processedById: adminId, processedAt: now, refundAmount: 0 } });
        // 크레딧을 현금으로 바꾸려던 신청이면 크레딧을 돌려놓는다
        if (req.kind === "CREDIT_PAYOUT" && req.subscriptionId) {
          await tx.subscription.update({ where: { id: req.subscriptionId }, data: { creditBalance: { increment: req.requestedAmount } } });
        }
      });
      return NextResponse.json({ ok: true, status: "REJECTED" });
    }

    if (body.action !== "approve" && body.action !== "manual") {
      return NextResponse.json({ error: "action 은 approve · manual · reject 중 하나" }, { status: 400 });
    }

    const feeAmount = Number.isInteger(body.feeAmount) && body.feeAmount! >= 0 ? body.feeAmount! : 0;
    const refundAmount = req.requestedAmount - feeAmount;
    if (refundAmount < 0) return NextResponse.json({ error: "수수료가 신청 금액보다 큽니다." }, { status: 400 });

    let paymentKey: string | null = null;
    if (body.action === "approve" && refundAmount > 0) {
      if (!req.order) {
        return NextResponse.json(
          { error: "연결된 결제 주문이 없어 자동 환불할 수 없습니다. 계좌이체로 돌려준 뒤 '수동 완료'로 처리하세요." },
          { status: 400 },
        );
      }
      const r = await partialRefundOrder({
        orderId: req.order.id,
        amount: refundAmount,
        reason: `환불 신청 ${req.id} (${req.kind})`,
        idempotencyKey: `refund-request-${req.id}`,
      });
      paymentKey = r.paymentKey;
    }

    const updated = await prisma.refundRequest.update({
      where: { id },
      data: {
        status: "COMPLETED",
        feeAmount,
        refundAmount,
        adminNote: note ?? (body.action === "manual" ? "수동 환불 처리" : null),
        processedById: adminId,
        processedAt: now,
        paymentKey,
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof RefundError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("PATCH /api/admin/refunds/[id] error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
