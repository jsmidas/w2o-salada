import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "../../../lib/auth-guard";
import { cleanText } from "../../../lib/validate";
import { normBcode, normZip } from "../../../lib/delivery-zone";

/**
 * 배송 권역 관리
 *   GET    ?q=검색어            목록 (+권역별 배송지 수·활성 구독 수)
 *   GET    ?impact=<zoneId>     이 권역을 끄면 영향받는 활성 구독·다가오는 주문 수 (끄기 전 확인 창용)
 *   POST   { kind, code, name, ... } 단건 / { rows: [...] } 일괄 (CSV) — (kind, code) 기준 upsert
 *   PATCH  { id, isActive?, name?, memo?, sido?, sigungu? }
 *   DELETE { id }
 */
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;

  try {
    const impactId = request.nextUrl.searchParams.get("impact");
    if (impactId) return NextResponse.json(await zoneImpact(impactId));

    const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
    const where: Prisma.DeliveryZoneWhereInput = q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { startsWith: q } }, { sigungu: { contains: q } }, { sido: { contains: q } }] }
      : {};
    const [zones, addrCounts, mode] = await Promise.all([
      prisma.deliveryZone.findMany({ where, orderBy: [{ sigungu: "asc" }, { name: "asc" }, { code: "asc" }] }),
      prisma.address.groupBy({ by: ["zoneId"], _count: { _all: true }, where: { zoneId: { not: null } } }),
      prisma.setting.findUnique({ where: { key: "deliveryZoneMode" } }),
    ]);
    // 권역별 활성 구독 수 — 구독 배송지의 zoneId 캐시로 센다
    const subRows = await prisma.subscription.findMany({
      where: { status: { in: ["ACTIVE", "PAUSED"] }, address: { zoneId: { not: null } } },
      select: { address: { select: { zoneId: true } } },
    });
    const subCount = new Map<string, number>();
    for (const s of subRows) { const z = s.address?.zoneId; if (z) subCount.set(z, (subCount.get(z) ?? 0) + 1); }
    const addrCount = new Map(addrCounts.map((c) => [c.zoneId, c._count._all]));

    const totalActive = zones.filter((z) => z.isActive).length;
    return NextResponse.json({
      mode: mode?.value === "ZONES" ? "ZONES" : "LEGACY",
      total: zones.length,
      active: totalActive,
      zones: zones.map((z) => ({ ...z, addressCount: addrCount.get(z.id) ?? 0, subscriptionCount: subCount.get(z.id) ?? 0 })),
    });
  } catch (err) {
    console.error("GET /api/admin/delivery-zones error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

type Row = { kind?: string; code?: string; name?: string; sido?: string; sigungu?: string; isActive?: string | boolean; memo?: string };

function parseRow(r: Row): { ok: true; data: Prisma.DeliveryZoneCreateInput } | { ok: false; reason: string } {
  const kindRaw = String(r.kind ?? "").trim().toUpperCase();
  const kind = kindRaw === "ZIP" || kindRaw === "우편번호" ? "ZIP" : kindRaw === "BCODE" || kindRaw === "법정동" || kindRaw === "법정동코드" ? "BCODE" : null;
  if (!kind) return { ok: false, reason: `kind 는 ZIP 또는 BCODE: "${r.kind ?? ""}"` };
  const code = kind === "ZIP" ? normZip(String(r.code ?? "")) : normBcode(String(r.code ?? ""));
  if (!code) return { ok: false, reason: kind === "ZIP" ? `우편번호 5자리가 아님: "${r.code ?? ""}"` : `법정동 코드(5~10자리)가 아님: "${r.code ?? ""}"` };
  const name = cleanText(r.name, 80);
  if (!name) return { ok: false, reason: `이름 없음 (${code})` };
  const isActive = r.isActive === undefined || r.isActive === "" ? true : typeof r.isActive === "boolean" ? r.isActive : !["0", "false", "n", "no", "비활성", "off"].includes(String(r.isActive).trim().toLowerCase());
  return { ok: true, data: { kind, code, name, sido: cleanText(r.sido, 40), sigungu: cleanText(r.sigungu, 40), isActive, memo: cleanText(r.memo, 200) } };
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;

  try {
    const body = (await request.json()) as Row & { rows?: Row[] };
    const all = Array.isArray(body.rows) ? body.rows : [body];
    const MAX = 500;
    const rows = all.slice(0, MAX);
    let created = 0, updated = 0;
    const skipped: string[] = [];
    for (const r of rows) {
      const p = parseRow(r);
      if (!p.ok) { skipped.push(p.reason); continue; }
      const res = await prisma.deliveryZone.upsert({
        where: { kind_code: { kind: p.data.kind, code: p.data.code } },
        update: { name: p.data.name, sido: p.data.sido, sigungu: p.data.sigungu, isActive: p.data.isActive, memo: p.data.memo },
        create: p.data,
        select: { createdAt: true, updatedAt: true },
      });
      if (res.updatedAt.getTime() - res.createdAt.getTime() < 1000) created++; else updated++;
    }
    return NextResponse.json({ created, updated, skipped: skipped.length, skippedReasons: skipped.slice(0, 20), processed: rows.length, ignored: all.length - rows.length });
  } catch (err) {
    console.error("POST /api/admin/delivery-zones error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;
  try {
    const { id, ...rest } = (await request.json()) as { id: string; isActive?: boolean; name?: string; memo?: string | null; sido?: string | null; sigungu?: string | null };
    if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
    const data: Prisma.DeliveryZoneUpdateInput = {};
    if (rest.isActive !== undefined) data.isActive = !!rest.isActive;
    if (rest.name !== undefined && String(rest.name).trim()) data.name = String(rest.name).trim().slice(0, 80);
    if (rest.memo !== undefined) data.memo = cleanText(rest.memo, 200);
    if (rest.sido !== undefined) data.sido = cleanText(rest.sido, 40);
    if (rest.sigungu !== undefined) data.sigungu = cleanText(rest.sigungu, 40);
    const zone = await prisma.deliveryZone.update({ where: { id }, data });
    const impact = rest.isActive === false ? await zoneImpact(id) : null;
    return NextResponse.json({ zone, impact });
  } catch (err) {
    console.error("PATCH /api/admin/delivery-zones error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;
  try {
    const { id } = (await request.json()) as { id: string };
    if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
    // 배송지의 zoneId 는 FK SET NULL, 중지 기록은 CASCADE — 다음 판정 때 다시 매칭된다
    await prisma.deliveryZone.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/delivery-zones error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

/** 권역 하나에 걸린 배송지 조건 — 캐시된 zoneId 또는 코드 직접 매칭 (아직 재판정 안 된 주소도 잡는다) */
function addressWhereForZone(z: { id: string; kind: "ZIP" | "BCODE"; code: string }): Prisma.AddressWhereInput {
  return { OR: [{ zoneId: z.id }, z.kind === "ZIP" ? { zipCode: z.code } : { bcode: { startsWith: z.code } }] };
}

async function zoneImpact(zoneId: string) {
  const zone = await prisma.deliveryZone.findUnique({ where: { id: zoneId } });
  if (!zone) return { error: "권역 없음" };
  const where = addressWhereForZone(zone);
  const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  const [subs, upcomingOrders, addresses] = await Promise.all([
    prisma.subscription.findMany({
      where: { status: { in: ["ACTIVE", "PAUSED"] }, address: where },
      select: { id: true, status: true, nextBillingDate: true, user: { select: { name: true, phone: true } }, address: { select: { address1: true, buildingName: true } } },
      orderBy: { nextBillingDate: "asc" },
      take: 200,
    }),
    prisma.order.count({ where: { status: { in: ["PENDING", "PAID", "PREPARING"] }, type: { in: ["SINGLE", "SUBSCRIPTION_DELIVERY"] }, deliveryDate: { gte: today }, address: where } }),
    prisma.address.count({ where }),
  ]);
  return {
    zone: { id: zone.id, name: zone.name, kind: zone.kind, code: zone.code, isActive: zone.isActive },
    activeSubscriptions: subs.length,
    upcomingOrders,
    addresses,
    subscriptions: subs.map((s) => ({
      id: s.id, status: s.status, nextBillingDate: s.nextBillingDate,
      userName: s.user.name, phone: s.user.phone, address: `${s.address?.address1 ?? ""}${s.address?.buildingName ? ` (${s.address.buildingName})` : ""}`,
    })),
  };
}
