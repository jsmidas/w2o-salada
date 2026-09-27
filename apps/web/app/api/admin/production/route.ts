import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../lib/auth-guard";

/**
 * 생산 집계 (주방 작업지시용)
 *
 * 그날 나가야 할 물량은 두 갈래다.
 *  - 구독: SubscriptionSelection (배송일별 고객 선택) — 현재 물량의 대부분
 *  - 단건: Order + OrderItem (deliveryDate 기준)
 * /api/admin/delivery/report 는 Order만 집계해서 구독 물량이 빠지므로,
 * 생산계획은 두 소스를 합산하는 이 엔드포인트를 쓴다.
 *
 * 확정/대기 구분
 *  - 확정: 결제가 끝나 반드시 생산해야 하는 수량
 *  - 대기: 아직 결제 전(PENDING) — 참고용. 취소분은 아예 제외한다.
 */

// 생산 대상에서 제외할 상태
const EXCLUDED_ORDER_STATUS = ["CANCELLED", "REFUNDED", "FAILED"];
const CONFIRMED_ORDER_STATUS = ["PAID", "PREPARING", "SHIPPING", "DELIVERED"];
const CONFIRMED_PERIOD_STATUS = ["PAID", "DELIVERING", "COMPLETED"];

type Row = {
  productId: string;
  name: string;
  categoryName: string;
  categorySlug: string;
  categoryColor: string | null;
  isOption: boolean;
  subscriptionQty: number;
  orderQty: number;
  confirmedQty: number;
  pendingQty: number;
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
    const [selections, orders] = await Promise.all([
      prisma.subscriptionSelection.findMany({
        where: {
          deliveryDate: { gte: start, lt: end },
          subscriptionPeriod: {
            status: { in: ["PAID", "DELIVERING", "COMPLETED"] }, // 결제된 주기만 (배송 건 생성과 같은 기준)
            subscription: { status: { notIn: ["CANCELLED", "PAUSED"] } },
          },
        },
        include: {
          product: { include: { category: true } },
          subscriptionPeriod: { select: { status: true, subscription: { select: { userId: true } } } },
        },
      }),
      prisma.order.findMany({
        where: {
          deliveryDate: { gte: start, lt: end },
          status: { notIn: EXCLUDED_ORDER_STATUS as never[] },
          // 구독 물량은 위의 선택분(SubscriptionSelection)으로 센다.
          // 월 결제 주문(SUBSCRIPTION)·배송일별 배송 건(SUBSCRIPTION_DELIVERY)까지 더하면 2~3중 계산이 된다
          type: "SINGLE",
        },
        include: { items: { include: { product: { include: { category: true } } } } },
      }),
    ]);

    const rows = new Map<string, Row>();
    const touch = (p: { id: string; name: string; category: { name: string; slug: string; color: string | null; isOption: boolean } }): Row => {
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
          confirmedQty: 0,
          pendingQty: 0,
          qty: 0,
        };
        rows.set(p.id, r);
      }
      return r;
    };

    const subscribers = new Set<string>();
    for (const s of selections) {
      const r = touch(s.product);
      const confirmed = CONFIRMED_PERIOD_STATUS.includes(s.subscriptionPeriod.status);
      r.subscriptionQty += s.quantity;
      if (confirmed) r.confirmedQty += s.quantity;
      else r.pendingQty += s.quantity;
      r.qty += s.quantity;
      subscribers.add(s.subscriptionPeriod.subscription.userId);
    }

    for (const o of orders) {
      const confirmed = CONFIRMED_ORDER_STATUS.includes(o.status);
      for (const it of o.items) {
        const r = touch(it.product);
        r.orderQty += it.quantity;
        if (confirmed) r.confirmedQty += it.quantity;
        else r.pendingQty += it.quantity;
        r.qty += it.quantity;
      }
    }

    // 본품 먼저, 그 안에서 카테고리 순, 수량 많은 순
    const products = Array.from(rows.values()).sort((a, b) => {
      if (a.isOption !== b.isOption) return a.isOption ? 1 : -1;
      if (a.categorySlug !== b.categorySlug) return a.categorySlug.localeCompare(b.categorySlug);
      return b.qty - a.qty;
    });

    const catMap = new Map<string, { slug: string; name: string; color: string | null; isOption: boolean; qty: number; confirmedQty: number; pendingQty: number; productCount: number }>();
    for (const p of products) {
      let c = catMap.get(p.categorySlug);
      if (!c) {
        c = { slug: p.categorySlug, name: p.categoryName, color: p.categoryColor, isOption: p.isOption, qty: 0, confirmedQty: 0, pendingQty: 0, productCount: 0 };
        catMap.set(p.categorySlug, c);
      }
      c.qty += p.qty;
      c.confirmedQty += p.confirmedQty;
      c.pendingQty += p.pendingQty;
      c.productCount += 1;
    }
    const categories = Array.from(catMap.values()).sort((a, b) => {
      if (a.isOption !== b.isOption) return a.isOption ? 1 : -1;
      return a.slug.localeCompare(b.slug);
    });

    const sum = (key: "qty" | "confirmedQty" | "pendingQty") =>
      products.reduce((s, p) => s + p[key], 0);

    return NextResponse.json({
      date: dateParam,
      summary: {
        totalQty: sum("qty"),
        confirmedQty: sum("confirmedQty"),
        pendingQty: sum("pendingQty"),
        productCount: products.length,
        subscriptionQty: products.reduce((s, p) => s + p.subscriptionQty, 0),
        orderQty: products.reduce((s, p) => s + p.orderQty, 0),
        subscriberCount: subscribers.size,
        orderCount: orders.length,
      },
      categories,
      products,
    });
  } catch (err) {
    console.error("GET /api/admin/production error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
