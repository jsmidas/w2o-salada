import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../../lib/auth-guard";

// Delivery.driverId는 Phase 4 기사 배정 전까지 "코스 라벨"로 재사용한다.
// (예: "A", "강남-1") — 실제 DRIVER User 연결은 향후 별도 필드로 분리.

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;

  try {
    const { searchParams } = request.nextUrl;
    const dateParam = searchParams.get("date");
    if (!dateParam) {
      return NextResponse.json({ error: "date 파라미터가 필요합니다." }, { status: 400 });
    }

    const targetDate = new Date(dateParam + "T00:00:00");
    if (Number.isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: "유효하지 않은 날짜입니다." }, { status: 400 });
    }
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const fetchOrders = () =>
      prisma.order.findMany({
        where: {
          deliveryDate: { gte: targetDate, lt: nextDay },
          status: { in: ["PAID", "PREPARING", "SHIPPING", "DELIVERED"] },
        },
        include: {
          user: true,
          address: true,
          items: { include: { product: { include: { category: true } } } },
          delivery: true,
        },
        orderBy: { createdAt: "asc" },
      });

    let orders = await fetchOrders();

    // 배송 대상이지만 Delivery 레코드가 없는 주문은 즉시 생성
    const missing = orders.filter((o) => !o.delivery);
    if (missing.length > 0) {
      await prisma.$transaction(
        missing.map((o) =>
          prisma.delivery.create({
            data: {
              orderId: o.id,
              scheduledDate: o.deliveryDate ?? targetDate,
              status: "PENDING",
            },
          })
        )
      );
      orders = await fetchOrders();
    }

    // ── 상품 집계 (생산·패킹 리스트용) ──
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

    // ── 카테고리별 소계 ──
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

    // ── 고객/주문 단순화 (피킹 리스트 + 코스 그룹핑용) ──
    const simplifiedOrders = orders.map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      type: o.type,
      status: o.status,
      totalAmount: o.totalAmount,
      customer: {
        id: o.user.id,
        name: o.user.name,
        phone: o.user.phone ?? o.address?.phone ?? "",
      },
      address: o.address
        ? {
            receiver: o.address.name,
            phone: o.address.phone,
            zipCode: o.address.zipCode,
            address1: o.address.address1,
            address2: o.address.address2 ?? "",
            memo: o.address.deliveryMemo ?? "",
          }
        : null,
      items: o.items.map((it) => ({
        productId: it.productId,
        name: it.product.name,
        categorySlug: it.product.category.slug,
        categoryName: it.product.category.name,
        isOption: it.product.category.isOption,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
      })),
      delivery: o.delivery
        ? {
            id: o.delivery.id,
            routeLabel: o.delivery.driverId ?? "",
            sortOrder: o.delivery.sortOrder,
            status: o.delivery.status,
          }
        : null,
    }));

    // ── 코스별 그룹핑 (미배정 = "") ──
    type SimplifiedOrder = (typeof simplifiedOrders)[number];
    const routeMap = new Map<string, SimplifiedOrder[]>();
    for (const order of simplifiedOrders) {
      const label = order.delivery?.routeLabel || "";
      const list = routeMap.get(label) ?? [];
      list.push(order);
      routeMap.set(label, list);
    }
    const routes = Array.from(routeMap.entries())
      .map(([label, list]) => ({
        label: label || null,
        orderCount: list.length,
        totalAmount: list.reduce((sum, o) => sum + o.totalAmount, 0),
        orders: list.sort(
          (a, b) => (a.delivery?.sortOrder ?? 0) - (b.delivery?.sortOrder ?? 0)
        ),
      }))
      .sort((a, b) => {
        if (!a.label) return 1;
        if (!b.label) return -1;
        return a.label.localeCompare(b.label);
      });

    const totalRevenue = mainRevenue + optionRevenue;

    return NextResponse.json({
      date: dateParam,
      totals: {
        orderCount: orders.length,
        totalBoxes: orders.length,
        totalRevenue,
        mainRevenue,
        optionRevenue,
        productKinds: products.length,
        assignedCount: simplifiedOrders.filter((o) => o.delivery?.routeLabel).length,
        unassignedCount: simplifiedOrders.filter((o) => !o.delivery?.routeLabel).length,
      },
      categories,
      products,
      routes,
      orders: simplifiedOrders,
    });
  } catch (err) {
    console.error("GET /api/admin/delivery/report error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
