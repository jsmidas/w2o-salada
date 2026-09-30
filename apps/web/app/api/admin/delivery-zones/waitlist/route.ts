import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "../../../../lib/auth-guard";
import { formatPhone } from "../../../../lib/phone-format";

/**
 * 오픈 알림 대기 신청 — 다음 확장 지역 판단용
 *   GET  ?sigungu=&bname=&q=            지역별 집계 + 상세 목록 (최근 500건)
 *   GET  ?format=csv (+같은 필터)        CSV 다운로드
 *   PATCH { ids: string[], notified: true }  오픈 안내 발송 표시
 *   DELETE { id } | { olderThanDays }   삭제 (개인정보 보관 기간 정리)
 */
function buildWhere(p: URLSearchParams): Prisma.DeliveryWaitlistWhereInput {
  const where: Prisma.DeliveryWaitlistWhereInput = {};
  const sigungu = p.get("sigungu")?.trim();
  const bname = p.get("bname")?.trim();
  const q = p.get("q")?.trim();
  if (sigungu) where.sigungu = sigungu;
  if (bname) where.bname = bname;
  if (q) where.OR = [{ name: { contains: q } }, { phone: { contains: q.replace(/\D/g, "") || q } }, { zipCode: { startsWith: q } }, { address1: { contains: q } }, { buildingName: { contains: q } }];
  return where;
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;
  try {
    const p = request.nextUrl.searchParams;
    const where = buildWhere(p);

    if (p.get("format") === "csv") {
      const rows = await prisma.deliveryWaitlist.findMany({ where, orderBy: [{ sigungu: "asc" }, { bname: "asc" }, { createdAt: "desc" }], take: 5000 });
      const header = ["신청일", "이름", "연락처", "우편번호", "시도", "시군구", "법정동", "법정동코드", "도로명주소", "건물명", "마케팅동의", "경로", "안내발송일"];
      const lines = rows.map((r) => [
        r.createdAt.toISOString().slice(0, 10), r.name, formatPhone(r.phone), r.zipCode, r.sido, r.sigungu, r.bname, r.bcode, r.address1, r.buildingName,
        r.marketingConsent ? "Y" : "N", r.source, r.notifiedAt ? r.notifiedAt.toISOString().slice(0, 10) : "",
      ].map(csvCell).join(","));
      const csv = "﻿" + [header.join(","), ...lines].join("\r\n"); // BOM — 엑셀에서 한글이 깨지지 않게
      const fname = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
      return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${fname}"` } });
    }

    const [groups, rows, total] = await Promise.all([
      prisma.deliveryWaitlist.groupBy({
        by: ["sido", "sigungu", "bname"],
        where,
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      prisma.deliveryWaitlist.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 }),
      prisma.deliveryWaitlist.count({ where }),
    ]);
    // 마케팅 동의 수는 groupBy 로 한 번에 못 세니 목록에서 집계 (500건 상한 안에서는 정확, 그 밖은 근사)
    const consentByKey = new Map<string, number>();
    for (const r of rows) if (r.marketingConsent) { const k = `${r.sido}|${r.sigungu}|${r.bname}`; consentByKey.set(k, (consentByKey.get(k) ?? 0) + 1); }
    const byArea = groups
      .map((g) => ({ sido: g.sido, sigungu: g.sigungu, bname: g.bname, count: g._count._all, consent: consentByKey.get(`${g.sido}|${g.sigungu}|${g.bname}`) ?? 0, lastAt: g._max.createdAt }))
      .sort((a, b) => b.count - a.count);
    return NextResponse.json({
      total,
      byArea,
      rows: rows.map((r) => ({ ...r, phone: formatPhone(r.phone) })),
    });
  } catch (err) {
    console.error("GET /api/admin/delivery-zones/waitlist error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;
  try {
    const { ids, notified } = (await request.json()) as { ids: string[]; notified?: boolean };
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: "ids 필요" }, { status: 400 });
    const r = await prisma.deliveryWaitlist.updateMany({ where: { id: { in: ids.slice(0, 1000) } }, data: { notifiedAt: notified === false ? null : new Date() } });
    return NextResponse.json({ updated: r.count });
  } catch (err) {
    console.error("PATCH /api/admin/delivery-zones/waitlist error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;
  try {
    const body = (await request.json()) as { id?: string; olderThanDays?: number };
    if (body.id) {
      await prisma.deliveryWaitlist.delete({ where: { id: String(body.id) } });
      return NextResponse.json({ deleted: 1 });
    }
    const days = Number(body.olderThanDays);
    if (!Number.isFinite(days) || days < 30) return NextResponse.json({ error: "olderThanDays 는 30 이상" }, { status: 400 });
    const r = await prisma.deliveryWaitlist.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - days * 86400000) } } });
    return NextResponse.json({ deleted: r.count });
  } catch (err) {
    console.error("DELETE /api/admin/delivery-zones/waitlist error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
