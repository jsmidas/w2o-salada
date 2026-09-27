import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import type { RefundRequestStatus } from "@prisma/client";
import { requireAdmin } from "../../../lib/auth-guard";
import { getRefundFeePercent } from "../../../lib/refund-policy";

const STATUSES: RefundRequestStatus[] = ["PENDING", "APPROVED", "REJECTED", "COMPLETED"];

/**
 * GET /api/admin/refunds?status=PENDING — 환불 신청 목록 + 사유 통계 (이탈 원인 파악용)
 */
export async function GET(request: Request) {
  const { error } = await requireAdmin("subscriptions");
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const where = STATUSES.includes(status as RefundRequestStatus) ? { status: status as RefundRequestStatus } : {};

    const since30 = new Date(Date.now() - 30 * 86400000);
    const [rows, byReasonAll, byReason30, pendingAgg, feePercent] = await Promise.all([
      prisma.refundRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 200,
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          subscription: { select: { id: true, status: true, cycleWeeks: true, price: true } },
          order: { select: { id: true, orderNo: true, totalAmount: true, paymentKey: true, status: true } },
        },
      }),
      prisma.refundRequest.groupBy({ by: ["reason"], _count: { _all: true }, where: { kind: "SUBSCRIPTION_CANCEL" } }),
      prisma.refundRequest.groupBy({ by: ["reason"], _count: { _all: true }, where: { kind: "SUBSCRIPTION_CANCEL", createdAt: { gte: since30 } } }),
      prisma.refundRequest.aggregate({ where: { status: "PENDING" }, _sum: { requestedAmount: true }, _count: { _all: true } }),
      getRefundFeePercent(),
    ]);

    return NextResponse.json({
      requests: rows,
      stats: {
        feePercent,
        pendingCount: pendingAgg._count._all,
        pendingAmount: pendingAgg._sum.requestedAmount ?? 0,
        byReason: byReasonAll.map((r) => ({ reason: r.reason ?? "UNKNOWN", count: r._count._all })),
        byReason30: byReason30.map((r) => ({ reason: r.reason ?? "UNKNOWN", count: r._count._all })),
      },
    });
  } catch (err) {
    console.error("GET /api/admin/refunds error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

/**
 * POST /api/admin/refunds  { subscriptionId, note? } — 관리자가 고객 크레딧을 환불 신청으로 전환 (크레딧 → 현금)
 * 크레딧은 0 으로 내리고 PENDING 신청을 만든다. 승인 시 토스 부분 취소.
 */
export async function POST(request: Request) {
  const { error } = await requireAdmin("subscriptions");
  if (error) return error;

  try {
    const body = (await request.json()) as { subscriptionId?: string; note?: string };
    if (!body.subscriptionId) return NextResponse.json({ error: "subscriptionId 필요" }, { status: 400 });

    const sub = await prisma.subscription.findUnique({ where: { id: body.subscriptionId }, select: { id: true, userId: true, creditBalance: true } });
    if (!sub) return NextResponse.json({ error: "구독을 찾을 수 없습니다." }, { status: 404 });
    if (sub.creditBalance <= 0) return NextResponse.json({ error: "환불할 크레딧이 없습니다." }, { status: 400 });

    const lastPaid = await prisma.subscriptionPeriod.findFirst({
      where: { subscriptionId: sub.id, status: { in: ["PAID", "DELIVERING", "COMPLETED"] }, orderId: { not: null } },
      orderBy: { paidAt: "desc" },
      select: { orderId: true },
    });

    const [, req] = await prisma.$transaction([
      prisma.subscription.update({ where: { id: sub.id }, data: { creditBalance: 0 } }),
      prisma.refundRequest.create({
        data: {
          userId: sub.userId,
          subscriptionId: sub.id,
          orderId: lastPaid?.orderId ?? null,
          kind: "CREDIT_PAYOUT",
          requestedAmount: sub.creditBalance,
          adminNote: body.note?.toString().trim() || "관리자가 크레딧 환불 신청 생성",
        },
      }),
    ]);
    return NextResponse.json(req, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/refunds error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
