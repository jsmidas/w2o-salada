import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "../../../../lib/auth-guard";
import { cleanText } from "../../../../lib/validate";
import { isOrderable } from "../../../../lib/cutoff";

/**
 * 날짜별 배송 중지 (기상·기사 부족 등)
 *   GET    ?from=YYYY-MM-DD           목록 (기본: 오늘부터) + 날짜별 영향 건수
 *   POST   { date, zoneId|null, reason }  등록 — 그 날짜에 이미 잡힌 배송 건(단건·구독)을 보류로 표시하고 영향 요약을 돌려준다
 *   POST   { action: "credit", id }   그 중지에 걸린 결제된 구독 배송분을 크레딧으로 돌린다 (건너뛰기와 같은 정산)
 *   DELETE { id }                     해제 — 이 중지 때문에 보류된 배송 건을 다시 푼다
 *
 * 새 주문은 delivery-zone.ts checkOrderable 이 막고, 배송 건 생성(subscription-delivery.ts)은 suspensionsOn 으로 보류를 건다.
 */
const HOLD_PREFIX = "권역 배송 중지 — ";

function parseDate(v: unknown): Date | null {
  const s = String(v ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 이 중지에 걸리는 배송 건 조건 — 해당 날짜 + (전체 또는 권역 매칭 배송지) */
function affectedOrdersWhere(s: { date: Date; zoneId: string | null; zone?: { kind: "ZIP" | "BCODE"; code: string } | null }): Prisma.OrderWhereInput {
  const addr: Prisma.AddressWhereInput | undefined = s.zoneId
    ? { OR: [{ zoneId: s.zoneId }, s.zone?.kind === "ZIP" ? { zipCode: s.zone.code } : s.zone ? { bcode: { startsWith: s.zone.code } } : { zoneId: s.zoneId }] }
    : undefined;
  return {
    deliveryDate: s.date,
    type: { in: ["SINGLE", "SUBSCRIPTION_DELIVERY"] },
    status: { in: ["PENDING", "PAID", "PREPARING"] },
    ...(addr ? { address: addr } : {}),
  };
}

async function impactOf(s: { id: string; date: Date; zoneId: string | null; zone: { kind: "ZIP" | "BCODE"; code: string } | null }) {
  const where = affectedOrdersWhere(s);
  const [single, subDeliveries] = await Promise.all([
    prisma.order.count({ where: { ...where, type: "SINGLE" } }),
    prisma.order.count({ where: { ...where, type: "SUBSCRIPTION_DELIVERY" } }),
  ]);
  // 아직 배송 건이 안 만들어진 구독 선택분도 센다 (결제된 주기)
  const selWhere: Prisma.SubscriptionSelectionWhereInput = {
    deliveryDate: s.date,
    subscriptionPeriod: {
      status: { in: ["PAID", "DELIVERING"] },
      subscription: {
        status: { in: ["ACTIVE"] },
        ...(s.zoneId ? { address: (affectedOrdersWhere(s).address as Prisma.AddressWhereInput) } : {}),
      },
    },
  };
  const selections = await prisma.subscriptionSelection.findMany({ where: selWhere, select: { subscriptionPeriod: { select: { subscriptionId: true } } } });
  const subIds = new Set(selections.map((x) => x.subscriptionPeriod.subscriptionId));
  return { singleOrders: single, subscriptionDeliveries: subDeliveries, subscriptions: subIds.size, editable: isOrderable(s.date.toISOString().slice(0, 10)) };
}

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;
  try {
    const from = parseDate(request.nextUrl.searchParams.get("from")) ?? new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    const rows = await prisma.deliveryZoneSuspension.findMany({
      where: { date: { gte: from } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      include: { zone: { select: { id: true, name: true, kind: true, code: true, isActive: true } } },
    });
    const suspensions = [];
    for (const r of rows) {
      suspensions.push({ ...r, date: r.date.toISOString().slice(0, 10), impact: await impactOf({ id: r.id, date: r.date, zoneId: r.zoneId, zone: r.zone }) });
    }
    return NextResponse.json({ suspensions });
  } catch (err) {
    console.error("GET /api/admin/delivery-zones/suspensions error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAdmin("orders");
  if (error) return error;
  try {
    const body = (await request.json()) as { action?: string; id?: string; date?: string; zoneId?: string | null; reason?: string };

    if (body.action === "credit") return creditAffected(String(body.id ?? ""));

    const date = parseDate(body.date);
    if (!date) return NextResponse.json({ error: "날짜 형식은 YYYY-MM-DD" }, { status: 400 });
    const reason = cleanText(body.reason, 100);
    if (!reason) return NextResponse.json({ error: "사유를 입력해주세요 (고객 안내 문구에 들어갑니다)." }, { status: 400 });
    const zoneId = body.zoneId ? String(body.zoneId) : null;
    let zone: { kind: "ZIP" | "BCODE"; code: string } | null = null;
    if (zoneId) {
      const z = await prisma.deliveryZone.findUnique({ where: { id: zoneId }, select: { kind: true, code: true } });
      if (!z) return NextResponse.json({ error: "권역을 찾을 수 없습니다." }, { status: 400 });
      zone = z;
    }
    // 유니크 인덱스는 NULL 을 구분하지 못하므로 "전체 중지" 중복은 여기서 막는다
    const dup = await prisma.deliveryZoneSuspension.findFirst({ where: { date, zoneId } });
    if (dup) return NextResponse.json({ error: "같은 날짜·권역의 중지가 이미 있습니다." }, { status: 409 });

    const adminId = (session!.user as { id?: string }).id ?? null;
    const created = await prisma.deliveryZoneSuspension.create({ data: { date, zoneId, reason, createdById: adminId } });

    // 이미 잡힌 배송 건은 보류로 — 코스·피킹·기사 출력에서 빠진다. 사유 접두어로 나중에 해제할 때 구분한다
    const held = await prisma.order.updateMany({
      where: { ...affectedOrdersWhere({ date, zoneId, zone }), deliveryHold: false },
      data: { deliveryHold: true, deliveryHoldReason: `${HOLD_PREFIX}${reason}`, deliveryHoldResolvedAt: null },
    });
    const impact = await impactOf({ id: created.id, date, zoneId, zone });
    return NextResponse.json({ suspension: { ...created, date: body.date }, held: held.count, impact }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/delivery-zones/suspensions error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;
  try {
    const { id } = (await request.json()) as { id: string };
    if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
    const s = await prisma.deliveryZoneSuspension.findUnique({ where: { id }, include: { zone: { select: { kind: true, code: true } } } });
    if (!s) return NextResponse.json({ error: "중지 기록이 없습니다." }, { status: 404 });
    await prisma.deliveryZoneSuspension.delete({ where: { id } });
    // 이 중지로 보류된 건만 되돌린다 (권역 밖·좌표 불명 등 다른 사유의 보류는 그대로)
    const released = await prisma.order.updateMany({
      where: { ...affectedOrdersWhere({ date: s.date, zoneId: s.zoneId, zone: s.zone }), deliveryHold: true, deliveryHoldReason: `${HOLD_PREFIX}${s.reason}` },
      data: { deliveryHold: false, deliveryHoldReason: null },
    });
    return NextResponse.json({ ok: true, released: released.count });
  } catch (err) {
    console.error("DELETE /api/admin/delivery-zones/suspensions error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

/**
 * 중지일에 걸린 결제된 구독 배송분을 크레딧으로 돌린다 — 건너뛰기(/api/subscribe/next/skip)와 같은 정산.
 * 자동 갱신(빌링키) 구독만 크레딧이 의미 있다. "이번 주기만" 구독은 다음 결제가 없으므로 건수만 알려주고 환불 신청으로 안내한다.
 */
async function creditAffected(id: string) {
  const s = await prisma.deliveryZoneSuspension.findUnique({ where: { id }, include: { zone: { select: { kind: true, code: true } } } });
  if (!s) return NextResponse.json({ error: "중지 기록이 없습니다." }, { status: 404 });
  const addr = s.zoneId ? (affectedOrdersWhere({ date: s.date, zoneId: s.zoneId, zone: s.zone }).address as Prisma.AddressWhereInput) : undefined;
  const selections = await prisma.subscriptionSelection.findMany({
    where: {
      deliveryDate: s.date,
      subscriptionPeriod: { status: { in: ["PAID", "DELIVERING"] }, subscription: { status: "ACTIVE", ...(addr ? { address: addr } : {}) } },
    },
    include: {
      product: { select: { price: true } },
      subscriptionPeriod: { select: { subscription: { select: { id: true, autoRenew: true, billingKey: true }, omit: { billingKey: false } } } },
    },
  });
  const bySub = new Map<string, { amount: number; creditable: boolean; ids: string[] }>();
  for (const sel of selections) {
    const sub = sel.subscriptionPeriod.subscription;
    const e = bySub.get(sub.id) ?? { amount: 0, creditable: sub.autoRenew && !!sub.billingKey, ids: [] };
    e.amount += (sel.unitPrice ?? sel.product.price) * sel.quantity;
    e.ids.push(sel.id);
    bySub.set(sub.id, e);
  }
  let credited = 0, creditedAmount = 0, notCreditable = 0;
  for (const [subId, e] of bySub) {
    if (!e.creditable) { notCreditable++; continue; }
    await prisma.$transaction(async (tx) => {
      await tx.subscriptionSelection.deleteMany({ where: { id: { in: e.ids } } });
      const orders = await tx.order.findMany({ where: { subscriptionId: subId, type: "SUBSCRIPTION_DELIVERY", deliveryDate: s.date, status: { in: ["PENDING", "PAID"] } }, select: { id: true } });
      for (const o of orders) {
        await tx.delivery.deleteMany({ where: { orderId: o.id } });
        await tx.orderItem.deleteMany({ where: { orderId: o.id } });
        await tx.order.delete({ where: { id: o.id } });
      }
      if (e.amount > 0) await tx.subscription.update({ where: { id: subId }, data: { creditBalance: { increment: e.amount } } });
    });
    credited++;
    creditedAmount += e.amount;
  }
  return NextResponse.json({ ok: true, credited, creditedAmount, notCreditable });
}
