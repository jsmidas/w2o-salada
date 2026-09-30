"use client";

import { useEffect, useState } from "react";
import { formatAddressLine, loadDaumPostcode, openDaumPostcode, type PickedAddress } from "./daum";
import AreaCheckNotice, { type CheckResult } from "./AreaCheckNotice";
import type { WaitlistSource } from "./WaitlistForm";

/**
 * "배송 가능 지역 확인" 입력창 — 메인·구독 안내 페이지용.
 * 주소 검색 → 즉시 판정 → 불가 지역이면 그 자리에서 오픈 알림 신청.
 */
export default function AreaLookup({
  source = "landing",
  theme = "light",
  title = "우리 동네 배송 가능한지 확인해 보세요",
  className = "",
}: {
  source?: WaitlistSource;
  theme?: "dark" | "light";
  title?: string;
  className?: string;
}) {
  const [picked, setPicked] = useState<PickedAddress | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const dark = theme === "dark";

  useEffect(() => { loadDaumPostcode(); }, []);

  const search = () => {
    const ok = openDaumPostcode((p) => setPicked(p));
    if (!ok) alert("주소 검색을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
  };

  return (
    <div className={`rounded-2xl border p-5 ${dark ? "bg-white/5 border-white/10" : "bg-white border-[#1D9E75]/15 shadow-sm"} ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`material-symbols-outlined ${dark ? "text-[#5DCAA5]" : "text-[#1D9E75]"}`}>location_searching</span>
        <p className={`font-bold text-sm ${dark ? "text-white" : "text-[#0A1A0F]"}`}>{title}</p>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          readOnly
          onClick={search}
          value={picked ? formatAddressLine(picked.address1, picked.buildingName) : ""}
          placeholder="주소를 검색하세요 (도로명·지번·건물명)"
          className={`flex-1 cursor-pointer text-sm rounded-lg px-3 py-2.5 focus:outline-none ${
            dark ? "bg-white/5 border border-white/10 text-white placeholder-gray-500" : "border border-gray-200 text-gray-800 placeholder-gray-400"
          }`}
        />
        <button
          type="button"
          onClick={search}
          className="shrink-0 px-4 py-2.5 rounded-lg text-sm font-bold bg-[#1D9E75] text-white hover:bg-[#167A5B] transition"
        >
          확인
        </button>
      </div>
      <div className="mt-3">
        <AreaCheckNotice picked={picked} theme={theme} source={source} onResult={setResult} />
      </div>
      {result?.canOrder && result.status === "IN_RANGE" && (
        <a href="/menu" className={`inline-flex items-center gap-1 mt-3 text-sm font-semibold ${dark ? "text-[#5DCAA5]" : "text-[#1D9E75]"} hover:underline`}>
          메뉴 보러 가기
          <span className="material-symbols-outlined text-base">arrow_forward</span>
        </a>
      )}
    </div>
  );
}
