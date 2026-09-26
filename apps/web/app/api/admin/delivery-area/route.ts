import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../lib/auth-guard";
import { enrichLocation, geocodeAddress, getDeliveryCenter, judgeArea, locationToAddressData } from "../../../lib/geo";

/**
 * POST /api/admin/delivery-area
 *   { action: "geocodeCenter", address }  → 센터 주소의 좌표
 *   { action: "backfill" }                → 저장된 배송지 전부 좌표 보정 + 현재 반경으로 재판정
 *   { action: "rejudge" }                 → 좌표는 그대로 두고 반경·허용 동만 다시 적용 (지오코딩 없음)
 */
export async function POST(request: Request) {
  const { error } = await requireAdmin("system");
  if (error) return error;

  try {
    const body = (await request.json()) as { action?: string; address?: string };

    if (body.action === "geocodeCenter") {
      const address = String(body.address ?? "").trim();
      if (!address) return NextResponse.json({ error: "주소를 입력하세요." }, { status: 400 });
      const geo = await geocodeAddress(address);
      if (!geo) {
        return NextResponse.json(
          { error: "좌표를 찾지 못했습니다. 주소를 확인하거나 카카오 개발자 콘솔에서 '카카오맵' 서비스가 켜져 있는지 확인하세요." },
          { status: 404 },
        );
      }
      return NextResponse.json({ lat: geo.lat, lng: geo.lng, roadAddress: geo.roadAddress });
    }

    if (body.action === "backfill" || body.action === "rejudge") {
      const center = await getDeliveryCenter();
      const addresses = await prisma.address.findMany({ orderBy: { createdAt: "asc" } });
      let inRange = 0, outOfRange = 0, unknown = 0, geocodeFailed = 0;

      for (const a of addresses) {
        let data: Record<string, unknown>;
        if (body.action === "backfill" && (a.lat === null || a.lng === null)) {
          const loc = await enrichLocation(a.address1, {
            sido: a.sido, sigungu: a.sigungu, bname: a.bname, buildingName: a.buildingName,
            isApartment: a.isApartment, roadAddress: a.roadAddress, jibunAddress: a.jibunAddress,
          });
          if (!loc.geocodedAt) geocodeFailed++;
          data = locationToAddressData(loc);
        } else {
          const j = judgeArea(a.lat !== null && a.lng !== null ? { lat: a.lat, lng: a.lng } : null, a.bname, center);
          data = { areaStatus: j.status, distanceKm: j.distanceKm };
        }
        const status = data.areaStatus as string;
        if (status === "IN_RANGE") inRange++; else if (status === "OUT_OF_RANGE") outOfRange++; else unknown++;
        await prisma.address.update({ where: { id: a.id }, data });
      }

      // 아직 처리 안 된 보류 주문은 주소 재판정 결과를 따라간다 (권역 내가 되면 큐에서 자동 제외)
      const holds = await prisma.order.findMany({
        where: { deliveryHold: true, deliveryHoldResolvedAt: null, addressId: { not: null } },
        select: { id: true, address: { select: { areaStatus: true } } },
      });
      let released = 0;
      for (const o of holds) {
        if (o.address?.areaStatus === "IN_RANGE") {
          await prisma.order.update({ where: { id: o.id }, data: { deliveryHold: false, deliveryHoldReason: null } });
          released++;
        }
      }

      return NextResponse.json({ total: addresses.length, inRange, outOfRange, unknown, geocodeFailed, released, center });
    }

    return NextResponse.json({ error: "알 수 없는 action" }, { status: 400 });
  } catch (err) {
    console.error("POST /api/admin/delivery-area error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
