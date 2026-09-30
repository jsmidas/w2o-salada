/**
 * 배송 권역 판정 — 시/도 전역 허용 → 허용 동 → 물류센터 반경 순 (배송 코스 1단계)
 *
 * - 2026-09-27: "우선 대구 전역" — Setting deliveryAllowedSido(기본 "대구")에 적힌 시/도는
 *   좌표와 무관하게 배송 가능. 비우면 반경 판정만 남는다.
 * - 좌표: 카카오 로컬 API (주소 검색 → 실패 시 키워드 검색). 키는 KAKAO_REST_API_KEY,
 *   없으면 카카오 로그인용 KAKAO_CLIENT_ID(같은 REST API 키)를 쓴다.
 *   ※ Kakao Developers 앱에서 "카카오맵" 서비스가 켜져 있어야 한다.
 * - 센터·반경·허용 시/도·허용 동은 Setting 에 두어 관리자가 조정한다.
 * - 좌표를 못 얻으면 UNKNOWN 으로 두고 사람이 확인한다 (주문은 막지 않는다).
 * - 2026-09-30: 권역 테이블(delivery-zone.ts)이 이 판정 위에 얹힌다. judgeArea 는 이제 "기존 규칙" 폴백이고,
 *   최종 areaStatus 는 enrichLocation / rejudgeAddress 가 judgeZone 을 거쳐 정한다.
 */
import { prisma } from "@repo/db";
import { judgeZone, type ZoneJudgement, type ZoneMode } from "./delivery-zone";

export type LatLng = { lat: number; lng: number };
export type AreaStatus = "UNKNOWN" | "IN_RANGE" | "OUT_OF_RANGE";

export type GeocodeResult = LatLng & {
  roadAddress: string | null;
  jibunAddress: string | null;
  bcode: string | null; // 법정동 코드 10자리 (카카오만 준다 — 기존 주소 bcode 보정용)
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
  allowedSido: string[]; // 전역 배송하는 시/도 (예: "대구") — 좌표 없이도 배송 가능 판정
  allowedDongs: string[]; // 반경 밖이라도 열어둔 법정동 (보조 화이트리스트)
};

export const CENTER_SETTING_KEYS = [
  "deliveryCenterName",
  "deliveryCenterAddress",
  "deliveryCenterLat",
  "deliveryCenterLng",
  "deliveryRadiusKm",
  "deliveryAllowedSido",
  "deliveryAllowedDongs",
] as const;

/** 기본 배송 반경 — 현장 판단 "10km 안이면 어디든" (2026-09-27). Setting deliveryRadiusKm 로 조정 */
export const DEFAULT_RADIUS_KM = 10;

/** 기본 전역 배송 시/도 — "우선 대구 전역" (2026-09-27). Setting deliveryAllowedSido 로 조정, 비우면 반경 판정만 */
export const DEFAULT_ALLOWED_SIDO = ["대구"];

/** 시/도 이름 정규화 — "대구광역시"·"대구" 를 같은 것으로 본다 */
export function normalizeSido(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, "").replace(/(특별자치시|특별자치도|특별시|광역시|자치시|자치도|도|시)$/, "");
}

function parseList(v: string | undefined, fallback: string[]): string[] {
  if (v === undefined) return fallback;
  return v.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
}

