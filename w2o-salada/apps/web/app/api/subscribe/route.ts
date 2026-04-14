import { NextResponse } from "next/server";

// POST: 구독/맛보기 주문 생성
export async function POST(request: Request) {
  try {
    // prisma import + body 파싱 + auth 세션 확인을 모두 병렬로
    const [{ prisma }, body, sessionUserId] = await Promise.all([
      import("@repo/db"),
      request.json(),
      getSessionUserId(),
    ]);

    const { plan, selectionMode, itemsPerDelivery, selections } = body as {
      plan: "trial" | "subscription";
      selectionMode?: "MANUAL" | "AUTO";
      itemsPerDelivery?: number;
      selections: { date: string; productIds: string[] }[];
    };

    if (!plan || !selections || selections.length === 0) {
      return NextResponse.json({ error: "plan, selections 필수" }, { status: 400 });
    }

    const allProductIds = [...new Set(selections.flatMap((s) => s.productIds))];

    // 도래한 가격 인상분 먼저 승격
    const { pushDuePrices } = await import("../../lib/effective-price");
    await pushDuePrices();

    // 유저 존재 확인 + 상품 조회 + 최소 주문액 설정 조회를 병렬로
    const [userExists, products, minOrderSetting] = await Promise.all([
      sessionUserId && sessionUserId !== "guest"
        ? prisma.user.findUnique({ where: { id: sessionUserId }, select: { id: true } })
        : null,
      prisma.product.findMany({
        where: { id: { in: allProductIds } },
        include: { category: { select: { isOption: true } } },
      }),
      prisma.setting.findUnique({ where: { key: "minOrderAmount" } }),
    ]);

    const userId = userExists ? sessionUserId! : "guest";
    const productMap = new Map(products.map((p: { id: string }) => [p.id, p]));
    const validProductIds = allProductIds.filter((pid) => productMap.has(pid));

    if (validProductIds.length === 0) {
      return NextResponse.json({ error: "유효한 상품이 없습니다." }, { status: 400 });
    }

    // 회당 본품(isOption=false) 합계 ≥ minOrderAmount 검증 (맛보기 제외)
    const minAmount = minOrderSetting ? Number(minOrderSetting.value) : 11000;
    if (plan !== "trial") {
      const insufficient: { date: string; baseTotal: number }[] = [];
      for (const sel of selections) {
        let baseTotal = 0;
        for (const pid of sel.productIds) {
          const p = productMap.get(pid) as
            | { price: number; category?: { isOption: boolean } }
            | undefined;
          if (!p) continue;
          if (p.category?.isOption) continue; // 옵션 카테고리는 본품 합계에서 제외
          baseTotal += p.price;
        }
        if (baseTotal < minAmount) {
          insufficient.push({ date: sel.date, baseTotal });
        }
      }
      if (insufficient.length > 0) {
        return NextResponse.json(
          {
            error: "회당 본품 최소 주문액 미달",
            message: `다음 배송일의 본품 합계가 ${minAmount.toLocaleString()}원 미만입니다.`,
            minAmount,
            insufficient,
          },
          { status: 400 },
        );
      }
    }

    // 금액 계산
    let totalAmount = 0;
    for (const sel of selections) {
      for (const pid of sel.productIds) {
        const product = productMap.get(pid) as { originalPrice: number | null; price: number } | undefined;
        if (!product) continue;
        totalAmount += plan === "trial" ? (product.originalPrice || product.price) : product.price;
      }
    }

    // 주문번호
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderNo = `W2O-${today}-${rand}`;

    // 모든 쓰기 작업을 $transaction으로 묶어 1회 라운드트립
    // @ts-expect-error prisma interactive transaction
    const result = await prisma.$transaction(async (tx) => {
      // 주문 생성
      const order = await tx.order.create({
        data: {
          orderNo,
          userId,
          type: plan === "trial" ? "SINGLE" : "SUBSCRIPTION",
          status: "PENDING",
          totalAmount,
          deliveryFee: 0,
          items: {
            create: validProductIds.map((pid: string) => {
              const product = productMap.get(pid) as { originalPrice: number | null; price: number };
              const unitPrice = plan === "trial" ? (product.originalPrice || product.price) : product.price;
              return { productId: pid, quantity: 1, unitPrice, totalPrice: unitPrice };
            }),
          },
        },
      });

      if (plan !== "trial") {
        const now = new Date();
        const subscription = await tx.subscription.create({
          data: {
            userId,
            selectionMode: selectionMode === "AUTO" ? "AUTO" : "MANUAL",
            itemsPerDelivery: itemsPerDelivery || 2,
            status: "PENDING",
            price: totalAmount,
          },
        });

        const period = await tx.subscriptionPeriod.create({
          data: {
            subscriptionId: subscription.id,
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            status: "PENDING",
            totalAmount,
          },
        });

        // 선택 저장 + 주문-구독 연결을 병렬로
        // unitPrice를 결제 시점 가격으로 잠가둠 (계약가) — 이후 product.price가 바뀌어도 이 구독 사이클은 잠긴 가격으로 매출 집계됨
        const selectionData = selections.flatMap((sel) =>
          sel.productIds.filter((pid) => productMap.has(pid)).map((pid) => {
            const product = productMap.get(pid) as { price: number };
            return {
              subscriptionPeriodId: period.id,
              deliveryDate: new Date(sel.date),
              productId: pid,
              quantity: 1,
              unitPrice: product.price,
            };
          })
        );

        await Promise.all([
          selectionData.length > 0 ? tx.subscriptionSelection.createMany({ data: selectionData }) : null,
          tx.order.update({ where: { id: order.id }, data: { subscriptionId: subscription.id } }),
        ]);
      }

      return { orderId: order.id, orderNo: order.orderNo };
    });

    return NextResponse.json({ ...result, totalAmount, plan });
  } catch (err) {
    console.error("POST /api/subscribe error:", err);
    return NextResponse.json({ error: "주문 생성 실패" }, { status: 500 });
  }
}

async function getSessionUserId(): Promise<string> {
  try {
    const { auth } = await import("../../../auth");
    const session = await auth();
    return (session?.user as { id?: string })?.id ?? "guest";
  } catch {
    return "guest";
  }
}
