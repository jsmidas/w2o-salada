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

    const { plan, selectionMode, itemsPerDelivery, selections, addressId, address, slots, weekdaySlots: rawWeekdaySlots, cycleWeeks: rawWeeks, autoRenew: rawAutoRenew, windowStart: rawWindowStart } = body as {
      plan: "trial" | "subscription";
      selectionMode?: "MANUAL" | "AUTO";
      itemsPerDelivery?: number;
      slots?: Record<string, number>;
      weekdaySlots?: Record<string, Record<string, number>> | null; // 요일별 구성 { "2": {...}, "4": {...} } — 없으면 slots 만 쓴다
      cycleWeeks?: number;   // 2 / 4 / 6 / 8 — 롤링 청구 주기
      windowStart?: string;  // 화면이 안내한 주기 시작일 (YYYY-MM-DD)
      autoRenew?: boolean;   // false 면 이번 주기만 결제 (빌링키 없음)
      selections: { date: string; productIds: string[] }[];
      addressId?: string | null;
      address?: import("../../lib/address-resolve").AddressInput | null;
    };
    const cycleWeeks = [2, 4, 6, 8].includes(Number(rawWeeks)) ? Number(rawWeeks) : 4;
    const { sanitizeWeekdaySlots, sanitizeSlots } = await import("../../lib/auto-assign");
    const weekdaySlots = sanitizeWeekdaySlots(rawWeekdaySlots);
    const safeSlots = sanitizeSlots(slots); // 음수·소수·과도한 수량을 그대로 저장하지 않는다
    const autoRenew = plan === "subscription" && rawAutoRenew !== false;

    if (!plan || !selections || selections.length === 0) {
      return NextResponse.json({ error: "plan, selections 필수" }, { status: 400 });
    }

    // 마감(배송 전날 14:00 KST)이 지난 배송일은 거부 — 화면을 열어 둔 채 마감을 넘기면 캘린더에 남아 있을 수 있다.
    // 화면도 마감을 지키지만 서버가 최종 판정한다 (단건 주문 API와 같은 기준)
    const { isOrderable, CUTOFF_LABEL } = await import("../../lib/cutoff");
    const closedDates = [...new Set(selections.map((s) => s.date))].filter((d) => !isOrderable(d)).sort();
    if (closedDates.length > 0) {
      const label = closedDates.map((d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`).join(", ");
      return NextResponse.json(
        {
          error: "주문이 마감된 배송일이 포함되어 있습니다.",
          message: `${label} 배송은 주문이 마감되었습니다. (마감: ${CUTOFF_LABEL})\n화면을 새로고침하면 마감된 날짜가 빠지고 기간이 이어집니다.`,
          closedDates,
        },
        { status: 400 },
      );
    }

    // 배송일로 지정되지 않은 날짜는 거부 — 화면을 오래 열어 두면 관리자가 내린 날짜가 남아 있을 수 있다
    const selectedDates = [...new Set(selections.map((s) => s.date))].sort();
    const activeRows = await prisma.deliveryCalendar.findMany({
      where: {
        date: { in: selectedDates.map((d) => new Date(`${d}T00:00:00.000Z`)) },
        isActive: true,
      },
      select: { date: true },
    });
    const activeSet = new Set(activeRows.map((c) => c.date.toISOString().slice(0, 10)));
    const inactiveDates = selectedDates.filter((d) => !activeSet.has(d));
    if (inactiveDates.length > 0) {
      const label = inactiveDates.map((d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`).join(", ");
      return NextResponse.json(
        {
          error: "배송하지 않는 날짜가 포함되어 있습니다.",
          message: `${label}은 배송일이 아닙니다.
화면을 새로고침하면 최신 배송일로 갱신됩니다.`,
          inactiveDates,
        },
        { status: 400 },
      );
    }

    // 주기 창은 화면이 안내한 시작일을 따른다.
    // 서버가 "가장 빠른 선택일"로 다시 잡으면, 고객이 첫 배송일을 건너뛰고 고른 경우
    // 화면에 보여준 기간·결제일과 어긋난다. 다만 그대로 믿지 않고 범위를 검증한다.
    const firstSelected = selectedDates[0]!;
    const lastSelected = selectedDates[selectedDates.length - 1]!;
    const windowStartDate =
      typeof rawWindowStart === "string" &&
      /^d{4}-d{2}-d{2}$/.test(rawWindowStart) &&
      rawWindowStart <= firstSelected
        ? rawWindowStart
        : firstSelected;

    const { cycleWindow, billingDateFor } = await import("../../lib/subscription-cycle");
    const { startDate: cycleStart, endDate: cycleEnd } = cycleWindow(
      new Date(`${windowStartDate}T00:00:00Z`),
      cycleWeeks,
    );
    if (plan !== "trial" && lastSelected >= cycleEnd.toISOString().slice(0, 10)) {
      return NextResponse.json(
        {
          error: "선택한 배송일이 구독 주기를 벗어납니다.",
          message: `${cycleWeeks}주 주기(${windowStartDate} 시작) 안의 배송일만 고를 수 있습니다.`,
        },
        { status: 400 },
      );
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
    const productMap = new Map(products.map((p) => [p.id, p]));
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

    // 배송지 확정 — 구독은 배송지가 고정되므로 Subscription 에도 연결한다
    const { resolveAddress } = await import("../../lib/address-resolve");
    const resolved = await resolveAddress({ userId, addressId, address });
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    // 주문번호
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderNo = `W2O-${today}-${rand}`;

    // 모든 쓰기 작업을 $transaction으로 묶어 1회 라운드트립
    const result = await prisma.$transaction(async (tx) => {
      // 주문 생성
      const order = await tx.order.create({
        data: {
          orderNo,
          userId,
          addressId: resolved.addressId,
          deliveryHold: resolved.deliveryHold,
          deliveryHoldReason: resolved.deliveryHoldReason,
          type: plan === "trial" ? "SINGLE" : "SUBSCRIPTION",
          status: "PENDING",
          totalAmount,
          // 정기구독은 금액과 무관하게 무료배송 (단건 주문에만 배송비를 받는다)
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
        // 주기 창은 위에서 화면이 안내한 시작일로 확정해 두었다 (결제일은 주기 종료 이틀 전)
        const startDate = cycleStart;
        const endDate = cycleEnd;

        const subscription = await tx.subscription.create({
          data: {
            userId,
            addressId: resolved.addressId,
            selectionMode: selectionMode === "AUTO" ? "AUTO" : "MANUAL",
            itemsPerDelivery: itemsPerDelivery || 2,
            slots: safeSlots ?? undefined,
            weekdaySlots: weekdaySlots ?? undefined,
            cycleWeeks,
            autoRenew,
            status: "PENDING",
            price: totalAmount,
            nextDeliveryDate: startDate,
            nextBillingDate: autoRenew ? billingDateFor(endDate) : null,
          },
        });

        const period = await tx.subscriptionPeriod.create({
          data: {
            subscriptionId: subscription.id,
            year: startDate.getUTCFullYear(),
            month: startDate.getUTCMonth() + 1,
            startDate,
            endDate,
            weeks: cycleWeeks,
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
          tx.order.update({ where: { id: order.id }, data: { subscriptionId: subscription.id, deliveryDate: startDate } }),
          tx.subscriptionPeriod.update({ where: { id: period.id }, data: { orderId: order.id } }),
        ]);
        return { orderId: order.id, orderNo: order.orderNo, subscriptionId: subscription.id, autoRenew };
      }

      return { orderId: order.id, orderNo: order.orderNo };
    });

    return NextResponse.json({
      ...result,
      totalAmount,
      plan,
      cycleWeeks,
      addressId: resolved.addressId,
      areaStatus: resolved.areaStatus,
      deliveryHold: resolved.deliveryHold,
    });
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
