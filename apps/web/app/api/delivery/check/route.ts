import { NextResponse } from "next/server";
import { enrichLocation, type DaumFields } from "../../../lib/geo";
import { zoneMessage } from "../../../lib/delivery-zone";
import { clientIp, hitRateLimit } from "../../../lib/rate-limit";

/**
 * POST /api/delivery/check — 주소를 고른 직후 배송 가능 여부를 미리 보여준다 (저장하지 않음)
 * body: { address1, zipCode?, bcode?, roadAddress?, jibunAddress?, sido?, sigungu?, bname?, buildingName?, isApartment?, dates?: string[] }
 *
 * 공개 API 라 IP 당 분당 20회로 제한한다 (호출마다 외부 지오코더를 부를 수 있다).
 * 응답의 canOrder 가 false 면 화면은 결제 대신 "우리 동네 오픈 알림 신청" 폼을 보여준다.
 */
export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const rl = await hitRateLimit(`areacheck:ip:${ip}`, 20, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "잠시 후 다시 시도해주세요.", retryAfterSec: rl.retryAfterSec }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });
    }

    const body = (await request.json()) as DaumFields & { address1?: string; dates?: string[] };
    const address1 = String(body.address1 ?? body.roadAddress ?? "").trim();
    if (!address1) {
      return NextResponse.json({ error: "address1 필요" }, { status: 400 });
    }
    const loc = await enrichLocation(address1, body);

    // 날짜별 중지 — 화면이 배송일을 알고 있으면(장바구니·구독 신청) 함께 알려준다
    let suspendedDates: { date: string; reason: string }[] = [];
    if (Array.isArray(body.dates) && body.dates.length > 0) {
      const { suspendedDates: query } = await import("../../../lib/delivery-zone");
      const m = await query(loc.zoneId, body.dates.map(String).slice(0, 40));
      suspendedDates = [...m.entries()].map(([date, s]) => ({ date, reason: s.reason })).sort((a, b) => a.date.localeCompare(b.date));
    }

    return NextResponse.json({
      status: loc.areaStatus,
      canOrder: loc.canOrder,
      mode: loc.zone.mode,
      zoneName: loc.zone.zoneName,
      matchedBy: loc.zone.matchedBy,
      distanceKm: loc.distanceKm,
      radiusKm: loc.judgement.radiusKm,
      reason: loc.areaReason,
      message: zoneMessage(loc.zone),
      suspendedDates,
      sigungu: loc.sigungu,
      bname: loc.bname,
      buildingName: loc.buildingName,
      apartmentMatched: !!loc.apartmentId,
      // 오픈 알림 신청 폼 채우기용
      waitlistPrefill: {
        zipCode: loc.zipCode ?? null,
        bcode: loc.bcode ?? null,
        sido: loc.sido ?? null,
        sigungu: loc.sigungu ?? null,
        bname: loc.bname ?? null,
        address1,
        buildingName: loc.buildingName ?? null,
      },
    });
  } catch (err) {
    console.error("POST /api/delivery/check error:", err);
    return NextResponse.json({ status: "UNKNOWN", canOrder: true, message: "확인에 실패했습니다. 주문은 정상 접수됩니다.", suspendedDates: [] });
  }
}
