import { NextResponse } from "next/server";

const DEFAULT_MIN_ORDER_AMOUNT = 11000;
const FREE_SHIPPING_THRESHOLD = 15000;
const DELIVERY_FEE = 3000;

function generateOrderNo() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `W2O-${date}-${rand}`;
}

// POST: 슬롯 구독 확정 — 현재 selection 으로 Order 생성 + 빌링 정보 반환
// (실제 빌링키 발급/결제는 /api/subscribe/billing 에서 진행)
export async function POST(request: Request) {
  try {
    const { subscriptionId, userId: bodyUserId } = await request.json();
    if (!subscriptionId) {
      return NextResponse.json({ error: "subscriptionId 필요" }, { status: 400 });
    }

    const { prisma } = await import("@repo/db");
    const { pushDuePrices } = await import("../../../../lib/effective-price");
    await pushDuePrices();

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!subscription) {
      return NextResponse.json({ error: "구독을 찾을 수 없습니다." }, { status: 404 });
    }
    if (!subscription.nextDeliveryDate) {
      return NextResponse.json({ error: "다음 배송일이 없습니다." }, { status: 400 });
    }

    // 결제는 로그인 사용자만 가능 (customerKey 필요)
    let userId = bodyUserId ?? subscription.userId;
    if (!userId || userId === "guest") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const userExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!userExists) {
      return NextResponse.json({ error: "사용자 확인 실패" }, { status: 401 });
    }

    // guest 로 만들어진 구독이라면 현재 사용자에게 인계
    if (subscription.userId !== userId) {
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { userId },
      });
    }

    // 현재 배송일의 selection 로드
    const selections = await prisma.subscriptionSelection.findMany({
      where: {
        subscriptionPeriod: { subscriptionId },
        deliveryDate: subscription.nextDeliveryDate,
      },
      include: {
        product: {
          include: { category: { select: { isOption: true } } },
        },
      },
    });

    if (selections.length === 0) {
      return NextResponse.json({ error: "선택된 메뉴가 없습니다." }, { status: 400 });
    }

    // 금액 계산 — selection.unitPrice(결제 시점 잠긴 계약가) 우선, 없으면 현재가 fallback
    let baseTotal = 0;
    let itemsTotal = 0;
    const orderItemData = selections.map((s) => {
      const unit = s.unitPrice ?? s.product.price;
      const line = unit * s.quantity;
      itemsTotal += line;
      if (!s.product.category?.isOption) baseTotal += line;
      return {
        productId: s.productId,
        quantity: s.quantity,
        unitPrice: unit,
        totalPrice: line,
      };
    });

    // 최소액 검증
    const minSetting = await prisma.setting.findUnique({ where: { key: "minOrderAmount" } });
    const minAmount = minSetting ? Number(minSetting.value) : DEFAULT_MIN_ORDER_AMOUNT;
    if (baseTotal < minAmount) {
      return NextResponse.json(
        {
          error: "최소 주문액 미달",
          message: `본품 합계가 ${minAmount.toLocaleString()}원 이상이어야 합니다. (현재 ${baseTotal.toLocaleString()}원)`,
        },
        { status: 400 },
      );
    }

    const deliveryFee = itemsTotal >= FREE_SHIPPING_THRESHOLD ? 0 : DELIVERY_FEE;
    const totalAmount = itemsTotal + deliveryFee;

    const orderNo = generateOrderNo();
    const order = await prisma.order.create({
      data: {
        orderNo,
        userId,
        subscriptionId,
        type: "SUBSCRIPTION",
        status: "PENDING",
        totalAmount,
        deliveryFee,
        discountAmount: 0,
        deliveryDate: subscription.nextDeliveryDate,
        items: { create: orderItemData },
      },
    });

    return NextResponse.json({
      orderId: order.id,
      orderNo: order.orderNo,
      totalAmount,
      itemsTotal,
      deliveryFee,
    });
  } catch (err) {
    console.error("POST /api/subscribe/next/confirm error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
