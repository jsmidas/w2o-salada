import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../lib/auth-guard";

/**
 * 배송 코스 마스터 — 코스 = 차량 1대의 하루. 기사 계정(DRIVER)과 연결한다.
 * GET  { routes, drivers }   POST 생성   PATCH { id, ...변경 }   DELETE { id } (배송 이력 있으면 비활성화만)
 */
export async function GET() {
  const { error } = await requireAdmin("orders");
  if (error) return error;
  try {
    const [routes, drivers] = await Promise.all([
      prisma.deliveryRoute.findMany({
        orderBy: [{ isActive: "desc" }, { departOrder: "asc" }, { name: "asc" }],
        include: { driver: { select: { id: true, name: true, username: true, phone: true } }, _count: { select: { deliveries: true, lastAddresses: true } } },
      }),
      prisma.user.findMany({ where: { role: "DRIVER" }, select: { id: true, name: true, username: true, phone: true }, orderBy: { name: "asc" } }),
    ]);
    return NextResponse.json({ routes, drivers });
  } catch (err) {
    console.error("GET /api/admin/routes error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

type Body = {
  id?: string; name?: string; driverUserId?: string | null; vehicleNo?: string | null;
  ownership?: "OWN" | "OUTSOURCED"; maxStops?: number; departOrder?: number; isActive?: boolean; color?: string | null; memo?: string | null;
};

function pick(b: Body) {
  const data: Record<string, unknown> = {};
  if (b.name !== undefined) { const n = String(b.name).trim(); if (!n) throw new Error("코스 이름을 입력하세요."); data.name = n; }
  if (b.driverUserId !== undefined) data.driverUserId = b.driverUserId || null;
  if (b.vehicleNo !== undefined) data.vehicleNo = b.vehicleNo ? String(b.vehicleNo).trim() : null;
  if (b.ownership !== undefined) data.ownership = b.ownership === "OUTSOURCED" ? "OUTSOURCED" : "OWN";
  if (b.maxStops !== undefined) data.maxStops = Math.max(1, Number(b.maxStops) || 100);
  if (b.departOrder !== undefined) data.departOrder = Number(b.departOrder) || 0;
  if (b.isActive !== undefined) data.isActive = !!b.isActive;
  if (b.color !== undefined) data.color = b.color || null;
  if (b.memo !== undefined) data.memo = b.memo ? String(b.memo).trim() : null;
  return data;
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;
  try {
    const body = (await request.json()) as Body;
    const data = pick(body);
    if (!data.name) return NextResponse.json({ error: "코스 이름을 입력하세요." }, { status: 400 });
    if (data.driverUserId) {
      const d = await prisma.user.findUnique({ where: { id: String(data.driverUserId) }, select: { role: true } });
      if (!d || d.role !== "DRIVER") return NextResponse.json({ error: "기사 계정(DRIVER)만 연결할 수 있습니다." }, { status: 400 });
    }
    const dup = await prisma.deliveryRoute.findUnique({ where: { name: String(data.name) } });
    if (dup) return NextResponse.json({ error: "같은 이름의 코스가 있습니다." }, { status: 409 });
    const route = await prisma.deliveryRoute.create({ data: data as never });
    return NextResponse.json(route, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "서버 오류";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;
  try {
    const body = (await request.json()) as Body;
    if (!body.id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
    const data = pick(body);
    if (data.driverUserId) {
      const d = await prisma.user.findUnique({ where: { id: String(data.driverUserId) }, select: { role: true } });
      if (!d || d.role !== "DRIVER") return NextResponse.json({ error: "기사 계정(DRIVER)만 연결할 수 있습니다." }, { status: 400 });
    }
    const route = await prisma.deliveryRoute.update({ where: { id: body.id }, data });
    // 코스명이 바뀌면 배정된 배송 건의 표시용 라벨(driverId)도 따라간다
    if (data.name) await prisma.delivery.updateMany({ where: { routeId: route.id }, data: { driverId: route.name } });
    return NextResponse.json(route);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "서버 오류";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;
  try {
    const { id } = (await request.json()) as { id: string };
    if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
    const used = await prisma.delivery.count({ where: { routeId: id } });
    if (used > 0) {
      const r = await prisma.deliveryRoute.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({ ...r, deactivated: true, message: `배송 이력 ${used}건이 있어 삭제 대신 비활성화했습니다.` });
    }
    await prisma.address.updateMany({ where: { lastRouteId: id }, data: { lastRouteId: null } });
    await prisma.deliveryRoute.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/admin/routes error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
