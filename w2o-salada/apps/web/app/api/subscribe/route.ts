import { NextResponse } from "next/server";

// POST: 구독/맛보기 주문 생성
export async function POST(request: Request) {
  try {
    const { prisma } = await import("@repo/db");
    const body = await request.json();
    const { plan, selectionMode, itemsPerDelivery, selections } = body as {
      plan: "trial" | "subscription";
      selectionMode?: "MANUAL" | "AUTO";
      itemsPerDelivery?: number;
      selections: { date: string; productIds: string[] }[];
    };

    if (!plan || !selections || selections.length === 0) {
      return NextResponse.json({ error: "plan, selections 필수" }, { status: 400 });
    }

    // 로그인 사용자 또는 게스트
    let userId = "guest";
    try {
      const { auth } = await import("../../../auth");
      const session = await auth();
      if (session?.user) {
        const sessionUserId = (session.user as { id?: string }).id;
        if (sessionUserId) {
          // DB에 해당 유저가 존재하는지 확인
          const userExists = await prisma.user.findUnique({ where: { id: sessionUserId }, select: { id: true } });
          userId = userExists ? sessionUserId : "guest";
        }
      }
    } catch {}

    // 선택한 상품 조회
    const allProductIds = selections.flatMap((s) => s.productIds);
    const products = await prisma.product.findMany({
      where: { id: { in: allProductIds } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    // 금액 계산
    let totalAmount = 0;
    for (const sel of selections) {
      for (const pid of sel.productIds) {
        const product = productMap.get(pid);
        if (!product) continue;
        totalAmount += plan === "trial" ? (product.originalPrice || product.price) : product.price;
      }
    }

    // 주문번호 생성
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const count = await prisma.order.count({ where: { orderNo: { startsWith: `W2O-${today}` } } });
    const orderNo = `W2O-${today}-${String(count + 1).padStart(4, "0")}`;

    // 유효한 상품만 필터링
    const validProductIds = allProductIds.filter((pid) => productMap.has(pid));

    if (validProductIds.length === 0) {
      return NextResponse.json({ error: "유효한 상품이 없습니다." }, { status: 400 });
    }

    // 주문 생성
    const order = await prisma.order.create({
      data: {
        orderNo,
        userId,
        type: plan === "trial" ? "SINGLE" : "SUBSCRIPTION",
        status: "PENDING",
        totalAmount,
        deliveryFee: 0,
        items: {
          create: validProductIds.map((pid) => {
            const product = productMap.get(pid)!;
            const unitPrice = plan === "trial" ? (product.originalPrice || product.price) : product.price;
            return {
              productId: pid,
              quantity: 1,
              unitPrice,
              totalPrice: unitPrice,
            };
          }),
        },
      },
    });

    // 구독인 경우 Subscription + Period + Selection 생성
    if (plan !== "trial") {
      const now = new Date();
      const subscription = await prisma.subscription.create({
        data: {
          userId,
          selectionMode: selectionMode === "AUTO" ? "AUTO" : "MANUAL",
          itemsPerDelivery: itemsPerDelivery || 2,
          status: "PENDING",
          price: totalAmount,
        },
      });

      const period = await prisma.subscriptionPeriod.create({
        data: {
          subscriptionId: subscription.id,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          status: "PENDING",
          totalAmount,
        },
      });

      // 날짜별 선택 저장 (유효한 상품만)
      const selectionData = selections.flatMap((sel) =>
        sel.productIds.filter((pid) => productMap.has(pid)).map((pid) => ({
          subscriptionPeriodId: period.id,
          deliveryDate: new Date(sel.date),
          productId: pid,
          quantity: 1,
        }))
      );

      if (selectionData.length > 0) {
        await prisma.subscriptionSelection.createMany({ data: selectionData });
      }

      // 주문에 구독 연결
      await prisma.order.update({
        where: { id: order.id },
        data: { subscriptionId: subscription.id },
      });
    }

    return NextResponse.json({
      orderId: order.id,
      orderNo: order.orderNo,
      totalAmount,
      plan,
    });
  } catch (err) {
    console.error("POST /api/subscribe error:", err);
    return NextResponse.json({ error: "주문 생성 실패" }, { status: 500 });
  }
}
