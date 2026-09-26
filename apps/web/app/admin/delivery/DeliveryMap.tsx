"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * 배송 코스 지도 — 그날 배송지를 코스별 색 핀으로 찍고, 핀을 눌러 코스를 바꾼다.
 *
 * - 카카오맵 JavaScript SDK (NEXT_PUBLIC_KAKAO_JS_KEY). 키가 없으면 안내만 보인다
 * - 핀 = 배송지(집) 단위. 같은 집의 단건+구독은 핀 하나 (stopKey 기준)
 * - 색 = 코스 색(DeliveryRoute.color), 없으면 팔레트. 미배정은 회색
 * - 좌표 없는 주소는 지도에 못 찍으므로 아래 목록에 따로 보여준다
 */

type MapOrder = {
  id: string;
  orderNo: string;
  addressId?: string | null;
  customer: { name: string; phone: string };
  totalAmount: number;
  address: {
    receiver: string;
    address1: string;
    address2: string;
    bname?: string;
    buildingName?: string;
    isApartment?: boolean;
    distanceKm?: number | null;
    lat?: number | null;
    lng?: number | null;
    entranceMethod?: string;
    entrancePassword?: string;
    floor?: string;
    dropLocation?: string;
    dropNote?: string;
    memo?: string;
  } | null;
  delivery: { id: string; routeId?: string | null; routeLabel: string; sortOrder: number } | null;
};

type MapRoute = { id: string; name: string; driverName: string | null; maxStops: number; color: string | null };

type Center = { name: string; lat: number | null; lng: number | null; radiusKm: number };

const PALETTE = ["#1D9E75", "#EF9F27", "#3B82F6", "#A855F7", "#EC4899", "#14B8A6", "#F97316", "#6366F1"];
const UNASSIGNED = "#9CA3AF";

// 카카오 SDK 전역 — 타입 패키지 없이 최소한만 선언
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { kakao?: any }
}

let sdkPromise: Promise<void> | null = null;
function loadKakaoSdk(appKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.kakao?.maps?.Map) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    s.async = true;
    s.onload = () => {
      if (!window.kakao?.maps) return reject(new Error("kakao.maps 없음 — JS SDK 도메인 등록을 확인하세요"));
      window.kakao.maps.load(() => resolve());
    };
    s.onerror = () => reject(new Error("카카오맵 SDK 로드 실패 — 키 또는 도메인 등록을 확인하세요"));
    document.head.appendChild(s);
  });
  return sdkPromise;
}

const DROP_LABEL: Record<string, string> = { DOOR: "문 앞", SECURITY_OFFICE: "경비실", PARCEL_BOX: "택배함", OTHER: "기타" };

