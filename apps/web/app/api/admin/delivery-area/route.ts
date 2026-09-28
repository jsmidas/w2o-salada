import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../lib/auth-guard";
import { enrichLocation, geocodeAddress, geocoderStatus, getDeliveryCenter, judgeArea, locationToAddressData } from "../../../lib/geo";

/**
 * POST /api/admin/delivery-area
 *   { action: "geocodeCenter", address }  → 센터 주소의 좌표
 *   { action: "backfill" }                → 저장된 배송지 전부 좌표 보정 + 현재 반경으로 재판정
 *   { action: "rejudge" }                 → 좌표는 그대로 두고 전역 시/도·허용 동·반경만 다시 적용 (지오코딩 없음)
 */
export async function POST(request: Request) {
  const { error } = await requireAdmin("system");
  if (error) return error;

  try {
    const body = (await request.json()) as {
      action?: string;
      address?: string;
      cursor?: string | null; // backfill/rejudge 이어서 처리할 위치
      limit?: number; // 한 번에 처리할 주소 수 (기본 25)
    };

    if (body.action === "geocodeCenter") {
      const address = String(body.address ?? "").trim();
      if (!address) return NextResponse.json({ error: "주소를 입력하세요." }, { status: 400 });
      const geo = await geocodeAddress(address);
      if (!geo) {
        const st = geocoderStatus();
        const hint = !st.kakao && !st.vworld
          ? "지오코딩 키가 없거나 카카오맵 서비스가 꺼져 있습니다. Vercel 환경변수에 VWORLD_API_KEY(무료)를 넣거나 카카오 비즈월렛에 결제수단을 등록하세요."
          : "주소를 확인하세요 (도로명 주소 권장).";
        return NextResponse.json({ error: `좌표를 찾지 못했습니다. ${hint}` }, { status: 404 });
      }
      return NextResponse.json({ lat: geo.lat, lng: geo.lng, roadAddress: geo.roadAddress, geocoder: geocoderStatus() });
    }

    if (body.action === "backfill" || body.action === "rejudge") {
      // 주소가 쌓이면 한 번에 다 돌릴 수 없다 (건마다 외부 지오코딩 호출 → 서버리스 타임아웃).
      // 커서로 잘라서 돌려주고, 화면이 nextCursor 가 없어질 때까지 반복 호출한다.
      const center = await getDeliveryCenter();
      const limit = Math.min(Math.max(Number(body.limit) || 25, 1), 100);
      const cursorId = typeof body.cursor === "string" && body.cursor ? body.cursor : null;

      const page = await prisma.address.findMany({
        orderBy: { id: "asc" }, // 커서 페이징은 고유 키로 정렬해야 건너뛰거나 겹치지 않는다
        take: limit + 1, // 하나 더 읽어 다음 배치가 있는지 본다
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      });
      const hasMore = page.length > limit;
      const addresses = hasMore ? page.slice(0, limit) : page;
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
          const j = judgeArea(a.lat !== null && a.lng !== null ? { lat: a.lat, lng: a.lng } : null, a.bname, center, a.sido);
          data = { areaStatus: j.status, distanceKm: j.distanceKm };
        }
        const status = data.areaStatus as string;
        if (status === "IN_RANGE") inRange++; else if (status === "OUT_OF_RANGE") outOfRange++; else unknown++;
        await prisma.address.update({ where: { id: a.id }, data });
      }

      // 보류 주문 해제는 모든 주소를 다시 판정한 뒤라야 의미가 있으므로 마지막 배치에서만 한다
      let released = 0;
      if (!hasMore) {
        const holds = await prisma.order.findMany({
          where: { deliveryHold: true, deliveryHoldResolvedAt: null, addressId: { not: null } },
          select: { id: true, address: { select: { areaStatus: true } } },
        });
        for (const o of holds) {
          if (o.address?.areaStatus === "IN_RANGE") {
            await prisma.order.update({ where: { id: o.id }, data: { deliveryHold: false, deliveryHoldReason: null } });
            released++;
          }
        }
      }

      return NextResponse.json({
        processed: addresses.length,
        inRange, outOfRange, unknown, geocodeFailed, released,
        nextCursor: hasMore ? addresses[addresses.length - 1]!.id : null,
        done: !hasMore,
        center,
      });
    }

    return NextResponse.json({ error: "알 수 없는 action" }, { status: 400 });
  } catch (err) {
    console.error("POST /api/admin/delivery-area error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
