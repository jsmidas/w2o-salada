import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../lib/auth-guard";
import { geocodeAddress, getDeliveryCenter, haversineKm } from "../../../lib/geo";

/**
 * 아파트 단지 사전 등록 — 단지명 표기 보정, 침투율 집계, 영업 우선순위용.
 * GET  목록(+단지별 배송지 수)   POST 단건 등록 또는 { rows: [...] } 일괄 등록(CSV 붙여넣기)
 */
export async function GET() {
  const { error } = await requireAdmin("orders");
  if (error) return error;

  try {
    const [apartments, counts] = await Promise.all([
      prisma.apartment.findMany({ orderBy: [{ isServiced: "desc" }, { distanceKm: "asc" }, { name: "asc" }] }),
      prisma.address.groupBy({ by: ["apartmentId"], _count: { _all: true }, where: { apartmentId: { not: null } } }),
    ]);
    const countMap = new Map(counts.map((c) => [c.apartmentId, c._count._all]));

    // 고객 주소에서는 나왔는데 사전 등록이 없는 단지 — 등록 후보
    const unregisteredRows = await prisma.address.groupBy({
      by: ["buildingName", "sigungu", "bname"],
      where: { isApartment: true, apartmentId: null, buildingName: { not: null } },
      _count: { _all: true },
    });
    const unregistered = unregisteredRows
      .map((r) => ({ buildingName: r.buildingName!, sigungu: r.sigungu, bname: r.bname, addressCount: r._count._all }))
      .sort((a, b) => b.addressCount - a.addressCount);

    return NextResponse.json({
      apartments: apartments.map((a) => ({ ...a, addressCount: countMap.get(a.id) ?? 0 })),
      unregistered,
    });
  } catch (err) {
    console.error("GET /api/admin/apartments error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

type Row = { name?: string; address?: string; households?: number | string | null; dongCount?: number | string | null; aliases?: string | string[]; memo?: string };

async function buildData(row: Row, center: { lat: number | null; lng: number | null }) {
  const name = String(row.name ?? "").trim();
  if (!name) return null;
  const address = row.address ? String(row.address).trim() : null;
  const aliases = Array.isArray(row.aliases)
    ? row.aliases.map((s) => String(s).trim()).filter(Boolean)
    : String(row.aliases ?? "").split(/[|,]/).map((s) => s.trim()).filter(Boolean);
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : null; };

  let geo = null;
  if (address) geo = await geocodeAddress(address);
  else geo = await geocodeAddress(name); // 주소가 없으면 단지명 키워드 검색

  let distanceKm: number | null = null;
  if (geo && center.lat !== null && center.lng !== null) {
    distanceKm = Math.round(haversineKm(geo, { lat: center.lat, lng: center.lng }) * 10) / 10;
  }
  return {
    name,
    aliases,
    address: address ?? geo?.roadAddress ?? null,
    sigungu: geo?.sigungu ?? null,
    bname: geo?.bname ?? null,
    households: num(row.households),
    dongCount: num(row.dongCount),
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    distanceKm,
    memo: row.memo ? String(row.memo).trim() : null,
  };
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;

  try {
    const body = (await request.json()) as Row & { rows?: Row[] };
    const all = Array.isArray(body.rows) ? body.rows : [body];
    // 행마다 외부 지오코딩을 부르므로 한 요청에서 다 돌리면 서버리스 타임아웃이 난다.
    // 화면이 25행씩 잘라 보내고, 서버도 상한을 둔다.
    const MAX_PER_REQUEST = 25;
    const rows = all.slice(0, MAX_PER_REQUEST);
    const center = await getDeliveryCenter(); // 행마다 다시 읽지 않는다
    let created = 0, updated = 0, skipped = 0;
    for (const row of rows) {
      const data = await buildData(row, center);
      if (!data) { skipped++; continue; }
      const existing = await prisma.apartment.findFirst({ where: { name: data.name, ...(data.bname ? { bname: data.bname } : {}) } });
      if (existing) {
        await prisma.apartment.update({ where: { id: existing.id }, data: { ...data, aliases: [...new Set([...existing.aliases, ...data.aliases])] } });
        updated++;
      } else {
        await prisma.apartment.create({ data });
        created++;
      }
    }
    return NextResponse.json({ created, updated, skipped, processed: rows.length, ignored: all.length - rows.length });
  } catch (err) {
    console.error("POST /api/admin/apartments error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// PATCH: { id, isServiced?, memo?, aliases?, name? }  /  DELETE: { id }
export async function PATCH(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;
  try {
    const { id, ...rest } = (await request.json()) as { id: string; isServiced?: boolean; memo?: string | null; aliases?: string[] | string; name?: string; households?: number | null };
    if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
    const data: Record<string, unknown> = {};
    if (rest.isServiced !== undefined) data.isServiced = !!rest.isServiced;
    if (rest.memo !== undefined) data.memo = rest.memo ? String(rest.memo).trim() : null;
    if (rest.name !== undefined && String(rest.name).trim()) data.name = String(rest.name).trim();
    if (rest.households !== undefined) data.households = rest.households === null ? null : Number(rest.households) || null;
    if (rest.aliases !== undefined) {
      data.aliases = Array.isArray(rest.aliases)
        ? rest.aliases.map((s) => String(s).trim()).filter(Boolean)
        : String(rest.aliases).split(/[|,]/).map((s) => s.trim()).filter(Boolean);
    }
    const apt = await prisma.apartment.update({ where: { id }, data });
    return NextResponse.json(apt);
  } catch (err) {
    console.error("PATCH /api/admin/apartments error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;
  try {
    const { id } = (await request.json()) as { id: string };
    if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
    await prisma.address.updateMany({ where: { apartmentId: id }, data: { apartmentId: null } });
    await prisma.apartment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/admin/apartments error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
