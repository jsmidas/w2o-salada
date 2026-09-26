import { NextResponse } from "next/server";
import { areaMessage, enrichLocation, type DaumFields } from "../../../lib/geo";

/**
 * POST /api/delivery/check — 주소를 고른 직후 배송 가능 여부를 미리 보여준다 (저장하지 않음)
 * body: { address1, roadAddress?, jibunAddress?, sido?, sigungu?, bname?, buildingName?, isApartment? }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DaumFields & { address1?: string };
    const address1 = String(body.address1 ?? body.roadAddress ?? "").trim();
    if (!address1) {
      return NextResponse.json({ error: "address1 필요" }, { status: 400 });
    }
    const loc = await enrichLocation(address1, body);
    return NextResponse.json({
      status: loc.areaStatus,
      distanceKm: loc.distanceKm,
      radiusKm: loc.judgement.radiusKm,
      reason: loc.judgement.reason,
      message: areaMessage(loc.judgement),
      sigungu: loc.sigungu,
      bname: loc.bname,
      buildingName: loc.buildingName,
      apartmentMatched: !!loc.apartmentId,
    });
  } catch (err) {
    console.error("POST /api/delivery/check error:", err);
    return NextResponse.json({ status: "UNKNOWN", message: "확인에 실패했습니다. 주문은 정상 접수됩니다." });
  }
}
