import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../../lib/auth-guard";
import { pickAndJudgeAddress } from "../../../../lib/address-resolve";
import { checkOrderable, clearSubscriptionZoneBlock, markSubscriptionZoneBlocked } from "../../../../lib/delivery-zone";
import { formatPhone } from "../../../../lib/phone-format";

/**
 * 권역 때문에 자동결제를 건너뛴 구독 (관리자 목록)
 *   GET                      zoneBlockedAt 이 있는 구독 + 현재 판정
 *   POST { action: "recheck" }  전부 다시 판정 — 권역이 다시 열린 구독은 표시를 지운다 (다음 크론에서 청구된다)
 *   POST { action: "scan" }     활성 구독 전체를 지금 규칙으로 훑어 권역 밖인 것을 표시한다 (권역을 끈 직후 확인용)
 */
export async function GET() {
  const { error } = await requireAdmin("orders");
  if (error) return error;
  try {
    const subs = await prisma.subscription.findMany({
      where: { zoneBlockedAt: { not: null } },
      orderBy: { zoneBlockedAt: "desc" },
      select: {
        id: true, status: true, zoneBlockedAt: true, zoneBlockedReason: true, nextBillingDate: true, nextDeliveryDate: true, cycleWeeks: true, price: true,
        user: { select: { id: true, name: true, phone: true, email: true } },
        address: { select: { id: true, address1: true, buildingName: true, zipCode: true, bcode: true, areaStatus: true, areaReason: true, zone: { select: { name: true, isActive: true } } } },
      },
    });
    return NextResponse.json({
      subscriptions: subs.map((s) => ({
        ...s,
        user: { ...s.user, phone: s.user.phone ? formatPhone(s.user.phone) : null },
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/delivery-zones/blocked-subscriptions error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;
  try {
    const { action } = (await request.json()) as { action?: string };
    if (action !== "recheck" && action !== "scan") return NextResponse.json({ error: "action 은 recheck 또는 scan" }, { status: 400 });

    const subs = await prisma.subscription.findMany({
      where: action === "recheck" ? { zoneBlockedAt: { not: null } } : { status: "ACTIVE", autoRenew: true, billingKey: { not: null } },
      select: { id: true, userId: true, addressId: true, zoneBlockedAt: true, user: { select: { name: true } } },
      take: 500,
    });
    let cleared = 0, stillBlocked = 0, newlyBlocked = 0;
    for (const s of subs) {
      const judged = await pickAndJudgeAddress(s.userId, s.addressId);
      const zc = await checkOrderable(
        { areaStatus: judged?.address.areaStatus ?? "UNKNOWN", zoneId: judged?.address.zoneId ?? null, canOrder: judged?.zone.canOrder, areaReason: judged?.zone.reason, mode: judged?.zone.mode },
        [],
      );
      const blocked = zc.blocked?.code === "OUT_OF_AREA";
      if (blocked && !s.zoneBlockedAt) {
        await markSubscriptionZoneBlocked(s, judged?.zone.reason ?? "배송지 없음", { userName: s.user.name, phase: "admin-scan" });
        newlyBlocked++;
      } else if (blocked) {
        stillBlocked++;
      } else if (s.zoneBlockedAt) {
        await clearSubscriptionZoneBlock(s.id);
        cleared++;
      }
    }
    return NextResponse.json({ ok: true, checked: subs.length, cleared, stillBlocked, newlyBlocked });
  } catch (err) {
    console.error("POST /api/admin/delivery-zones/blocked-subscriptions error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
