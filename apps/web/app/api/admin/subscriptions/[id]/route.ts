import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../../lib/auth-guard";
import { syncNextDeliveryDate } from "../../../../lib/subscription-cycle";
import { extendAfterPause, removeRemainingForCancel } from "../../../../lib/subscription-settle";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin("subscriptions");
  if (error) return error;

  try {
    const { id } = await params;

    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        user: true,
        items: { include: { product: true } },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "구독을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json(subscription);
  } catch (err) {
    console.error("GET /api/admin/subscriptions/[id] error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin("subscriptions");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { action, plan } = body as { action?: string; plan?: string; reasonDetail?: string };

    const subscription = await prisma.subscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "구독을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};

    switch (action) {
      case "pause":
        if (subscription.status !== "ACTIVE") {
          return NextResponse.json(
            { error: "활성 상태의 구독만 일시정지할 수 있습니다." },
            { status: 400 }
          );
        }
        data.status = "PAUSED";
        break;

      case "resume":
        if (subscription.status !== "PAUSED") {
          return NextResponse.json(
            { error: "일시정지 상태의 구독만 재개할 수 있습니다." },
            { status: 400 }
          );
        }
        data.status = "ACTIVE";
        data.pausedAt = null;
        data.pauseMode = null;
        if (subscription.pauseMode === "EXTEND") {
          const ext = await extendAfterPause(subscription);
          if (ext.newEndDate) break; // extendAfterPause 가 결제일을 새 종료일 기준으로 옮겼다
        }
        // 정지 중에 지난 결제일은 "지금" 으로 — 다음 크론이 오늘 기준 주기로 청구한다
        if (subscription.autoRenew && subscription.nextBillingDate && subscription.nextBillingDate < new Date()) data.nextBillingDate = new Date();
        break;

      case "cancel": {
        if (subscription.status === "CANCELLED") {
          return NextResponse.json(
            { error: "이미 취소된 구독입니다." },
            { status: 400 }
          );
        }
        // 남은 결제 배송분 + 크레딧 → 환불 신청 (돈은 환불 신청 화면에서 검토 후)
        const remaining = await removeRemainingForCancel(id);
        const requestedAmount = remaining.amount + subscription.creditBalance;
        let orderId = remaining.orderId;
        if (!orderId) {
          const lastPaid = await prisma.subscriptionPeriod.findFirst({
            where: { subscriptionId: id, status: { in: ["PAID", "DELIVERING", "COMPLETED"] }, orderId: { not: null } },
            orderBy: { paidAt: "desc" },
            select: { orderId: true },
          });
          orderId = lastPaid?.orderId ?? null;
        }
        await prisma.refundRequest.create({
          data: {
            userId: subscription.userId,
            subscriptionId: id,
            orderId,
            kind: "SUBSCRIPTION_CANCEL",
            reason: "OTHER",
            reasonDetail: typeof body.reasonDetail === "string" && body.reasonDetail.trim() ? body.reasonDetail.trim().slice(0, 500) : "관리자 해지",
            requestedAmount,
            status: requestedAmount > 0 ? "PENDING" : "COMPLETED",
            adminNote: requestedAmount > 0 ? null : "환불 대상 금액 없음 (관리자 해지)",
            refundAmount: requestedAmount > 0 ? null : 0,
            processedAt: requestedAmount > 0 ? null : new Date(),
          },
        });
        data.status = "CANCELLED";
        data.cancelledAt = new Date();
        data.nextBillingDate = null;
        data.nextDeliveryDate = null;
        data.creditBalance = 0;
        data.pauseMode = null;
        break;
      }

      case "changePlan":
        if (!plan) {
          return NextResponse.json(
            { error: "변경할 플랜을 지정해주세요." },
            { status: 400 }
          );
        }
        data.planType = plan;
        break;

      default:
        return NextResponse.json(
          { error: "유효하지 않은 작업입니다. (pause, resume, cancel, changePlan)" },
          { status: 400 }
        );
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        items: { include: { product: true } },
      },
    });
    if (action === "resume") await syncNextDeliveryDate(updated);

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/admin/subscriptions/[id] error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
