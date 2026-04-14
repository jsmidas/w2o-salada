import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../../lib/auth-guard";

// 코스 배정 일괄 저장
// body: { assignments: [{ deliveryId, routeLabel, sortOrder }] }
// routeLabel 은 Delivery.driverId 필드에 저장 (Phase 4까지 재사용)
// routeLabel === null 또는 "" 이면 미배정 상태로 되돌림
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;

  try {
    const body = await request.json();
    const assignments: Array<{
      deliveryId: string;
      routeLabel: string | null;
      sortOrder: number;
    }> = body.assignments ?? [];

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return NextResponse.json({ error: "assignments 배열이 필요합니다." }, { status: 400 });
    }

    await prisma.$transaction(
      assignments.map((a) =>
        prisma.delivery.update({
          where: { id: a.deliveryId },
          data: {
            driverId: a.routeLabel && a.routeLabel.trim() !== "" ? a.routeLabel.trim() : null,
            sortOrder: Number.isFinite(a.sortOrder) ? a.sortOrder : 0,
          },
        })
      )
    );

    return NextResponse.json({ success: true, updated: assignments.length });
  } catch (err) {
    console.error("POST /api/admin/delivery/assign error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
