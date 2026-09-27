import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../../lib/auth-guard";
import { DELIVERABLE_ORDER_TYPES, ensureSubscriptionDeliveries } from "../../../../lib/subscription-delivery";
import { getDeliveryCenter } from "../../../../lib/geo";

// Delivery.driverId는 Phase 4 기사 배정 전까지 "코스 라벨"로 재사용한다.
// (예: "A", "강남-1") — 실제 DRIVER User 연결은 향후 별도 필드로 분리.
//
// 배송 대상 = 단건 주문(SINGLE) + 구독 배송일별 배송 건(SUBSCRIPTION_DELIVERY).
// 구독 월 결제 주문(SUBSCRIPTION)은 돈의 기록이라 여기서 제외한다.

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

    // 구독 배송 건을 이 날짜 선택분과 맞춘다 (마감 전이면 최신 선택분 반영, 멱등)
    await ensureSubscriptionDeliveries(targetDate);

    const fetchOrders = () =>
      prisma.order.findMany({
        where: {
          deliveryDate: { gte: targetDate, lt: nextDay },
          status: { in: ["PAID", "PREPARING", "SHIPPING", "DELIVERED"] },
          type: { in: [...DELIVERABLE_ORDER_TYPES] },
        },
        include: {
          user: true,
          address: true,
          items: { include: { product: { include: { category: true } } } },
          delivery: { include: { route: { select: { id: true, name: true, isActive: true } } } },
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

    // 고정 코스 원칙 — 미배정인데 배송지가 지난번 코스를 기억하면 그 코스로 자동 채운다 (보류 건 제외)
    const routeMaster = await prisma.deliveryRoute.findMany({
      where: { isActive: true },
      orderBy: [{ departOrder: "asc" }, { name: "asc" }],
      include: { driver: { select: { name: true } } },
    });
    const activeRoute = new Map(routeMaster.map((r) => [r.id, r]));
    const autoFill = orders.filter(
      (o) => o.delivery && !o.delivery.routeId && o.address?.lastRouteId && activeRoute.has(o.address.lastRouteId) && !(o.deliveryHold && !o.deliveryHoldResolvedAt),
    );
    if (autoFill.length > 0) {
      await prisma.$transaction(
        autoFill.map((o) =>
          prisma.delivery.update({
            where: { id: o.delivery!.id },
            data: { routeId: o.address!.lastRouteId!, driverId: activeRoute.get(o.address!.lastRouteId!)!.name },
          }),
        ),
      );
      orders = await fetchOrders();
    }
    const autoFilledIds = new Set(autoFill.map((o) => o.id));

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
      addressId: o.addressId,
      deliveryHold: o.deliveryHold && !o.deliveryHoldResolvedAt,
      deliveryHoldReason: o.deliveryHoldReason,
      address: o.address
        ? {
            receiver: o.address.name,
            phone: o.address.phone,
            zipCode: o.address.zipCode,
            address1: o.address.address1,
            address2: o.address.address2 ?? "",
            memo: o.address.deliveryMemo ?? "",
            label: o.address.label ?? "",
            // 코스 편성용 위치 정보
            sigungu: o.address.sigungu ?? "",
            bname: o.address.bname ?? "",
            buildingName: o.address.buildingName ?? "",
            isApartment: o.address.isApartment,
            distanceKm: o.address.distanceKm,
            areaStatus: o.address.areaStatus,
            // 지도 핀용 좌표 (카카오 지오코딩 결과, 없으면 null)
            lat: o.address.lat,
            lng: o.address.lng,
            // 출입·수령 정보 (기사 출력본용)
            entranceMethod: o.address.entranceMethod ?? "",
            entrancePassword: o.address.entrancePassword ?? "",
            floor: o.address.floor ?? "",
            dropLocation: o.address.dropLocation,
            dropNote: o.address.dropNote ?? "",
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
            routeId: o.delivery.routeId,
            routeLabel: o.delivery.route?.name ?? o.delivery.driverId ?? "",
            autoFilled: autoFilledIds.has(o.id),
            sortOrder: o.delivery.sortOrder,
            status: o.delivery.status,
            photoUrl: o.delivery.photoUrl,
            memo: o.delivery.memo,
            completedAt: o.delivery.completedAt,
          }
        : null,
    }));

    // ── 배송지 확인 대기(반경 밖·좌표 불명, 미처리)는 코스 편성·출력에서 뺀다 ──
    const heldOrders = simplifiedOrders.filter((o) => o.deliveryHold);
    const deliverable = simplifiedOrders.filter((o) => !o.deliveryHold);

    // 같은 집(배송지)은 1스톱 — 단건 + 구독이 같은 날 같은 주소면 나란히 놓고 하나로 센다
    const stopKey = (o: (typeof simplifiedOrders)[number]) => o.addressId ?? `order:${o.id}`;
    const stops = new Set(deliverable.map(stopKey)).size;

    // ── 코스별 그룹핑 (미배정 = "") ──
    type SimplifiedOrder = (typeof simplifiedOrders)[number];
    const routeMap = new Map<string, SimplifiedOrder[]>();
    for (const order of deliverable) {
      const label = order.delivery?.routeLabel || "";
      const list = routeMap.get(label) ?? [];
      list.push(order);
      routeMap.set(label, list);
    }
    const routes = Array.from(routeMap.entries())
      .map(([label, list]) => ({
        label: label || null,
        orderCount: list.length,
        stopCount: new Set(list.map(stopKey)).size,
        totalAmount: list.reduce((sum, o) => sum + o.totalAmount, 0),
        orders: list.sort((a, b) => {
          const d = (a.delivery?.sortOrder ?? 0) - (b.delivery?.sortOrder ?? 0);
          return d !== 0 ? d : stopKey(a).localeCompare(stopKey(b)); // 같은 집은 붙여서
        }),
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
        orderCount: deliverable.length,
        totalBoxes: deliverable.length,
        stops,
        heldCount: heldOrders.length,
        totalRevenue,
        mainRevenue,
        optionRevenue,
        productKinds: products.length,
        assignedCount: deliverable.filter((o) => o.delivery?.routeLabel).length,
        unassignedCount: deliverable.filter((o) => !o.delivery?.routeLabel).length,
      },
      categories,
      products,
      routes,
      orders: deliverable,
      heldOrders,
      // 물류센터 좌표·반경 — 지도 중심과 배송 권역 원
      center: await getDeliveryCenter().then((c) => ({ name: c.name, lat: c.lat, lng: c.lng, radiusKm: c.radiusKm })),
      // 코스 마스터 — 편성 드롭다운·코스 카드(기사·용량)용
      routeMaster: routeMaster.map((r) => ({
        id: r.id,
        name: r.name,
        driverName: r.driver?.name ?? null,
        maxStops: r.maxStops,
        ownership: r.ownership,
        departOrder: r.departOrder,
        color: r.color,
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/delivery/report error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