export default function DeliveryMap({
  orders,
  routeMaster,
  center,
  onAssign,
}: {
  orders: MapOrder[];
  routeMaster: MapRoute[];
  center: Center | null | undefined;
  onAssign: (deliveryId: string, routeId: string | null) => void;
}) {
  const appKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const [sdkState, setSdkState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const fittedSigRef = useRef<string>(""); // 어떤 집 집합에 대해 화면을 맞췄는지 — 날짜가 바뀌면 다시 맞춘다

  // 코스 → 색
  const routeColor = useMemo(() => {
    const m = new Map<string, string>();
    routeMaster.forEach((r, i) => m.set(r.id, r.color || PALETTE[i % PALETTE.length]!));
    return m;
  }, [routeMaster]);
  const colorOf = (routeId?: string | null) => (routeId && routeColor.get(routeId)) || UNASSIGNED;

  // 집(배송지) 단위로 묶기 — 같은 집의 여러 주문은 핀 하나
  const stops = useMemo(() => {
    const m = new Map<string, { key: string; orders: MapOrder[]; lat: number | null; lng: number | null }>();
    for (const o of orders) {
      if (!o.delivery) continue;
      const key = o.addressId ?? `order:${o.id}`;
      const cur = m.get(key) ?? { key, orders: [], lat: o.address?.lat ?? null, lng: o.address?.lng ?? null };
      cur.orders.push(o);
      m.set(key, cur);
    }
    return Array.from(m.values());
  }, [orders]);
  const located = stops.filter((s) => s.lat != null && s.lng != null);
  const unlocated = stops.filter((s) => s.lat == null || s.lng == null);
  const selected = selectedKey ? stops.find((s) => s.key === selectedKey) ?? null : null;

  // SDK 로드
  useEffect(() => {
    if (!appKey) return;
    setSdkState("loading");
    loadKakaoSdk(appKey)
      .then(() => setSdkState("ready"))
      .catch((e: Error) => { setSdkError(e.message); setSdkState("error"); });
  }, [appKey]);

  // 지도 생성 (한 번)
  useEffect(() => {
    if (sdkState !== "ready" || !containerRef.current || mapRef.current) return;
    const kakao = window.kakao;
    const first = located[0];
    const lat = center?.lat ?? first?.lat ?? 35.8347;
    const lng = center?.lng ?? first?.lng ?? 128.5019;
    const map = new kakao.maps.Map(containerRef.current, { center: new kakao.maps.LatLng(lat, lng), level: 6 });
    mapRef.current = map;

    // 센터 표시 + 배송 반경 원
    if (center?.lat != null && center?.lng != null) {
      const pos = new kakao.maps.LatLng(center.lat, center.lng);
      new kakao.maps.CustomOverlay({
        map, position: pos, yAnchor: 1,
        content: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none">
          <div style="background:#0A1A0F;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;white-space:nowrap">${center.name}</div>
          <div style="width:14px;height:14px;background:#0A1A0F;border:3px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div></div>`,
      });
      new kakao.maps.Circle({
        map, center: pos, radius: center.radiusKm * 1000,
        strokeWeight: 1, strokeColor: "#1D9E75", strokeOpacity: 0.6, strokeStyle: "dashed",
        fillColor: "#1D9E75", fillOpacity: 0.05,
      });
    }
  }, [sdkState, center, located]);

  // 핀 그리기 (주문·배정이 바뀔 때마다 다시)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || sdkState !== "ready") return;
    const kakao = window.kakao;
    for (const ov of overlaysRef.current) ov.setMap(null);
    overlaysRef.current = [];

    const bounds = new kakao.maps.LatLngBounds();
    let hasBounds = false;
    if (center?.lat != null && center?.lng != null) { bounds.extend(new kakao.maps.LatLng(center.lat, center.lng)); hasBounds = true; }

    for (const s of located) {
      const lead = s.orders[0]!;
      const d = lead.delivery!;
      const color = colorOf(d.routeId);
      const num = d.routeId && d.sortOrder > 0 ? String(d.sortOrder) : "·";
      const isSel = s.key === selectedKey;
      const el = document.createElement("div");
      el.style.cssText = "transform:translate(-50%,-100%);cursor:pointer;display:flex;flex-direction:column;align-items:center";
      el.innerHTML = `
        <div style="min-width:26px;height:26px;padding:0 6px;border-radius:13px;background:${color};color:#fff;font-size:12px;font-weight:800;
          display:flex;align-items:center;justify-content:center;border:${isSel ? "3px solid #0A1A0F" : "2px solid #fff"};
          box-shadow:0 1px 4px rgba(0,0,0,.35);white-space:nowrap">${num}${s.orders.length > 1 ? `<span style="font-size:9px;margin-left:2px;opacity:.85">×${s.orders.length}</span>` : ""}</div>
        <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${color};margin-top:-1px"></div>`;
      el.title = `${lead.customer.name} · ${lead.address?.address1 ?? ""}`;
      el.addEventListener("click", () => setSelectedKey((k) => (k === s.key ? null : s.key)));
      const pos = new kakao.maps.LatLng(s.lat, s.lng);
      const ov = new kakao.maps.CustomOverlay({ map, position: pos, content: el, yAnchor: 0, zIndex: isSel ? 10 : 1 });
      overlaysRef.current.push(ov);
      bounds.extend(pos);
      hasBounds = true;
    }
    // 집 집합이 바뀌었을 때(첫 표시·날짜 변경)만 전체가 보이게 맞춘다 — 핀 선택·코스 변경 때는 줌이 튀지 않게
    const sig = located.map((s) => s.key).sort().join("|");
    if (hasBounds && fittedSigRef.current !== sig) { map.setBounds(bounds, 40); fittedSigRef.current = sig; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located, selectedKey, sdkState, routeColor, center]);

  const fitAll = () => {
    const map = mapRef.current;
    if (!map || located.length === 0) return;
    const kakao = window.kakao;
    const bounds = new kakao.maps.LatLngBounds();
    for (const s of located) bounds.extend(new kakao.maps.LatLng(s.lat, s.lng));
    map.setBounds(bounds, 40);
  };

  // 코스별 집 수 (범례)
  const stopCountByRoute = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of stops) { const rid = s.orders[0]!.delivery?.routeId ?? ""; m.set(rid, (m.get(rid) ?? 0) + 1); }
    return m;
  }, [stops]);

  if (!appKey) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-bold">지도 키가 설정되지 않았습니다</p>
        <p className="text-xs mt-1">환경변수 <code>NEXT_PUBLIC_KAKAO_JS_KEY</code>에 카카오 JavaScript 키를 넣고, 카카오 개발자 콘솔의 JS SDK 도메인에 이 사이트 주소를 등록하세요.</p>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-3">
      <div className="relative bg-white rounded-xl border overflow-hidden">
        <div ref={containerRef} className="w-full h-[520px]" />
        {sdkState !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-sm text-gray-500 p-4 text-center">
            {sdkState === "error" ? <span className="text-red-600">{sdkError}</span> : "지도를 불러오는 중…"}
          </div>
        )}
        {/* 범례 */}
        <div className="absolute top-2 left-2 bg-white/95 rounded-lg shadow px-3 py-2 text-xs space-y-1 max-w-[220px]">
          {routeMaster.map((r) => {
            const cnt = stopCountByRoute.get(r.id) ?? 0;
            return (
              <div key={r.id} className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full border border-white shadow" style={{ backgroundColor: colorOf(r.id) }} />
                <span className="font-semibold text-gray-800">{r.name}</span>
                {r.driverName && <span className="text-gray-400">{r.driverName}</span>}
                <span className={`ml-auto ${cnt > r.maxStops ? "text-red-600 font-bold" : "text-gray-500"}`}>{cnt}/{r.maxStops}집</span>
              </div>
            );
          })}
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full border border-white shadow" style={{ backgroundColor: UNASSIGNED }} />
            <span className="text-gray-600">미배정</span>
            <span className="ml-auto text-gray-500">{stopCountByRoute.get("") ?? 0}집</span>
          </div>
        </div>
        <button type="button" onClick={fitAll} className="absolute top-2 right-2 bg-white/95 rounded-lg shadow px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-white">
          전체 보기
        </button>
      </div>

      {/* 오른쪽: 선택한 집 */}
      <div className="bg-white rounded-xl border p-4 text-sm space-y-3 lg:h-[520px] overflow-y-auto">
        {selected ? (
          <>
            {(() => {
              const lead = selected.orders[0]!;
              const a = lead.address;
              const d = lead.delivery!;
              return (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-gray-800">{lead.customer.name}{a && a.receiver !== lead.customer.name ? ` (수령 ${a.receiver})` : ""}</p>
                      <p className="text-xs text-gray-400">{lead.customer.phone}</p>
                    </div>
                    <button type="button" onClick={() => setSelectedKey(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none" aria-label="닫기">×</button>
                  </div>
                  {a && (
                    <div className="text-xs text-gray-700 space-y-0.5">
                      <p>{a.address1} {a.address2}</p>
                      <p className="text-gray-500">
                        {a.bname}{a.buildingName ? ` · ${a.buildingName}${a.isApartment ? " (아파트)" : ""}` : ""}{a.distanceKm != null ? ` · ${a.distanceKm}km` : ""}
                      </p>
                      {(a.entranceMethod || a.entrancePassword || a.floor || (a.dropLocation && a.dropLocation !== "DOOR")) && (
                        <p className="text-blue-700">
                          {a.floor && `${a.floor} · `}{a.entranceMethod}{a.entrancePassword && ` #${a.entrancePassword}`}
                          {a.dropLocation && a.dropLocation !== "DOOR" && ` · ${DROP_LABEL[a.dropLocation] ?? a.dropLocation}`}{a.dropNote && ` (${a.dropNote})`}
                        </p>
                      )}
                      {a.memo && <p className="text-amber-600">메모: {a.memo}</p>}
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    주문 {selected.orders.length}건 · {selected.orders.reduce((s, o) => s + o.totalAmount, 0).toLocaleString()}원
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">코스</label>
                    <select
                      value={d.routeId ?? ""}
                      onChange={(e) => onAssign(d.id, e.target.value || null)}
                      aria-label="코스 선택"
                      className={`w-full px-2 py-1.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#1D9E75] ${d.routeId ? "border-gray-200" : "border-amber-300 bg-amber-50"}`}
                    >
                      <option value="">미배정</option>
                      {routeMaster.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}{r.driverName ? ` · ${r.driverName}` : ""}</option>
                      ))}
                    </select>
                    {d.routeId && <p className="text-[11px] text-gray-400 mt-1">순번 {d.sortOrder || "-"} · 순번은 아래 표에서 바꿀 수 있습니다</p>}
                  </div>
                  <p className="text-[11px] text-gray-400">바꾼 코스는 "코스 배정 저장"을 눌러야 저장됩니다.</p>
                </>
              );
            })()}
          </>
        ) : (
          <div className="text-xs text-gray-500 space-y-2">
            <p className="font-semibold text-gray-700">핀을 누르면 집 정보와 코스 변경이 여기 나옵니다.</p>
            <p>핀 숫자는 코스 안 순번, ×2는 같은 집 주문 수입니다. 점선 원은 배송 반경입니다.</p>
            <p>집 {stops.length} · 지도 표시 {located.length}{unlocated.length > 0 ? ` · 좌표 없음 ${unlocated.length}` : ""}</p>
          </div>
        )}

        {unlocated.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-red-600 mb-1">좌표가 없어 지도에 못 찍은 집 {unlocated.length}</p>
            <ul className="text-[11px] text-gray-600 space-y-1">
              {unlocated.map((s) => {
                const lead = s.orders[0]!;
                return <li key={s.key}>{lead.customer.name} · {lead.address?.address1 ?? "배송지 없음"}</li>;
              })}
            </ul>
            <p className="text-[11px] text-gray-400 mt-1">설정 → 배송 권역의 "좌표 보정" 버튼으로 채울 수 있습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
