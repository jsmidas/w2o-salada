/**
 * 배송 권역 판정 — 물류센터 반경 기준 (배송 코스 1단계)
 *
 * - 좌표: 카카오 로컬 API (주소 검색 → 실패 시 키워드 검색). 키는 KAKAO_REST_API_KEY,
 *   없으면 카카오 로그인용 KAKAO_CLIENT_ID(같은 REST API 키)를 쓴다.
 *   ※ Kakao Developers 앱에서 "카카오맵" 서비스가 켜져 있어야 한다.
 * - 센터·반경·허용 동은 Setting 에 두어 관리자가 조정한다.
 * - 좌표를 못 얻으면 UNKNOWN 으로 두고 사람이 확인한다 (주문은 막지 않는다).
 */
import { prisma } from "@repo/db";

export type LatLng = { lat: number; lng: number };
export type AreaStatus = "UNKNOWN" | "IN_RANGE" | "OUT_OF_RANGE";

export type GeocodeResult = LatLng & {
  roadAddress: string | null;
  jibunAddress: string | null;
  sido: string | null;
  sigungu: string | null;
  bname: string | null;
  buildingName: string | null;
};

export type DeliveryCenter = {
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  allowedDongs: string[]; // 반경 밖이라도 열어둔 법정동 (보조 화이트리스트)
};

export const CENTER_SETTING_KEYS = [
  "deliveryCenterName",
  "deliveryCenterAddress",
  "deliveryCenterLat",
  "deliveryCenterLng",
  "deliveryRadiusKm",
  "deliveryAllowedDongs",
] as const;

/** 기본 배송 반경 — 현장 판단 "10km 안이면 어디든" (2026-09-27). Setting deliveryRadiusKm 로 조정 */
export const DEFAULT_RADIUS_KM = 10;

const DEFAULT_CENTER: DeliveryCenter = {
  name: "1센터 (성서)",
  address: "대구 달서구 성서공단로 332-10",
  lat: null,
  lng: null,
  radiusKm: DEFAULT_RADIUS_KM,
  allowedDongs: [],
};

/** 두 좌표 사이 거리 (km, 구면 거리) */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function kakaoKey(): string | null {
  return process.env.KAKAO_REST_API_KEY || process.env.KAKAO_CLIENT_ID || null;
}

function vworldKey(): string | null {
  return process.env.VWORLD_API_KEY || null;
}

// 같은 주소를 반복 조회하지 않도록 프로세스 내 캐시 (서버리스라 수명은 짧지만 체크아웃 중 재조회를 막는다)
const geocodeCache = new Map<string, GeocodeResult | null>();

// 카카오가 "서비스 비활성"으로 거부하면 이 프로세스에서는 다시 두드리지 않는다 (비즈월렛 미등록 등)
let kakaoDisabledUntil = 0;

type KakaoAddressDoc = {
  address_name: string;
  x: string;
  y: string;
  road_address?: { address_name: string; region_1depth_name: string; region_2depth_name: string; region_3depth_name: string; building_name: string } | null;
  address?: { address_name: string; region_1depth_name: string; region_2depth_name: string; region_3depth_name: string } | null;
};

function finite(r: GeocodeResult | null): GeocodeResult | null {
  return r && Number.isFinite(r.lat) && Number.isFinite(r.lng) ? r : null;
}