const DEFAULT_CENTER: DeliveryCenter = {
  name: "본사",
  address: "대구 달서구 성서공단로 332-10",
  lat: null,
  lng: null,
  radiusKm: DEFAULT_RADIUS_KM,
  allowedSido: DEFAULT_ALLOWED_SIDO,
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
  address?: { address_name: string; region_1depth_name: string; region_2depth_name: string; region_3depth_name: string; b_code?: string } | null;
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
    bcode: doc.address?.b_code || null,
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
      bcode: null,
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

/**
 * 무엇이 필요한가에 따라 제공자 순서가 다르다 (2026-09-30, 카카오맵 유료 전환 후 비용 최소화):
 *   coords — 좌표만 필요. 무료인 VWorld 먼저, 실패할 때만 카카오
 *   bcode  — 법정동 코드가 필요 (기존 주소 보정 배치). 카카오만 주므로 카카오 먼저
 */
export type GeocodeNeed = "coords" | "bcode";

/** 주소 문자열 → 좌표·행정구역. 모두 실패하면 null (예외를 던지지 않는다) */
export async function geocodeAddress(query: string, need: GeocodeNeed = "coords", timeoutMs = 4000): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (!q) return null;
  const cacheKey = `${need}:${q}`;
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey) ?? null;

  if (!kakaoKey() && !vworldKey()) {
    console.warn("[geo] 지오코딩 키 없음 (KAKAO_REST_API_KEY / VWORLD_API_KEY) — 좌표 조회 생략");
    return null;
  }

  const providers: [name: string, fn: (q: string, s: AbortSignal) => Promise<GeocodeResult | null>][] =
    need === "bcode" ? [["카카오", kakaoGeocode], ["VWorld", vworldGeocode]] : [["VWorld", vworldGeocode], ["카카오", kakaoGeocode]];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let result: GeocodeResult | null = null;
    for (const [name, fn] of providers) {
      try {
        result = await fn(q, controller.signal);
      } catch (err) {
        console.warn(`[geo] ${name} 예외:`, err instanceof Error ? err.message : err);
      }
      if (result) break;
    }
    geocodeCache.set(cacheKey, result);
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
    // 키가 아예 없으면 기본(대구), 관리자가 빈 값으로 저장하면 "전역 없음"(반경만)
    allowedSido: parseList(map.get("deliveryAllowedSido"), DEFAULT_CENTER.allowedSido),
    allowedDongs: parseList(map.get("deliveryAllowedDongs"), []),
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
  byWhitelist: boolean; // 시/도 전역 또는 허용 동으로 통과 (반경과 무관)
  areaLabel: string; // 고객 안내용 권역 이름 — "대구 전역" 또는 "센터 반경 10km"
};

/** 고객·관리자 안내에 쓰는 권역 이름 */
export function areaLabel(center: Pick<DeliveryCenter, "allowedSido" | "radiusKm">): string {
  return center.allowedSido.length > 0 ? `${center.allowedSido.join("·")} 전역` : `센터 반경 ${center.radiusKm}km`;
}

/**
 * 배송 가능 여부 판정. 우선순위: 시/도 전역 > 허용 동 > 센터 반경.
 * 시/도는 다음 우편번호 API가 항상 주므로 좌표를 못 얻어도 전역 시/도면 IN_RANGE 다.
 * 거리는 코스 배정용으로 좌표가 있으면 항상 계산해 둔다.
 */
export function judgeArea(
  point: LatLng | null,
  bname: string | null | undefined,
  center: DeliveryCenter,
  sido?: string | null,
): AreaJudgement {
  const label = areaLabel(center);
  const hasCenter = center.lat !== null && center.lng !== null;
  const distance = point && hasCenter ? Math.round(haversineKm(point, { lat: center.lat!, lng: center.lng! }) * 10) / 10 : null;

  const sidoKey = normalizeSido(sido);
  const bySido = !!sidoKey && center.allowedSido.some((s) => normalizeSido(s) === sidoKey);
  if (bySido) {
    return { status: "IN_RANGE", distanceKm: distance, radiusKm: center.radiusKm, reason: `${sido} 전역 배송`, byWhitelist: true, areaLabel: label };
  }
  const byDong = !!bname && center.allowedDongs.includes(bname);
  if (byDong) {
    return { status: "IN_RANGE", distanceKm: distance, radiusKm: center.radiusKm, reason: `허용 동(${bname})`, byWhitelist: true, areaLabel: label };
  }
  if (distance === null) {
    return { status: "UNKNOWN", distanceKm: null, radiusKm: center.radiusKm, reason: point ? "센터 좌표 없음" : "주소 좌표 확인 불가", byWhitelist: false, areaLabel: label };
  }
  if (distance <= center.radiusKm) {
    return { status: "IN_RANGE", distanceKm: distance, radiusKm: center.radiusKm, reason: `센터에서 ${distance}km`, byWhitelist: false, areaLabel: label };
  }
  return { status: "OUT_OF_RANGE", distanceKm: distance, radiusKm: center.radiusKm, reason: `${label} 밖 (센터에서 ${distance}km)`, byWhitelist: false, areaLabel: label };
}

