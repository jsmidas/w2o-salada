import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAuth } from "../../lib/auth-guard";
import { syncNextDeliveryDate } from "../../lib/subscription-cycle";

// GET: 내 구독 목록
export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const userId = (session!.user as { id: string }).id;
    // 지난 배송일에 머문 구독은 다음 활성 배송일로 전진시켜 두고 조회
    const stale = await prisma.subscription.findMany({
      where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
      select: { id: true, nextDeliveryDate: true },
    });
    await Promise.all(stale.map((s) => syncNextDeliveryDate(s)));

    const subscriptions = await prisma.subscription.findMany({
      where: { userId },
      include: {
        items: { include: { product: true } },
        address: { select: { id: true, label: true, name: true, phone: true, address1: true, address2: true, buildingName: true, areaStatus: true } },
        periods: {
          orderBy: { year: "desc" },
          take: 5,
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(subscriptions);
  } catch (err) {
    console.error("GET /api/subscriptions error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