/** 제공자 1: 카카오 로컬 API (주소 검색 → 키워드 검색). 앱에 "카카오맵" 서비스가 켜져 있어야 한다 */
async function kakaoGeocode(q: string, signal: AbortSignal): Promise<GeocodeResult | null> {
  const key = kakaoKey();
  if (!key || Date.now() < kakaoDisabledUntil) return null;
  const headers = { Authorization: `KakaoAK ${key}` };

  let res = await fetch(
    `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(q)}&size=1`,
    { headers, signal, cache: "no-store" },
  );
  let json = (await res.json().catch(() => ({}))) as { documents?: KakaoAddressDoc[]; message?: string; errorType?: string };
  if (!res.ok) {
    console.warn("[geo] 카카오 주소 검색 실패:", res.status, json.message);
    if (json.errorType === "NotAuthorizedError") kakaoDisabledUntil = Date.now() + 10 * 60 * 1000;
    return null;
  }
  let doc = json.documents?.[0];

  // 주소 검색이 비면 키워드 검색으로 한 번 더 (단지명이 섞인 문자열 대비)
  if (!doc) {
    res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}&size=1`,
      { headers, signal, cache: "no-store" },
    );
    json = (await res.json().catch(() => ({}))) as { documents?: KakaoAddressDoc[] };
    const k = json.documents?.[0] as (KakaoAddressDoc & { road_address_name?: string; place_name?: string }) | undefined;
    if (k) {
      doc = {
        address_name: k.address_name,
        x: k.x,
        y: k.y,
        road_address: k.road_address_name
          ? { address_name: k.road_address_name, region_1depth_name: "", region_2depth_name: "", region_3depth_name: "", building_name: k.place_name ?? "" }
          : null,
        address: null,
      };
    }
  }
  if (!doc) return null;

  const region = doc.address ?? doc.road_address ?? null;
  return finite({
    lat: Number(doc.y),
    lng: Number(doc.x),
    roadAddress: doc.road_address?.address_name ?? null,
    jibunAddress: doc.address?.address_name ?? null,
    sido: region?.region_1depth_name || null,
    sigungu: region?.region_2depth_name || null,
    bname: region?.region_3depth_name || null,
    buildingName: doc.road_address?.building_name || null,
  });
}

type VworldResponse = {
  response?: {
    status?: "OK" | "NOT_FOUND" | "ERROR";
    error?: { text?: string };
    refined?: { text?: string; structure?: { level1?: string; level2?: string; level3?: string; level4L?: string; level4A?: string; level5?: string } };
    result?: { point?: { x: string; y: string } };
  };
};

/**
 * 제공자 2: 국토교통부 VWorld 지오코더 (무료, 결제수단 불필요, 일 4만 건).
 * 도로명으로 먼저 찾고 없으면 지번으로. 건물명은 주지 않으므로 다음 API 값을 그대로 쓴다.
 */
async function vworldGeocode(q: string, signal: AbortSignal): Promise<GeocodeResult | null> {
  const key = vworldKey();
  if (!key) return null;
  const referer = process.env.NEXTAUTH_URL || "https://www.w2o.co.kr";

  for (const type of ["road", "parcel"] as const) {
    const url =
      `https://api.vworld.kr/req/address?service=address&request=getcoord&version=2.0&crs=epsg:4326` +
      `&refine=true&simple=false&format=json&type=${type}&key=${encodeURIComponent(key)}&address=${encodeURIComponent(q)}`;
    const res = await fetch(url, { signal, cache: "no-store", headers: { Referer: referer } });
    const json = (await res.json().catch(() => ({}))) as VworldResponse;
    const r = json.response;
    if (!r || r.status !== "OK" || !r.result?.point) {
      if (r?.status === "ERROR") console.warn("[geo] VWorld 오류:", r.error?.text);
      continue;
    }
    const s = r.refined?.structure ?? {};
    const text = r.refined?.text ?? null;
    // 도로명: level3=법정동, level4A=행정동 / 지번: level3 비고 level4L 에 동이 온다
    const bname = s.level3 || (type === "parcel" ? s.level4L : "") || s.level4A || null;
    return finite({
      lat: Number(r.result.point.y),
      lng: Number(r.result.point.x),
      roadAddress: type === "road" ? text : null,
      jibunAddress: type === "parcel" ? text : null,
      sido: s.level1 || null,
      sigungu: s.level2 || null,
      bname,
      buildingName: null,
    });
  }
  return null;
}

/** 어느 제공자가 살아 있는지 (관리자 화면 안내용) */
export function geocoderStatus(): { kakao: boolean; vworld: boolean } {
  return { kakao: !!kakaoKey() && Date.now() >= kakaoDisabledUntil, vworld: !!vworldKey() };
}

/** 주소 문자열 → 좌표·행정구역. 카카오 → VWorld 순으로 시도, 모두 실패하면 null (예외를 던지지 않는다) */
export async function geocodeAddress(query: string, timeoutMs = 4000): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (!q) return null;
  if (geocodeCache.has(q)) return geocodeCache.get(q) ?? null;

  if (!kakaoKey() && !vworldKey()) {
    console.warn("[geo] 지오코딩 키 없음 (KAKAO_REST_API_KEY / VWORLD_API_KEY) — 좌표 조회 생략");
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let result: GeocodeResult | null = null;
    try {
      result = await kakaoGeocode(q, controller.signal);
    } catch (err) {
      console.warn("[geo] 카카오 예외:", err instanceof Error ? err.message : err);
    }
    if (!result) {
      try {
        result = await vworldGeocode(q, controller.signal);
      } catch (err) {
        console.warn("[geo] VWorld 예외:", err instanceof Error ? err.message : err);
      }
    }
    geocodeCache.set(q, result);
    return result;
  } finally {
    clearTimeout(timer);
  }
}

