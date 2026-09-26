"use client";

import { useCallback, useEffect, useState } from "react";
import AreaCheckNotice from "./AreaCheckNotice";
import DeliveryDetailFields from "./DeliveryDetailFields";
import {
  emptyDeliveryDetails, formatAddressLine, loadDaumPostcode, openDaumPostcode,
  type DeliveryDetails, type DropLocationValue, type PickedAddress,
} from "./daum";

export type SavedAddress = {
  id: string;
  label: string | null;
  name: string;
  phone: string;
  zipCode: string;
  address1: string;
  address2: string | null;
  buildingName: string | null;
  isDefault: boolean;
  areaStatus: "UNKNOWN" | "IN_RANGE" | "OUT_OF_RANGE";
  distanceKm: number | null;
  deliveryMemo: string | null;
  entranceMethod: string | null;
  entrancePassword: string | null;
  floor: string | null;
  dropLocation: DropLocationValue;
  dropNote: string | null;
};

/** 서버(/api/orders, /api/subscribe)로 보내는 형태 */
export type AddressSelection =
  | { addressId: string }
  | { address: PickedAddress & DeliveryDetails & { name: string; phone: string; address2: string; deliveryMemo: string } };

type NewForm = {
  name: string;
  phone: string;
  address2: string;
  deliveryMemo: string;
  picked: PickedAddress | null;
  details: DeliveryDetails;
};

const emptyNew: NewForm = { name: "", phone: "", address2: "", deliveryMemo: "", picked: null, details: emptyDeliveryDetails };

/**
 * 구독 신청 등 "배송지 하나를 고르는" 화면용.
 * 로그인 회원은 저장된 배송지 중 선택하거나 새로 입력, 비회원은 새로 입력.
 * 값이 유효할 때만 onChange 에 AddressSelection 을 넘기고, 아니면 null.
 */
