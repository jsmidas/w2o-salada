"use client";

import { useState, useEffect } from "react";

type Settings = Record<string, string>;

const FIELDS = [
  { key: "subscribe.minItems", label: "최소 선택 수량", desc: "배송당 최소 몇 개를 선택해야 하는지", type: "number", unit: "개" },
  { key: "subscribe.maxItems", label: "최대 선택 수량", desc: "배송당 최대 몇 개까지 선택 가능한지", type: "number", unit: "개" },
  { key: "subscribe.salad.price", label: "샐러드 구독가", desc: "정기구독 시 샐러드 1개 가격", type: "number", unit: "원" },
  { key: "subscribe.salad.originalPrice", label: "샐러드 정가", desc: "할인 전 원래 가격 (취소선 표시용)", type: "number", unit: "원" },
  { key: "subscribe.trial.price", label: "맛보기 단가", desc: "맛보기(1회) 주문 시 1개 가격", type: "number", unit: "원" },
  { key: "subscribe.deliveryFee", label: "배송비", desc: "1회 배송당 배송비 (0 = 무료)", type: "number", unit: "원" },
  { key: "subscribe.weeksPerMonth", label: "월 배송 주수", desc: "한 달에 몇 주 배송하는지", type: "number", unit: "주" },
  { key: "subscribe.deliveryDays", label: "배송 요일", desc: "배송 요일 (tue=화, thu=목, 콤마 구분)", type: "text", unit: "" },
];

export default function SubscribeSettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const getValue = (key: string) => {
    return settings[key] ?? "";
  };

  const setValue = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const payload: Settings = {};
      for (const f of FIELDS) {
        payload[f.key] = settings[f.key] ?? "";
      }
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setMessage("저장되었습니다!");
      } else {
        setMessage("저장 실패");
      }
    } catch {
      setMessage("저장 중 오류 발생");
    }
    setSaving(false);
    setTimeout(() => setMessage(""), 3000);
  };

  // 미리보기 계산
  const minItems = parseInt(getValue("subscribe.minItems") || "2");
  const maxItems = parseInt(getValue("subscribe.maxItems") || "2");
  const saladPrice = parseInt(getValue("subscribe.salad.price") || "5900");
  const originalPrice = parseInt(getValue("subscribe.salad.originalPrice") || "7500");
  const trialPrice = parseInt(getValue("subscribe.trial.price") || "6900");
  const deliveryFee = parseInt(getValue("subscribe.deliveryFee") || "0");
  const weeks = parseInt(getValue("subscribe.weeksPerMonth") || "4");
  const deliveryDays = (getValue("subscribe.deliveryDays") || "tue,thu").split(",").length;

  const discountRate = originalPrice > 0 ? Math.round((1 - saladPrice / originalPrice) * 100) : 0;
  const monthlyMin = saladPrice * minItems * deliveryDays * weeks + deliveryFee * deliveryDays * weeks;
  const monthlyMax = saladPrice * maxItems * deliveryDays * weeks + deliveryFee * deliveryDays * weeks;
  const trialMin = trialPrice * minItems + deliveryFee;
  const trialMax = trialPrice * maxItems + deliveryFee;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#1D9E75] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">구독 설정</h1>
          <p className="text-gray-500 text-sm mt-1">선택 수량, 가격, 배송 조건을 설정합니다</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-[#1D9E75] text-white rounded-lg font-semibold hover:bg-[#167A5B] disabled:opacity-50 transition flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">save</span>
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm font-medium ${
          message.includes("실패") || message.includes("오류") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
        }`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 설정 폼 */}
        <div className="lg:col-span-2 space-y-4">
          {FIELDS.map((field) => (
            <div key={field.key} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <label className="font-semibold text-gray-800 text-sm">{field.label}</label>
                {field.unit && <span className="text-xs text-gray-400">{field.unit}</span>}
              </div>
              <p className="text-xs text-gray-400 mb-3">{field.desc}</p>
              <input
                type={field.type}
                value={getValue(field.key)}
                onChange={(e) => setValue(field.key, e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#1D9E75] transition"
              />
            </div>
          ))}
        </div>

        {/* 미리보기 */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#1D9E75] text-lg">preview</span>
              미리보기
            </h3>

            <div className="space-y-4 text-sm">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-semibold text-gray-700 mb-1">선택 수량</p>
                <p className="text-gray-500">배송당 {minItems}~{maxItems}개 선택</p>
              </div>

              <div className="p-3 bg-[#f0faf4] rounded-lg">
                <p className="font-semibold text-[#1D9E75] mb-1">정기구독</p>
                <p className="text-gray-500">
                  <span className="line-through text-gray-400">{originalPrice.toLocaleString()}원</span>
                  {" → "}
                  <span className="font-bold text-[#1D9E75]">{saladPrice.toLocaleString()}원</span>
                  <span className="text-red-500 text-xs ml-1">({discountRate}%↓)</span>
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  월 {monthlyMin.toLocaleString()}원
                  {monthlyMin !== monthlyMax && ` ~ ${monthlyMax.toLocaleString()}원`}
                </p>
              </div>

              <div className="p-3 bg-[#FFF8EE] rounded-lg">
                <p className="font-semibold text-[#EF9F27] mb-1">맛보기</p>
                <p className="text-gray-500">
                  {trialPrice.toLocaleString()}원/개
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  1회 {trialMin.toLocaleString()}원
                  {trialMin !== trialMax && ` ~ ${trialMax.toLocaleString()}원`}
                </p>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-semibold text-gray-700 mb-1">배송</p>
                <p className="text-gray-500">주 {deliveryDays}회 × {weeks}주</p>
                <p className="text-gray-400 text-xs mt-1">
                  배송비: {deliveryFee === 0 ? "무료" : `${deliveryFee.toLocaleString()}원/회`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