/** 물류센터 설정 로드. 좌표가 없으면 센터 주소를 지오코딩해 Setting 에 저장해 둔다 */
export async function getDeliveryCenter(): Promise<DeliveryCenter> {
  const rows = await prisma.setting.findMany({ where: { key: { in: [...CENTER_SETTING_KEYS] } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const num = (k: string) => {
    const n = Number(map.get(k));
    return Number.isFinite(n) && map.get(k) !== "" && map.get(k) !== undefined ? n : null;
  };

  const center: DeliveryCenter = {
    name: map.get("deliveryCenterName") || DEFAULT_CENTER.name,
    address: map.get("deliveryCenterAddress") || DEFAULT_CENTER.address,
    lat: num("deliveryCenterLat"),
    lng: num("deliveryCenterLng"),
    radiusKm: num("deliveryRadiusKm") ?? DEFAULT_CENTER.radiusKm,
    allowedDongs: (map.get("deliveryAllowedDongs") ?? "")
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean),
  };

  if (center.lat === null || center.lng === null) {
    const geo = await geocodeAddress(center.address);
    if (geo) {
      center.lat = geo.lat;
      center.lng = geo.lng;
      await Promise.all([
        prisma.setting.upsert({ where: { key: "deliveryCenterLat" }, update: { value: String(geo.lat) }, create: { key: "deliveryCenterLat", value: String(geo.lat) } }),
        prisma.setting.upsert({ where: { key: "deliveryCenterLng" }, update: { value: String(geo.lng) }, create: { key: "deliveryCenterLng", value: String(geo.lng) } }),
      ]);
    }
  }
  return center;
}

export type AreaJudgement = {
  status: AreaStatus;
  distanceKm: number | null;
  radiusKm: number;
  reason: string; // 사람이 읽는 판정 근거
  byWhitelist: boolean;
};

/** 좌표(없을 수 있음)와 법정동으로 배송 가능 여부 판정 */
export function judgeArea(
  point: LatLng | null,
  bname: string | null | undefined,
  center: DeliveryCenter,
): AreaJudgement {
  const byWhitelist = !!bname && center.allowedDongs.includes(bname);
  if (byWhitelist) {
    const d = point && center.lat !== null && center.lng !== null ? haversineKm(point, { lat: center.lat, lng: center.lng }) : null;
    return { status: "IN_RANGE", distanceKm: d, radiusKm: center.radiusKm, reason: `허용 동(${bname})`, byWhitelist: true };
  }
  if (!point || center.lat === null || center.lng === null) {
    return { status: "UNKNOWN", distanceKm: null, radiusKm: center.radiusKm, reason: point ? "센터 좌표 없음" : "주소 좌표 확인 불가", byWhitelist: false };
  }
  const d = haversineKm(point, { lat: center.lat, lng: center.lng });
  const rounded = Math.round(d * 10) / 10;
  if (d <= center.radiusKm) {
    return { status: "IN_RANGE", distanceKm: rounded, radiusKm: center.radiusKm, reason: `센터에서 ${rounded}km`, byWhitelist: false };
  }
  return { status: "OUT_OF_RANGE", distanceKm: rounded, radiusKm: center.radiusKm, reason: `반경 ${center.radiusKm}km 초과 (${rounded}km)`, byWhitelist: false };
}

/** 다음 우편번호 API가 주는 값 (클라이언트에서 그대로 넘긴다) */
export type DaumFields = {
  sido?: string | null;
  sigungu?: string | null;
  bname?: string | null;
  buildingName?: string | null;
  isApartment?: boolean | null;
  roadAddress?: string | null;
  jibunAddress?: string | null;
};

export type EnrichedLocation = DaumFields & {
  lat: number | null;
  lng: number | null;
  distanceKm: number | null;
  areaStatus: AreaStatus;
  apartmentId: string | null;
  geocodedAt: Date | null;
  judgement: AreaJudgement;
};

function normName(s: string) {
  return s.replace(/\s+/g, "").toLowerCase();
}

/** 사전 등록 단지와 buildingName 매칭 (표기 흔들림은 공백 제거·소문자로 흡수) */
export async function matchApartment(buildingName: string | null | undefined, sigungu?: string | null): Promise<string | null> {
  if (!buildingName) return null;
  const target = normName(buildingName);
  const candidates = await prisma.apartment.findMany({
    where: sigungu ? { sigungu } : undefined,
    select: { id: true, name: true, aliases: true },
    take: 500,
  });
  for (const apt of candidates) {
    if (normName(apt.name) === target) return apt.id;
    if (apt.aliases.some((a) => normName(a) === target)) return apt.id;
  }
  return null;
}

/**
 * 주소 한 건의 위치 정보를 채운다: 다음 API 값 보존 + 좌표 + 반경 판정 + 단지 매칭.
 * 지오코딩 실패해도 예외 없이 UNKNOWN 으로 돌려준다.
 */
export async function enrichLocation(address1: string, daum: DaumFields = {}): Promise<EnrichedLocation> {
  const query = daum.roadAddress || address1;
  const [geo, center] = await Promise.all([geocodeAddress(query), getDeliveryCenter()]);

  const merged: DaumFields = {
    sido: daum.sido ?? geo?.sido ?? null,
    sigungu: daum.sigungu ?? geo?.sigungu ?? null,
    bname: daum.bname ?? geo?.bname ?? null,
    buildingName: daum.buildingName ?? geo?.buildingName ?? null,
    isApartment: daum.isApartment ?? false,
    roadAddress: daum.roadAddress ?? geo?.roadAddress ?? null,
    jibunAddress: daum.jibunAddress ?? geo?.jibunAddress ?? null,
  };
  const point = geo ? { lat: geo.lat, lng: geo.lng } : null;
  const judgement = judgeArea(point, merged.bname, center);
  const apartmentId = await matchApartment(merged.buildingName, merged.sigungu).catch(() => null);

  return {
    ...merged,
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    distanceKm: judgement.distanceKm,
    areaStatus: judgement.status,
    apartmentId,
    geocodedAt: point ? new Date() : null,
    judgement,
  };
}

/** Address 레코드에 바로 넣을 수 있는 필드만 추린다 */
export function locationToAddressData(loc: EnrichedLocation) {
  return {
    sido: loc.sido ?? null,
    sigungu: loc.sigungu ?? null,
    bname: loc.bname ?? null,
    buildingName: loc.buildingName ?? null,
    isApartment: loc.isApartment ?? false,
    roadAddress: loc.roadAddress ?? null,
    jibunAddress: loc.jibunAddress ?? null,
    lat: loc.lat,
    lng: loc.lng,
    distanceKm: loc.distanceKm,
    areaStatus: loc.areaStatus,
    apartmentId: loc.apartmentId,
    geocodedAt: loc.geocodedAt,
  };
}

/** 주소의 areaStatus 로 주문 보류 여부·사유 결정 */
export function holdFromStatus(status: AreaStatus, distanceKm: number | null, radiusKm: number): { deliveryHold: boolean; deliveryHoldReason: string | null } {
  if (status === "OUT_OF_RANGE") {
    return { deliveryHold: true, deliveryHoldReason: `배송 반경 ${radiusKm}km 초과${distanceKm !== null ? ` (${distanceKm}km)` : ""}` };
  }
  if (status === "UNKNOWN") {
    return { deliveryHold: true, deliveryHoldReason: "주소 좌표 확인 불가 — 배송 가능 여부 확인 필요" };
  }
  return { deliveryHold: false, deliveryHoldReason: null };
}

/** 고객에게 보여줄 안내 문구 */
export function areaMessage(j: AreaJudgement): string {
  switch (j.status) {
    case "IN_RANGE":
      return j.byWhitelist ? "배송 가능 지역입니다." : `배송 가능 지역입니다. (센터에서 ${j.distanceKm}km)`;
    case "OUT_OF_RANGE":
      return `배송 권역(센터 반경 ${j.radiusKm}km) 밖입니다. 주문은 접수되며, 담당자가 주간에 전화로 배송 가능 여부를 안내드립니다.`;
    default:
      return "주소 위치를 자동으로 확인하지 못했습니다. 주문은 접수되며, 담당자가 확인 후 연락드립니다.";
  }
}
