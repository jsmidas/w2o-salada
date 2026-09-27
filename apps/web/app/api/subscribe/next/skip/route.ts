import { NextResponse } from "next/server";
import { findNextDeliveryDate } from "../../../../lib/auto-assign";
import { requireSubscriptionOwner } from "../../../../lib/subscription-guard";
import { syncNextDeliveryDate } from "../../../../lib/subscription-cycle";

/**
 * POST: 이번 배송 1회 건너뛰기
 * - 현재 배송일의 selection 삭제, nextDeliveryDate 를 다음 활성 배송일로
 * - 이미 결제된 주기의 배송이면 그 금액을 크레딧으로 적립 → 다음 자동 결제에서 차감
 *   (환불 대신 정산. "이번 주기만" 구독은 다음 결제가 없으므로 크레딧을 쌓지 않고 안내만)
 */
export async function POST(request: Request) {
  try {
    const { subscriptionId } = await request.json();

    const guard = await requireSubscriptionOwner(subscriptionId);
    if (guard.error) return guard.error;
    const subscription = guard.subscription;
    const currentDate = await syncNextDeliveryDate(subscription);
    if (!currentDate) {
      return NextResponse.json({ error: "배송일 정보 없음" }, { status: 404 });
    }

    const { prisma } = await import("@repo/db");


    // 마감 지난 배송은 건너뛸 수 없다 (이미 조리·포장 중)
    const { isOrderable } = await import("../../../../lib/cutoff");
    if (!isOrderable(currentDate.toISOString().slice(0, 10))) {
      return NextResponse.json({ error: "마감이 지나 이번 배송은 건너뛸 수 없습니다." }, { status: 400 });
    }

    const selections = await prisma.subscriptionSelection.findMany({
      where: { subscriptionPeriod: { subscriptionId }, deliveryDate: currentDate },
      include: { subscriptionPeriod: { select: { status: true } }, product: { select: { price: true } } },
    });

    // 결제된 주기의 배송분 → 크레딧
    let credited = 0;
    for (const s of selections) {
      if (s.subscriptionPeriod.status === "PAID" || s.subscriptionPeriod.status === "DELIVERING") {
        credited += (s.unitPrice ?? s.product.price) * s.quantity;
      }
    }

    await prisma.subscriptionSelection.deleteMany({
      where: { subscriptionPeriod: { subscriptionId }, deliveryDate: currentDate },
    });

    // 배송일별 배송 건이 이미 만들어졌다면 함께 정리 (마감 전이라 안전)
    await prisma.order.deleteMany({
      where: { subscriptionId, type: "SUBSCRIPTION_DELIVERY", deliveryDate: currentDate, status: { in: ["PENDING", "PAID"] }, delivery: null },
    });

    const afterDate = new Date(currentDate);
    afterDate.setDate(afterDate.getDate() + 1);
    const next = await findNextDeliveryDate(afterDate);

    const applyCredit = credited > 0 && subscription.autoRenew && !!subscription.billingKey;
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        nextDeliveryDate: next ?? null,
        ...(applyCredit ? { creditBalance: { increment: credited } } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      nextDeliveryDate: next?.toISOString() ?? null,
      credited: applyCredit ? credited : 0,
      message: applyCredit
        ? `${credited.toLocaleString()}원이 다음 결제에서 차감됩니다.`
        : credited > 0
          ? "이번 주기만 결제한 구독은 건너뛴 배송분이 환불되지 않습니다."
          : undefined,
    });
  } catch (err) {
    console.error("POST /api/subscribe/next/skip error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
