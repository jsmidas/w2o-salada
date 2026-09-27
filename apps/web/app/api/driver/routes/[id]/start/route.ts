import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireDriver } from "../../../../../lib/auth-guard";
import { dayRange, todayKst, transitionDelivery } from "../../../../../lib/delivery-status";

/**
 * 코스 배송 출발 — 그날 코스의 대기(PENDING) 건을 모두 IN_TRANSIT 으로.
 * 주문은 SHIPPING 이 되고 고객에게 '배송 출발' 알림톡이 나간다.
 * POST /api/driver/routes/:id/start  body { date?: "YYYY-MM-DD" }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session, isAdmin } = await requireDriver();
  if (error) return error;
  const me = session!.user as { id: string };

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const date = typeof body.date === "string" ? body.date : todayKst();
    const range = dayRange(date);
    if (!range) return NextResponse.json({ error: "유효하지 않은 날짜입니다." }, { status: 400 });

    const route = await prisma.deliveryRoute.findUnique({ where: { id }, select: { id: true, driverUserId: true, isActive: true } });
    if (!route || !route.isActive) return NextResponse.json({ error: "코스를 찾을 수 없습니다." }, { status: 404 });
    if (!isAdmin && route.driverUserId !== me.id) return NextResponse.json({ error: "내 코스가 아닙니다." }, { status: 403 });

    const targets = await prisma.delivery.findMany({
      where: { routeId: id, status: "PENDING", scheduledDate: { gte: range.start, lt: range.end } },
      select: { id: true },
    });

    let started = 0;
    for (const t of targets) {
      const r = await transitionDelivery(t.id, "IN_TRANSIT");
      if (r) started += 1;
    }

    return NextResponse.json({ success: true, started });
  } catch (err) {
    console.error("POST /api/driver/routes/[id]/start error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