export default function DeliveryAddressPicker({
  loggedIn,
  defaultName,
  defaultPhone,
  theme = "light",
  onChange,
}: {
  loggedIn: boolean;
  defaultName?: string | null;
  defaultPhone?: string | null;
  theme?: "dark" | "light";
  onChange: (sel: AddressSelection | null) => void;
}) {
  const [saved, setSaved] = useState<SavedAddress[]>([]);
  const [loaded, setLoaded] = useState(!loggedIn);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"saved" | "new">("new");
  const [form, setForm] = useState<NewForm>(emptyNew);

  const dark = theme === "dark";
  const input = dark
    ? "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-brand-green"
    : "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]";

  useEffect(() => { loadDaumPostcode(); }, []);

  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    fetch("/api/addresses")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: SavedAddress[]) => {
        if (cancelled) return;
        const arr = Array.isArray(list) ? list : [];
        setSaved(arr);
        if (arr.length > 0) {
          const def = arr.find((a) => a.isDefault) ?? arr[0]!;
          setSelectedId(def.id);
          setMode("saved");
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => { cancelled = true; };
  }, [loggedIn]);

  // 이름·전화 프리필 (새 배송지 폼) — props 값 우선, 없으면 회원 프로필에서 가져온다.
  // 채워진 값은 그 자리에서 고칠 수 있고, 저장 후에는 마이페이지 배송지에서 수정한다.
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      name: prev.name || defaultName || "",
      phone: prev.phone || defaultPhone || "",
    }));
  }, [defaultName, defaultPhone]);

  useEffect(() => {
    if (!loggedIn || (defaultName && defaultPhone)) return;
    let cancelled = false;
    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((profile: { name?: string | null; phone?: string | null } | null) => {
        if (cancelled || !profile) return;
        setForm((prev) => ({
          ...prev,
          name: prev.name || profile.name || "",
          phone: prev.phone || profile.phone || "",
        }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [loggedIn, defaultName, defaultPhone]);

  // 새 배송지 폼에서 아직 비어 있는 필수 항목
  const missing = [
    !form.name.trim() && "받는 분",
    !form.phone.trim() && "받는 분 전화번호",
    !form.picked && "주소",
  ].filter(Boolean) as string[];

  // 유효한 선택을 부모에 알린다
  useEffect(() => {
    if (mode === "saved" && selectedId) { onChange({ addressId: selectedId }); return; }
    const f = form;
    if (f.picked && f.name.trim() && f.phone.trim()) {
      onChange({ address: { ...f.picked, ...f.details, name: f.name.trim(), phone: f.phone.trim(), address2: f.address2, deliveryMemo: f.deliveryMemo } });
      return;
    }
    onChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedId, form]);

  const search = useCallback(() => {
    const ok = openDaumPostcode((picked) => {
      setForm((prev) => ({ ...prev, picked }));
      setTimeout(() => document.getElementById("picker-address2")?.focus(), 100);
    });
    if (!ok) alert("주소 검색을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
  }, []);

  const areaBadge = (a: SavedAddress) =>
    a.areaStatus === "IN_RANGE" ? { t: "배송 가능", c: dark ? "text-[#5DCAA5]" : "text-[#1D9E75]" }
      : a.areaStatus === "OUT_OF_RANGE" ? { t: "권역 밖 · 확인 필요", c: "text-amber-500" }
        : { t: "확인 필요", c: "text-gray-400" };

  return (
    <div className="space-y-3">
      {loggedIn && !loaded && <p className="text-xs text-gray-400">배송지 불러오는 중...</p>}

      {loggedIn && saved.length > 0 && (
        <div className="space-y-2">
          {saved.map((a) => {
            const on = mode === "saved" && selectedId === a.id;
            const badge = areaBadge(a);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => { setMode("saved"); setSelectedId(a.id); }}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition ${
                  on
                    ? dark ? "border-brand-green bg-brand-green/10" : "border-[#1D9E75] bg-[#1D9E75]/5"
                    : dark ? "border-white/10 hover:border-white/30" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className={`font-bold ${dark ? "text-white" : "text-[#0A1A0F]"}`}>{a.label || (a.isDefault ? "기본 배송지" : "배송지")}</span>
                  {a.isDefault && <span className={`text-[10px] px-1.5 rounded ${dark ? "bg-white/10 text-gray-300" : "bg-gray-100 text-gray-500"}`}>기본</span>}
                  <span className={`ml-auto text-[10px] ${badge.c}`}>{badge.t}</span>
                </div>
                <p className={`text-sm mt-0.5 ${dark ? "text-gray-200" : "text-gray-800"}`}>{a.name} · {a.phone}</p>
                <p className={`text-xs ${dark ? "text-gray-400" : "text-gray-500"}`}>{formatAddressLine(a.address1, a.buildingName)} {a.address2}</p>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMode("new")}
            className={`w-full text-left px-3 py-2.5 rounded-xl border border-dashed text-sm transition ${
              mode === "new"
                ? dark ? "border-brand-green text-white" : "border-[#1D9E75] text-[#0A1A0F]"
                : dark ? "border-white/20 text-gray-400 hover:border-white/40" : "border-gray-300 text-gray-500 hover:border-gray-400"
            }`}
          >
            + 다른 곳으로 보내기 (새 배송지)
          </button>
        </div>
      )}

      {mode === "new" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="받는 분 *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
            <input type="tel" placeholder="받는 분 전화번호 *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={input} />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              onClick={search}
              value={form.picked ? formatAddressLine(form.picked.address1, form.picked.buildingName) : ""}
              placeholder="주소를 검색하세요 *"
              className={`${input} cursor-pointer flex-1`}
            />
            <button type="button" onClick={search} className={`px-4 py-2 rounded-lg text-sm font-semibold shrink-0 ${dark ? "bg-brand-green text-white hover:bg-brand-mint" : "bg-[#1D9E75] text-white hover:bg-[#167A5B]"}`}>
              검색
            </button>
          </div>
          <input id="picker-address2" type="text" placeholder="상세주소 (동/호수)" value={form.address2} onChange={(e) => setForm({ ...form, address2: e.target.value })} className={input} />
          <AreaCheckNotice picked={form.picked} theme={theme} />
          <DeliveryDetailFields value={form.details} onChange={(details) => setForm({ ...form, details })} theme={theme} />
          <input type="text" placeholder="배송 메모 (선택)" value={form.deliveryMemo} onChange={(e) => setForm({ ...form, deliveryMemo: e.target.value })} className={input} />
          {missing.length > 0 ? (
            <p className={`text-[11px] ${dark ? "text-amber-300" : "text-amber-600"}`}>
              필수 항목(*)이 비어 있습니다: {missing.join(" · ")}. 나머지는 선택이며 나중에 마이페이지 배송지에서 수정할 수 있습니다.
            </p>
          ) : loggedIn ? (
            <p className={`text-[11px] ${dark ? "text-gray-500" : "text-gray-400"}`}>결제하면 이 주소가 배송지 목록에 저장되고, 마이페이지에서 수정할 수 있습니다.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
