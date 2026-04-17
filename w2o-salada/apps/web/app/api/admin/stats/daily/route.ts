import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../../lib/auth-guard";

/**
 * 배송일(deliveryDate) 기준 일자별 매출 + 생산/배송 현황 API
 *
 * Query params:
 *   from  — 조회 시작일 (YYYY-MM-DD, 기본: 14일 전)
 *   to    — 조회 종료일 (YYYY-MM-DD, 기본: 오늘)
 *   date  — 특정 일자 상세 (YYYY-MM-DD, 선택)
 */
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin("dashboard");
  if (error) return error;

  try {
    const { searchParams } = request.nextUrl;
    const dateParam = searchParams.get("date");

    // ── 특정 일자 상세 (상품별 수량) ──
    if (dateParam) {
      return getDateDetail(dateParam);
    }

    // ── 기간별 일자 요약 ──
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstNow = new Date(now.getTime() + kstOffset);
    const todayStr = kstNow.toISOString().split("T")[0] as string;

    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to") ?? todayStr;

    let fromDate: Date;
    if (fromParam) {
      fromDate = new Date(fromParam + "T00:00:00+09:00");
    } else {
      fromDate = new Date(toParam + "T00:00:00+09:00");
      fromDate.setDate(fromDate.getDate() - 13); // 기본 2주
    }
    const toDate = new Date(toParam + "T00:00:00+09:00");
    toDate.setDate(toDate.getDate() + 1); // inclusive end

    // 배송일 기준으로 주문 집계
    const orders = await prisma.order.findMany({
      where: {
        deliveryDate: { gte: fromDate, lt: toDate },
        status: { in: ["PAID", "PREPARING", "SHIPPING", "DELIVERED"] },
      },
      include: {
        items: {
          include: {
            product: { include: { category: true } },
          },
        },
      },
      orderBy: { deliveryDate: "asc" },
    });

    // 일자별 그룹핑
    type DaySummary = {
      date: string;
      orderCount: number;
      totalRevenue: number;
      mainRevenue: number;
      optionRevenue: number;
      totalItems: number;
      productKinds: number;
      singleCount: number;
      subscriptionCount: number;
    };

    const dayMap = new Map<string, {
      orderCount: number;
      totalRevenue: number;
      mainRevenue: number;
      optionRevenue: number;
      totalItems: number;
      productIds: Set<string>;
      singleCount: number;
      subscriptionCount: number;
    }>();

    for (const order of orders) {
      const dateKey = order.deliveryDate
        ? new Date(order.deliveryDate.getTime() + kstOffset).toISOString().split("T")[0] as string
        : "unknown";

      let day = dayMap.get(dateKey);
      if (!day) {
        day = {
          orderCount: 0,
          totalRevenue: 0,
          mainRevenue: 0,
          optionRevenue: 0,
          totalItems: 0,
          productIds: new Set(),
          singleCount: 0,
          subscriptionCount: 0,
        };
        dayMap.set(dateKey, day);
      }

      day.orderCount++;
      day.totalRevenue += order.totalAmount;
      if (order.type === "SINGLE") day.singleCount++;
      else day.subscriptionCount++;

      for (const item of order.items) {
        const isOption = item.product.category.isOption;
        if (isOption) day.optionRevenue += item.totalPrice;
        else day.mainRevenue += item.totalPrice;
        day.totalItems += item.quantity;
        day.productIds.add(item.productId);
      }
    }

    const days: DaySummary[] = Array.from(dayMap.entries())
      .map(([date, d]) => ({
        date,
        orderCount: d.orderCount,
        totalRevenue: d.totalRevenue,
        mainRevenue: d.mainRevenue,
        optionRevenue: d.optionRevenue,
        totalItems: d.totalItems,
        productKinds: d.productIds.size,
        singleCount: d.singleCount,
        subscriptionCount: d.subscriptionCount,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 전체 합산
    const totals = days.reduce(
      (acc, d) => ({
        orderCount: acc.orderCount + d.orderCount,
        totalRevenue: acc.totalRevenue + d.totalRevenue,
        mainRevenue: acc.mainRevenue + d.mainRevenue,
        optionRevenue: acc.optionRevenue + d.optionRevenue,
        totalItems: acc.totalItems + d.totalItems,
      }),
      { orderCount: 0, totalRevenue: 0, mainRevenue: 0, optionRevenue: 0, totalItems: 0 }
    );

    return NextResponse.json({ days, totals });
  } catch (err) {
    console.error("GET /api/admin/stats/daily error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

/** 특정 배송일의 상품별 수량 상세 */
async function getDateDetail(dateParam: string) {
  const targetDate = new Date(dateParam + "T00:00:00+09:00");
  if (Number.isNaN(targetDate.getTime())) {
    return NextResponse.json({ error: "유효하지 않은 날짜입니다." }, { status: 400 });
  }
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const orders = await prisma.order.findMany({
    where: {
      deliveryDate: { gte: targetDate, lt: nextDay },
      status: { in: ["PAID", "PREPARING", "SHIPPING", "DELIVERED"] },
    },
    include: {
      items: {
        include: {
          product: { include: { category: true } },
        },
      },
    },
  });

  // 상품별 집계
  type ProductAgg = {
    productId: string;
    name: string;
    categoryName: string;
    categorySlug: string;
    isOption: boolean;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
  };
  const productMap = new Map<string, ProductAgg>();
  let mainRevenue = 0;
  let optionRevenue = 0;

  for (const order of orders) {
    for (const item of order.items) {
      const isOption = item.product.category.isOption;
      const amount = item.totalPrice;
      if (isOption) optionRevenue += amount;
      else mainRevenue += amount;

      const existing = productMap.get(item.productId);
      if (existing) {
        existing.quantity += item.quantity;
        existing.totalAmount += amount;
      } else {
        productMap.set(item.productId, {
          productId: item.productId,
          name: item.product.name,
          categoryName: item.product.category.name,
          categorySlug: item.product.category.slug,
          isOption,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalAmount: amount,
        });
      }
    }
  }

  const products = Array.from(productMap.values()).sort((a, b) => {
    if (a.isOption !== b.isOption) return a.isOption ? 1 : -1;
    if (a.categorySlug !== b.categorySlug) return a.categorySlug.localeCompare(b.categorySlug);
    return b.quantity - a.quantity;
  });

  // 카테고리별 소계
  type CategoryAgg = {
    slug: string;
    name: string;
    isOption: boolean;
    quantity: number;
    totalAmount: number;
  };
  const categoryMap = new Map<string, CategoryAgg>();
  for (const p of products) {
    const existing = categoryMap.get(p.categorySlug);
    if (existing) {
      existing.quantity += p.quantity;
      existing.totalAmount += p.totalAmount;
    } else {
      categoryMap.set(p.categorySlug, {
        slug: p.categorySlug,
        name: p.categoryName,
        isOption: p.isOption,
        quantity: p.quantity,
        totalAmount: p.totalAmount,
      });
    }
  }
  const categories = Array.from(categoryMap.values()).sort((a, b) => {
    if (a.isOption !== b.isOption) return a.isOption ? 1 : -1;
    return a.slug.localeCompare(b.slug);
  });

  // 주문 유형별 건수
  const singleCount = orders.filter((o) => o.type === "SINGLE").length;
  const subscriptionCount = orders.filter((o) => o.type === "SUBSCRIPTION").length;

  // 주문 상태별 건수
  const statusCounts: Record<string, number> = {};
  for (const order of orders) {
    statusCounts[order.status] = (statusCounts[order.status] ?? 0) + 1;
  }

  return NextResponse.json({
    date: dateParam,
    totals: {
      orderCount: orders.length,
      totalRevenue: mainRevenue + optionRevenue,
      mainRevenue,
      optionRevenue,
      totalItems: products.reduce((s, p) => s + p.quantity, 0),
      productKinds: products.length,
      singleCount,
      subscriptionCount,
    },
    statusCounts,
    categories,
    products,
  });
}
