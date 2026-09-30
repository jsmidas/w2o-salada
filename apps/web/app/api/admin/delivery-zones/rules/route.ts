import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "../../../../lib/auth-guard";
import { cleanText } from "../../../../lib/validate";
import { normZip } from "../../../../lib/delivery-zone";

/**
 * 예외 규칙 — 권역보다 우선. 우편번호 / 단지명 / 사전 등록 단지 중 하나로 매칭.
 *   GET            목록
 *   POST   { action: "ALLOW"|"BLOCK", zipCode? | buildingName? | apartmentId?, sigungu?, reason? }
 *   PATCH  { id, isActive?, reason? }
 *   DELETE { id }
 */
export async function GET() {
  const { error } = await requireAdmin("orders");
  if (error) return error;
  try {
    const rules = await prisma.deliveryZoneRule.findMany({
      orderBy: [{ isActive: "desc" }, { action: "asc" }, { createdAt: "desc" }],
      include: { apartment: { select: { id: true, name: true, sigungu: true, bname: true } } },
    });
    return NextResponse.json({ rules });
  } catch (err) {
    console.error("GET /api/admin/delivery-zones/rules error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;
  try {
    const body = (await request.json()) as { action?: string; zipCode?: string; buildingName?: string; apartmentId?: string; sigungu?: string; reason?: string };
    const action = body.action === "ALLOW" || body.action === "BLOCK" ? body.action : null;
    if (!action) return NextResponse.json({ error: "action 은 ALLOW 또는 BLOCK" }, { status: 400 });
    const zipCode = body.zipCode ? normZip(body.zipCode) : null;
    if (body.zipCode && !zipCode) return NextResponse.json({ error: "우편번호는 숫자 5자리" }, { status: 400 });
    const buildingName = cleanText(body.buildingName, 100);
    const apartmentId = cleanText(body.apartmentId, 40);
    if (!zipCode && !buildingName && !apartmentId) return NextResponse.json({ error: "우편번호, 단지명, 사전 등록 단지 중 하나는 필요합니다." }, { status: 400 });
    if (apartmentId) {
      const apt = await prisma.apartment.findUnique({ where: { id: apartmentId }, select: { id: true } });
      if (!apt) return NextResponse.json({ error: "사전 등록 단지를 찾을 수 없습니다." }, { status: 400 });
    }
    const data: Prisma.DeliveryZoneRuleCreateInput = {
      action,
      zipCode,
      buildingName,
      sigungu: cleanText(body.sigungu, 40),
      reason: cleanText(body.reason, 200),
      ...(apartmentId ? { apartment: { connect: { id: apartmentId } } } : {}),
    };
    const rule = await prisma.deliveryZoneRule.create({ data });
    return NextResponse.json({ rule }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/delivery-zones/rules error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;
  try {
    const { id, isActive, reason } = (await request.json()) as { id: string; isActive?: boolean; reason?: string | null };
    if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
    const data: Prisma.DeliveryZoneRuleUpdateInput = {};
    if (isActive !== undefined) data.isActive = !!isActive;
    if (reason !== undefined) data.reason = cleanText(reason, 200);
    const rule = await prisma.deliveryZoneRule.update({ where: { id }, data });
    return NextResponse.json({ rule });
  } catch (err) {
    console.error("PATCH /api/admin/delivery-zones/rules error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;
  try {
    const { id } = (await request.json()) as { id: string };
    if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
    await prisma.deliveryZoneRule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/delivery-zones/rules error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