/** 다음 우편번호 API가 주는 값 (클라이언트에서 그대로 넘긴다) */
export type DaumFields = {
  zipCode?: string | null; // zonecode — 권역 매칭 키
  bcode?: string | null;   // 법정동 코드 10자리 — 권역 매칭 키
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
  judgement: AreaJudgement; // 기존 규칙(시/도·동·반경) 판정 — 폴백·거리용
  // 권역 판정 (delivery-zone.ts). areaStatus 는 이 결과를 따른다
  zone: ZoneJudgement;
  zoneId: string | null;
  areaReason: string;
  canOrder: boolean;
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

export type EnrichOptions = {
  /**
   * auto(기본): 우편번호·법정동 코드·시/도만으로 판정이 끝나면 좌표를 조회하지 않는다 (유료 API 호출 최소화).
   *             반경 판정이 필요할 때만 조회한다
   * always:     항상 조회 (보정 배치처럼 좌표·법정동 코드 자체가 목적일 때)
   * never:      조회하지 않는다
   */
  geocode?: "auto" | "always" | "never";
  need?: GeocodeNeed;
};

/**
 * 주소 한 건의 위치 정보를 채운다: 다음 API 값 보존 + (필요할 때만) 좌표 + 반경 판정 + 단지 매칭.
 * 지오코딩 실패해도 예외 없이 UNKNOWN 으로 돌려준다.
 *
 * 비용: 판정은 먼저 좌표 없이 해 본다. 예외 규칙·권역 매칭·시/도 전역·허용 동 중 하나로 결론이 나면
 * 그걸로 끝이고, 센터 반경까지 가야 할 때만 좌표를 조회한다. 신규 주소는 다음 API가 우편번호·법정동 코드를
 * 주므로 권역 모드에서는 사실상 지오코딩이 일어나지 않는다. 좌표는 코스 배정 보조 정보일 뿐이라 없어도 된다.
 */
export async function enrichLocation(address1: string, daum: DaumFields = {}, opts: EnrichOptions = {}): Promise<EnrichedLocation> {
  const query = daum.roadAddress || address1;
  const center = await getDeliveryCenter();
  const mode = opts.geocode ?? "auto";

  const build = (geo: GeocodeResult | null): DaumFields => ({
    zipCode: daum.zipCode ?? null,
    bcode: daum.bcode ?? geo?.bcode ?? null,
    sido: daum.sido ?? geo?.sido ?? null,
    sigungu: daum.sigungu ?? geo?.sigungu ?? null,
    bname: daum.bname ?? geo?.bname ?? null,
    buildingName: daum.buildingName ?? geo?.buildingName ?? null,
    isApartment: daum.isApartment ?? false,
    roadAddress: daum.roadAddress ?? geo?.roadAddress ?? null,
    jibunAddress: daum.jibunAddress ?? geo?.jibunAddress ?? null,
  });

  // 1) 좌표 없이 먼저 판정
  let merged = build(null);
  let point: LatLng | null = null;
  let judgement = judgeArea(null, merged.bname, center, merged.sido);
  let apartmentId = await matchApartment(merged.buildingName, merged.sigungu).catch(() => null);
  let zone = await judgeZone({ ...merged, apartmentId }, judgement);
  // 규칙·권역·시/도·허용 동으로 결론이 났으면 좌표는 필요 없다. LEGACY 폴백에서 UNKNOWN(반경 판정 불가)일 때만 필요
  const decided = zone.matchedBy !== "LEGACY" || judgement.status !== "UNKNOWN";

  // 2) 필요할 때만 지오코딩
  if (mode === "always" || (mode === "auto" && !decided)) {
    const geo = await geocodeAddress(query, opts.need ?? "coords");
    if (geo) {
      merged = build(geo);
      point = { lat: geo.lat, lng: geo.lng };
      judgement = judgeArea(point, merged.bname, center, merged.sido);
      if (!apartmentId) apartmentId = await matchApartment(merged.buildingName, merged.sigungu).catch(() => null);
      zone = await judgeZone({ ...merged, apartmentId }, judgement, zone.mode);
    }
  }

  return {
    ...merged,
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    distanceKm: zone.distanceKm,
    areaStatus: zone.status,
    apartmentId,
    geocodedAt: point ? new Date() : null,
    judgement,
    zone,
    zoneId: zone.zoneId,
    areaReason: zone.reason,
    canOrder: zone.canOrder,
  };
}

/** 저장된 배송지가 갖는 위치 필드 — 재판정에 필요한 만큼만 */
export type StoredAddressLocation = {
  zipCode: string;
  bcode: string | null;
  sido: string | null;
  sigungu: string | null;
  bname: string | null;
  buildingName: string | null;
  apartmentId: string | null;
  lat: number | null;
  lng: number | null;
};

/**
 * 저장된 배송지를 현재 규칙으로 다시 판정한다 (지오코딩 없음 — 좌표·코드는 저장된 값을 쓴다).
 * 주문·구독 신청·자동결제·배송지 변경이 모두 이 함수를 거쳐 "지금 규칙" 기준으로 판단한다.
 * 돌려주는 data 는 Address 에 그대로 update 할 수 있는 형태.
 */
export async function rejudgeAddress(a: StoredAddressLocation, center?: DeliveryCenter, mode?: ZoneMode): Promise<{
  zone: ZoneJudgement;
  data: { areaStatus: AreaStatus; distanceKm: number | null; zoneId: string | null; areaReason: string };
}> {
  const c = center ?? (await getDeliveryCenter());
  const point = a.lat !== null && a.lng !== null ? { lat: a.lat, lng: a.lng } : null;
  const legacy = judgeArea(point, a.bname, c, a.sido);
  const zone = await judgeZone(
    { zipCode: a.zipCode, bcode: a.bcode, buildingName: a.buildingName, apartmentId: a.apartmentId, sigungu: a.sigungu, sido: a.sido, bname: a.bname },
    legacy,
    mode,
  );
  return { zone, data: { areaStatus: zone.status, distanceKm: zone.distanceKm, zoneId: zone.zoneId, areaReason: zone.reason } };
}

/** 저장된 배송지 한 건을 재판정하고 값이 달라졌으면 DB 에 반영한다. 주문·구독 경로 공용 */
export async function rejudgeAndStore<T extends StoredAddressLocation & { id: string; areaStatus: AreaStatus; distanceKm: number | null; zoneId: string | null; areaReason: string | null }>(
  saved: T,
  center?: DeliveryCenter,
): Promise<{ zone: ZoneJudgement; address: T }> {
  const { zone, data } = await rejudgeAddress(saved, center);
  if (data.areaStatus !== saved.areaStatus || data.distanceKm !== saved.distanceKm || data.zoneId !== saved.zoneId || data.areaReason !== saved.areaReason) {
    await prisma.address.update({ where: { id: saved.id }, data });
    return { zone, address: { ...saved, ...data } };
  }
  return { zone, address: saved };
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
    bcode: loc.bcode ?? null,
    zoneId: loc.zoneId,
    areaReason: loc.areaReason,
  };
}

