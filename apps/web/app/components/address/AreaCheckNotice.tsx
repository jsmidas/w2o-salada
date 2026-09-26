"use client";

import { useEffect, useState } from "react";
import type { PickedAddress } from "./daum";

type CheckResult = {
  status: "UNKNOWN" | "IN_RANGE" | "OUT_OF_RANGE";
  distanceKm: number | null;
  radiusKm: number;
  message: string;
};

/**
 * 주소를 고른 직후 배송 가능 여부를 보여준다. 결과가 어떻든 주문은 막지 않는다 —
 * 반경 밖·확인 불가는 접수 후 담당자가 전화로 판단한다는 안내만 한다.
 */
export default function AreaCheckNotice({
  picked,
  theme = "dark",
  onResult,
}: {
  picked: Pick<PickedAddress, "address1" | "roadAddress" | "jibunAddress" | "sido" | "sigungu" | "bname" | "buildingName" | "isApartment"> | null;
  theme?: "dark" | "light";
  onResult?: (r: CheckResult | null) => void;
}) {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const key = picked ? `${picked.address1}|${picked.roadAddress ?? ""}` : "";

  useEffect(() => {
    if (!picked?.address1) { setResult(null); onResult?.(null); return; }
    let cancelled = false;
    setChecking(true);
    fetch("/api/delivery/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(picked),
    })
      .then((r) => r.json())
      .then((data: CheckResult) => {
        if (cancelled) return;
        setResult(data);
        onResult?.(data);
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

  const tone =
    result.status === "IN_RANGE"
      ? dark ? "bg-brand-green/10 border-brand-green/30 text-[#5DCAA5]" : "bg-[#1D9E75]/5 border-[#1D9E75]/30 text-[#167A5B]"
      : result.status === "OUT_OF_RANGE"
        ? dark ? "bg-amber-500/10 border-amber-500/30 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-800"
        : dark ? "bg-white/5 border-white/10 text-gray-400" : "bg-gray-50 border-gray-200 text-gray-600";
  const icon = result.status === "IN_RANGE" ? "check_circle" : result.status === "OUT_OF_RANGE" ? "info" : "help";

  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs leading-relaxed ${tone}`}>
      <span className="material-symbols-outlined text-base shrink-0">{icon}</span>
      <span>{result.message}</span>
    </div>
  );
}
