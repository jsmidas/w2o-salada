"use client";

import { useEffect, useState } from "react";
import { formatAddressLine, loadDaumPostcode, openDaumPostcode, type PickedAddress } from "./daum";

/** 권역 판정 API 가 돌려주는 신청 폼 프리필 */
export type WaitlistPrefill = {
  zipCode: string | null;
  bcode?: string | null;
  sido?: string | null;
  sigungu?: string | null;
  bname?: string | null;
  address1?: string | null;
  buildingName?: string | null;
};

export type WaitlistSource = "checkout" | "subscribe" | "landing" | "mypage";

/**
 * "우리 동네 오픈 알림 신청" — 배송 권역 밖 고객이 남기는 대기 신청.
 * 이름·연락처·주소(동 단위)만 받는다. 상세주소는 받지 않는다 (필요 없는 개인정보는 모으지 않는다).
 * 개인정보 수집 동의는 필수, 마케팅 수신 동의는 선택.
 */
export default function WaitlistForm({
  prefill,
  source,
  theme = "light",
  defaultName,
  defaultPhone,
  compact = false,
  onDone,
}: {
  prefill: WaitlistPrefill | null;
  source: WaitlistSource;
  theme?: "dark" | "light";
  defaultName?: string | null;
  defaultPhone?: string | null;
  compact?: boolean;
  onDone?: () => void;
}) {
  const dark = theme === "dark";
  const [name, setName] = useState(defaultName ?? "");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [picked, setPicked] = useState<PickedAddress | null>(null);
  const [privacy, setPrivacy] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => { loadDaumPostcode(); }, []);
  useEffect(() => { if (defaultName && !name) setName(defaultName); }, [defaultName]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (defaultPhone && !phone) setPhone(defaultPhone); }, [defaultPhone]); // eslint-disable-line react-hooks/exhaustive-deps

  // 프리필(판정에 쓴 주소)이 있으면 그걸 쓰고, 없으면 여기서 주소를 고른다
  const addr: WaitlistPrefill | null = picked
    ? { zipCode: picked.zipCode, bcode: picked.bcode, sido: picked.sido, sigungu: picked.sigungu, bname: picked.bname, address1: picked.address1, buildingName: picked.buildingName }
    : prefill?.zipCode ? prefill : null;

  const search = () => {
    const ok = openDaumPostcode((p) => setPicked(p));
    if (!ok) alert("주소 검색을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
  };

  const submit = async () => {
    setError(null);
    if (!name.trim()) { setError("이름을 입력해주세요."); return; }
    if (!phone.trim()) { setError("휴대폰 번호를 입력해주세요."); return; }
    if (!addr?.zipCode) { setError("주소를 검색해주세요."); return; }
    if (!privacy) { setError("개인정보 수집·이용에 동의해주세요."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/delivery/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), ...addr, marketingConsent: marketing, source }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "신청에 실패했습니다."); return; }
      setDone(data.message ?? "신청이 접수되었습니다.");
      onDone?.();
    } catch {
      setError("네트워크 오류입니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };

  const input = dark
    ? "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-brand-green"
    : "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]";
  const label = dark ? "text-gray-300" : "text-gray-700";
  const muted = dark ? "text-gray-500" : "text-gray-400";
  const box = dark ? "bg-amber-500/10 border-amber-500/30" : "bg-amber-50 border-amber-200";

  if (done) {
    return (
      <div className={`rounded-xl border px-4 py-4 ${dark ? "bg-brand-green/10 border-brand-green/30" : "bg-[#1D9E75]/5 border-[#1D9E75]/30"}`}>
        <p className={`text-sm font-semibold flex items-center gap-1.5 ${dark ? "text-[#5DCAA5]" : "text-[#167A5B]"}`}>
          <span className="material-symbols-outlined text-base">check_circle</span>
          {done}
        </p>
        {addr && <p className={`text-xs mt-1 ${muted}`}>{addr.sigungu} {addr.bname} · {addr.zipCode}</p>}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border px-4 py-4 ${box}`}>
      {!compact && (
        <div className="mb-3">
          <p className={`text-sm font-bold ${dark ? "text-amber-200" : "text-amber-900"}`}>우리 동네 오픈 알림 신청</p>
          <p className={`text-xs mt-0.5 ${dark ? "text-amber-200/80" : "text-amber-800"}`}>
            아직 배송하지 않는 지역입니다. 신청해 두시면 배송이 시작될 때 문자로 알려드려요. 신청이 많은 동네부터 먼저 엽니다.
          </p>
        </div>
      )}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input type="text" placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} className={input} />
          <input type="tel" placeholder="휴대폰 번호" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            onClick={search}
            value={addr ? formatAddressLine(addr.address1 ?? `${addr.sigungu ?? ""} ${addr.bname ?? ""}`.trim(), addr.buildingName) : ""}
            placeholder="주소를 검색하세요"
            className={`${input} cursor-pointer flex-1`}
          />
          <button type="button" onClick={search} className={`px-3 py-2 rounded-lg text-sm font-semibold shrink-0 ${dark ? "bg-white/10 text-white hover:bg-white/20" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
            {addr ? "변경" : "검색"}
          </button>
        </div>
        <label className={`flex items-start gap-2 text-xs cursor-pointer ${label}`}>
          <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} className="mt-0.5 w-4 h-4 rounded" />
          <span>
            <b>[필수]</b> 개인정보 수집·이용 동의 — 이름·연락처·주소(동 단위)를 배송 지역 확대 안내 목적으로 수집하며, 신청일로부터 1년간 보관 후 삭제합니다.
          </span>
        </label>
        <label className={`flex items-start gap-2 text-xs cursor-pointer ${label}`}>
          <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 w-4 h-4 rounded" />
          <span><b>[선택]</b> 마케팅 정보 수신 동의 — 신메뉴·프로모션 소식을 문자로 받습니다.</span>
        </label>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="w-full py-2.5 rounded-lg text-sm font-bold bg-[#EF9F27] text-white hover:opacity-90 transition disabled:opacity-50"
        >
          {busy ? "신청 중..." : "오픈 알림 신청"}
        </button>
        <p className={`text-[11px] ${muted}`}>상세주소는 받지 않습니다. 배송이 시작되면 이 번호로 한 번만 안내드립니다.</p>
      </div>
    </div>
  );
}