/**
 * 주소의 areaStatus 로 주문 보류 여부·사유 결정. label 은 areaLabel() 결과.
 * label 없이 부르는 곳(구독 갱신 등)은 저장된 areaStatus 만 믿으므로 권역 이름을 단정하지 않는다.
 * reason 이 있으면(권역 판정 근거) 사유에 그대로 쓴다.
 */
export function holdFromStatus(status: AreaStatus, distanceKm: number | null, label?: string, reason?: string | null): { deliveryHold: boolean; deliveryHoldReason: string | null } {
  if (status === "OUT_OF_RANGE") {
    if (reason) return { deliveryHold: true, deliveryHoldReason: `배송 권역 밖 — ${reason}` };
    const area = label ? `(${label}) ` : " ";
    return { deliveryHold: true, deliveryHoldReason: `배송 권역${area}밖${distanceKm !== null ? ` (센터에서 ${distanceKm}km)` : ""}` };
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
      return j.byWhitelist ? `배송 가능 지역입니다. (${j.reason})` : `배송 가능 지역입니다. (센터에서 ${j.distanceKm}km)`;
    case "OUT_OF_RANGE":
      return `배송 권역(${j.areaLabel}) 밖입니다. 주문은 접수되며, 담당자가 주간에 전화로 배송 가능 여부를 안내드립니다.`;
    default:
      return "주소 위치를 자동으로 확인하지 못했습니다. 주문은 접수되며, 담당자가 확인 후 연락드립니다.";
  }
}
