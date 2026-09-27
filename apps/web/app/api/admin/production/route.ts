import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../lib/auth-guard";
import { DELIVERABLE_ORDER_TYPES, DELIVERY_ORDER_TYPE, ensureSubscriptionDeliveries } from "../../../lib/subscription-delivery";

/**
 * 생산 집계 (주방 작업지시용)
 *
 * 배송 리포트(/api/admin/delivery/report)와 **같은 소스**를 본다 —
 * 그날의 배송 건(Order)이 단일 기준이다.
 *   - 단건 주문           : type SINGLE
 *   - 구독 배송일별 배송 건 : type SUBSCRIPTION_DELIVERY (ensureSubscriptionDeliveries가 생성)
 *   - 구독 월 결제 주문     : type SUBSCRIPTION — 돈의 기록이라 제외
 *
 * 예전에는 구독 물량을 SubscriptionSelection에서 직접 세어 리포트와 수량이
 * 어긋날 수 있었다. 마감 전 선택 변경은 ensureSubscriptionDeliveries가
 * 배송 건에 반영하고, 마감 후에는 배송 건이 확정본이 된다.
 *
 * 보류(deliveryHold) 건은 배송지 문제로 나가지 못할 수 있어 **별도로 센다.**
 * 총 생산 수량에는 포함하되 화면에서 따로 보여준다.
 */

// 배송 대상으로 잡는 주문 상태 (리포트와 동일 기준)
const DELIVERABLE_STATUS = ["PAID", "PREPARING", "SHIPPING", "DELIVERED"] as const;

type Row = {
  productId: string;
  name: string;
  categoryName: string;
  categorySlug: string;
  categoryColor: string | null;
  isOption: boolean;
  subscriptionQty: number;
  orderQty: number;
  holdQty: number;
  qty: number;
};

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;

  const { searchParams } = request.nextUrl;
  const dateParam = searchParams.get("date");
  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: "date=YYYY-MM-DD 파라미터가 필요합니다." }, { status: 400 });
  }

  // 배송일은 UTC 자정으로 저장된다. 서버 타임존에 흔들리지 않도록 UTC로 고정해 비교한다.
  const start = new Date(`${dateParam}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "유효하지 않은 날짜입니다." }, { status: 400 });
  }
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  try {
    // 구독 배송 건을 이 날짜 선택분과 맞춘다 (마감 전이면 최신 선택분 반영, 멱등)
    await ensureSubscriptionDeliveries(start);

    const orders = await prisma.order.findMany({
      where: {
        deliveryDate: { gte: start, lt: end },
        status: { in: [...DELIVERABLE_STATUS] },
        type: { in: [...DELIVERABLE_ORDER_TYPES] },
      },
      include: {
        user: { select: { id: true, name: true } },
        items: { include: { product: { include: { category: true } } } },
      },
    });

    const rows = new Map<string, Row>();
    const touch = (p: {
      id: string;
      name: string;
      category: { name: string; slug: string; color: string | null; isOption: boolean };
    }): Row => {
      let r = rows.get(p.id);
      if (!r) {
        r = {
          productId: p.id,
          name: p.name,
          categoryName: p.category.name,
          categorySlug: p.category.slug,
          categoryColor: p.category.color,
          isOption: p.category.isOption,
          subscriptionQty: 0,
          orderQty: 0,
          holdQty: 0,
          qty: 0,
        };
        rows.set(p.id, r);
      }
      return r;
    };

    const subscribers = new Set<string>();
    const holds: { orderNo: string; customer: string; reason: string; itemCount: number }[] = [];
    let singleCount = 0;

    for (const o of orders) {
      const isSubscription = o.type === DELIVERY_ORDER_TYPE;
      if (isSubscription) subscribers.add(o.userId);
      else singleCount++;

      if (o.deliveryHold) {
        holds.push({
          orderNo: o.orderNo,
          customer: o.user?.name ?? "-",
          reason: o.deliveryHoldReason ?? "사유 미기재",
          itemCount: o.items.reduce((s, it) => s + it.quantity, 0),
        });
      }

      for (const it of o.items) {
        const r = touch(it.product);
        if (isSubscription) r.subscriptionQty += it.quantity;
        else r.orderQty += it.quantity;
        if (o.deliveryHold) r.holdQty += it.quantity;
        r.qty += it.quantity;
      }
    }

    // 본품 먼저, 그 안에서 카테고리 순, 수량 많은 순
    const products = Array.from(rows.values()).sort((a, b) => {
      if (a.isOption !== b.isOption) return a.isOption ? 1 : -1;
      if (a.categorySlug !== b.categorySlug) return a.categorySlug.localeCompare(b.categorySlug);
      return b.qty - a.qty;
    });

    const catMap = new Map<
      string,
      { slug: string; name: string; color: string | null; isOption: boolean; qty: number; holdQty: number; productCount: number }
    >();
    for (const p of products) {
      let c = catMap.get(p.categorySlug);
      if (!c) {
        c = { slug: p.categorySlug, name: p.categoryName, color: p.categoryColor, isOption: p.isOption, qty: 0, holdQty: 0, productCount: 0 };
        catMap.set(p.categorySlug, c);
      }
      c.qty += p.qty;
      c.holdQty += p.holdQty;
      c.productCount += 1;
    }
    const categories = Array.from(catMap.values()).sort((a, b) => {
      if (a.isOption !== b.isOption) return a.isOption ? 1 : -1;
      return a.slug.localeCompare(b.slug);
    });

    const sum = (key: "qty" | "holdQty" | "subscriptionQty" | "orderQty") =>
      products.reduce((s, p) => s + p[key], 0);

    return NextResponse.json({
      date: dateParam,
      summary: {
        totalQty: sum("qty"),
        holdQty: sum("holdQty"),
        productCount: products.length,
        subscriptionQty: sum("subscriptionQty"),
        orderQty: sum("orderQty"),
        subscriberCount: subscribers.size,
        orderCount: singleCount,
        holdOrderCount: holds.length,
      },
      categories,
      products,
      holds,
    });
  } catch (err) {
    console.error("GET /api/admin/production error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
