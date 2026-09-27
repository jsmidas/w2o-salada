import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireDriver } from "../../../lib/auth-guard";
import { routesForDriver } from "../../../lib/driver-access";
import { dayRange, todayKst } from "../../../lib/delivery-status";
import { DELIVERABLE_ORDER_TYPES } from "../../../lib/subscription-delivery";

/**
 * 기사 앱 메인 데이터 — 내 코스의 그날 배송 목록 (배송 순번순) + 상차 체크리스트.
 * GET /api/driver/today?date=YYYY-MM-DD (기본: KST 오늘)
 */
export async function GET(request: NextRequest) {
  const { error, session, isAdmin } = await requireDriver();
  if (error) return error;
  const me = session!.user as { id: string; name?: string | null };

  try {
    const date = request.nextUrl.searchParams.get("date") ?? todayKst();
    const range = dayRange(date);
    if (!range) return NextResponse.json({ error: "유효하지 않은 날짜입니다." }, { status: 400 });

    const routes = await routesForDriver(me.id, isAdmin);
    if (routes.length === 0) {
      return NextResponse.json({ date, driverName: me.name ?? "", isAdmin, routes: [] });
    }

    const deliveries = await prisma.delivery.findMany({
      where: {
        routeId: { in: routes.map((r) => r.id) },
        scheduledDate: { gte: range.start, lt: range.end },
        order: {
          status: { in: ["PAID", "PREPARING", "SHIPPING", "DELIVERED"] },
          type: { in: [...DELIVERABLE_ORDER_TYPES] },
          // 배송지 확인 보류(미처리) 건은 기사에게 보내지 않는다
          OR: [{ deliveryHold: false }, { deliveryHoldResolvedAt: { not: null } }],
        },
      },
      include: {
        order: {
          include: {
            user: { select: { name: true, phone: true } },
            address: true,
            items: { include: { product: { include: { category: { select: { isOption: true } } } } } },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });

    const byRoute = new Map<string, typeof deliveries>();
    for (const d of deliveries) {
      const list = byRoute.get(d.routeId!) ?? [];
      list.push(d);
      byRoute.set(d.routeId!, list);
    }

    const result = routes
      .map((r) => {
        const list = byRoute.get(r.id) ?? [];
        // 상차 체크리스트 — 코스 전체 상품 합계
        const productMap = new Map<string, { name: string; quantity: number; isOption: boolean }>();
        for (const d of list) {
          for (const it of d.order.items) {
            const cur = productMap.get(it.productId);
            if (cur) cur.quantity += it.quantity;
            else productMap.set(it.productId, { name: it.product.name, quantity: it.quantity, isOption: it.product.category.isOption });
          }
        }
        const products = Array.from(productMap.values()).sort((a, b) => {
          if (a.isOption !== b.isOption) return a.isOption ? 1 : -1;
          return b.quantity - a.quantity;
        });

        const stops = list.map((d, i) => {
          const a = d.order.address;
          return {
            deliveryId: d.id,
            orderNo: d.order.orderNo,
            isSubscription: d.order.type !== "SINGLE",
            status: d.status,
            photoUrl: d.photoUrl,
            memo: d.memo,
            startedAt: d.startedAt,
            completedAt: d.completedAt,
            sortOrder: d.sortOrder || i + 1,
            receiver: a?.name ?? d.order.user.name,
            phone: a?.phone ?? d.order.user.phone ?? "",
            zipCode: a?.zipCode ?? "",
            address1: a?.address1 ?? "",
            address2: a?.address2 ?? "",
            buildingName: a?.buildingName ?? "",
            floor: a?.floor ?? "",
            entranceMethod: a?.entranceMethod ?? "",
            entrancePassword: a?.entrancePassword ?? "",
            dropLocation: a?.dropLocation ?? "DOOR",
            dropNote: a?.dropNote ?? "",
            deliveryMemo: a?.deliveryMemo ?? "",
            lat: a?.lat ?? null,
            lng: a?.lng ?? null,
            items: d.order.items.map((it) => ({
              name: it.product.name,
              quantity: it.quantity,
              isOption: it.product.category.isOption,
            })),
          };
        });

        const count = (s: string) => stops.filter((x) => x.status === s).length;
        return {
          id: r.id,
          name: r.name,
          color: r.color,
          vehicleNo: r.vehicleNo,
          isMine: r.driverUserId === me.id,
          summary: {
            total: stops.length,
            boxes: stops.reduce((sum, s) => sum + s.items.reduce((q, it) => q + it.quantity, 0), 0),
            pending: count("PENDING"),
            inTransit: count("IN_TRANSIT"),
            delivered: count("DELIVERED"),
            failed: count("FAILED"),
          },
          products,
          stops,
        };
      })
      // 관리자 점검 모드에서는 배송이 없는 코스는 숨긴다. 기사에겐 빈 코스도 보여 "오늘 배송 없음"을 알린다
      .filter((r) => !isAdmin || r.stops.length > 0);

    return NextResponse.json({ date, driverName: me.name ?? "", isAdmin, routes: result });
  } catch (err) {
    console.error("GET /api/driver/today error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
