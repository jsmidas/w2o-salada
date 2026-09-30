"use client";

import { useEffect, useState } from "react";
import type { PickedAddress } from "./daum";
import WaitlistForm, { type WaitlistPrefill, type WaitlistSource } from "./WaitlistForm";

export type CheckResult = {
  status: "UNKNOWN" | "IN_RANGE" | "OUT_OF_RANGE";
  /** false 면 결제를 받을 수 없다 (권역 모드 권역 밖 / 차단 규칙). 화면은 오픈 알림 신청으로 넘긴다 */
  canOrder: boolean;
  mode?: "LEGACY" | "ZONES";
  zoneName?: string | null;
  matchedBy?: string;
  distanceKm: number | null;
  radiusKm: number;
  message: string;
  suspendedDates?: { date: string; reason: string }[];
  waitlistPrefill?: WaitlistPrefill;
};

/**
 * 주소를 고른 직후 배송 가능 여부를 보여준다.
 *  - 기존 규칙 모드: 결과가 어떻든 주문은 막지 않는다 (반경 밖·확인 불가는 접수 후 담당자가 전화로 판단)
 *  - 권역 모드: 권역 밖이면 canOrder=false 로 내려오고, 여기서 바로 "오픈 알림 신청" 폼을 펼친다
 */
export default function AreaCheckNotice({
  picked,
  theme = "dark",
  onResult,
  dates,
  source = "checkout",
  defaultName,
  defaultPhone,
  showWaitlist = true,
}: {
  picked: Pick<PickedAddress, "zipCode" | "bcode" | "address1" | "roadAddress" | "jibunAddress" | "sido" | "sigungu" | "bname" | "buildingName" | "isApartment"> | null;
  theme?: "dark" | "light";
  onResult?: (r: CheckResult | null) => void;
  /** 화면이 아는 배송일 (YYYY-MM-DD) — 있으면 날짜별 중지도 함께 알려준다 */
  dates?: string[];
  source?: WaitlistSource;
  defaultName?: string | null;
  defaultPhone?: string | null;
  showWaitlist?: boolean;
}) {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const key = picked ? `${picked.address1}|${picked.roadAddress ?? ""}|${picked.zipCode ?? ""}|${(dates ?? []).join(",")}` : "";

  useEffect(() => {
    if (!picked?.address1) { setResult(null); onResult?.(null); return; }
    let cancelled = false;
    setChecking(true);
    fetch("/api/delivery/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...picked, dates }),
    })
      .then((r) => r.json())
      .then((data: CheckResult & { error?: string }) => {
        if (cancelled) return;
        if (data.error) { setResult(null); onResult?.(null); return; }
        const r = { ...data, canOrder: data.canOrder !== false };
        setResult(r);
        onResult?.(r);
      })
      .catch(() => { if (!cancelled) { setResult(null); onResult?.(null); } })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
    // picked 객체는 매 렌더 새로 만들어질 수 있어 주소 문자열을 키로 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!picked?.address1) return null;

  const dark = theme === "dark";
  if (checking && !result) {
    return <p className={`text-xs ${dark ? "text-gray-500" : "text-gray-400"}`}>배송 가능 여부 확인 중...</p>;
  }
  if (!result) return null;

  const blocked = !result.canOrder;
  const tone =
    result.status === "IN_RANGE"
      ? dark ? "bg-brand-green/10 border-brand-green/30 text-[#5DCAA5]" : "bg-[#1D9E75]/5 border-[#1D9E75]/30 text-[#167A5B]"
      : result.status === "OUT_OF_RANGE"
        ? dark ? "bg-amber-500/10 border-amber-500/30 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-800"
        : dark ? "bg-white/5 border-white/10 text-gray-400" : "bg-gray-50 border-gray-200 text-gray-600";
  const icon = result.status === "IN_RANGE" ? "check_circle" : result.status === "OUT_OF_RANGE" ? "info" : "help";
  const suspended = result.suspendedDates ?? [];

  return (
    <div className="space-y-2">
      <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs leading-relaxed ${tone}`}>
        <span className="material-symbols-outlined text-base shrink-0">{icon}</span>
        <span>{result.message}</span>
      </div>
      {suspended.length > 0 && (
        <div className={`px-3 py-2 rounded-lg border text-xs leading-relaxed ${dark ? "bg-red-500/10 border-red-500/30 text-red-300" : "bg-red-50 border-red-200 text-red-700"}`}>
          {suspended.map((s) => `${Number(s.date.slice(5, 7))}/${Number(s.date.slice(8, 10))}`).join(", ")} 배송은 이 지역에 중지되었습니다 ({[...new Set(suspended.map((s) => s.reason))].join(" · ")}). 다른 배송일을 선택해주세요.
        </div>
      )}
      {blocked && showWaitlist && (
        <WaitlistForm
          prefill={result.waitlistPrefill ?? { zipCode: picked.zipCode, bcode: picked.bcode, sido: picked.sido, sigungu: picked.sigungu, bname: picked.bname, address1: picked.address1, buildingName: picked.buildingName }}
          source={source}
          theme={theme}
          defaultName={defaultName}
          defaultPhone={defaultPhone}
        />
      )}
    </div>
  );
}
