"use client";

import { useState, useEffect } from "react";

type Product = {
  id: string;
  name: string;
  category: { name: string; slug: string };
  imageUrl: string | null;
  price: number;
};

type ScheduleEntry = {
  week: number;
  day: string;
  slot: number;
  productId: string;
  product?: Product;
};

const weekLabels = ["1주차", "2주차", "3주차", "4주차"];
const dayLabels = [
  { key: "tue", label: "화요일" },
  { key: "thu", label: "목요일" },
];

export default function MenuSchedulePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [products, setProducts] = useState<Product[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [pickerTarget, setPickerTarget] = useState<{ week: number; day: string; slot: number } | null>(null);

  // 상품 목록 로드
  useEffect(() => {
    fetch("/api/admin/products")
      .then((r) => r.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setProducts([]));
  }, []);

  // 식단 로드
  useEffect(() => {
    fetch(`/api/admin/menu-schedule?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSchedule(data.map((d: ScheduleEntry & { product?: Product }) => ({
            week: d.week,
            day: d.day,
            slot: d.slot,
            productId: d.productId,
            product: d.product,
          })));
        }
      })
      .catch(() => setSchedule([]));
  }, [year, month]);

  const salads = products.filter((p) => p.category?.slug === "salad");
  const meals = products.filter((p) => p.category?.slug !== "salad");

  const getSlot = (week: number, day: string, slot: number) => {
    return schedule.find((s) => s.week === week && s.day === day && s.slot === slot);
  };

  const setSlot = (week: number, day: string, slot: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    setSchedule((prev) => {
      const filtered = prev.filter((s) => !(s.week === week && s.day === day && s.slot === slot));
      return [...filtered, { week, day, slot, productId, product }];
    });
    setPickerTarget(null);
  };

  const removeSlot = (week: number, day: string, slot: number) => {
    setSchedule((prev) => prev.filter((s) => !(s.week === week && s.day === day && s.slot === slot)));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/menu-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          month,
          entries: schedule.map((s) => ({
            week: s.week,
            day: s.day,
            slot: s.slot,
            productId: s.productId,
          })),
        }),
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

  // 월 이동
  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setYear(y);
    setMonth(m);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">식단 배정</h1>
          <p className="text-gray-500 text-sm mt-1">월별 배송 메뉴를 지정합니다 (4주 × 화/목)</p>
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

      {/* 월 선택 */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <span className="text-xl font-bold text-gray-900 min-w-[120px] text-center">
          {year}년 {month}월
        </span>
        <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      {/* 4주 식단표 */}
      <div className="space-y-6">
        {weekLabels.map((weekLabel, wIdx) => (
          <div key={wIdx} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* 주차 헤더 */}
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex items-center gap-2">
              <span className="font-bold text-gray-800">{weekLabel}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
              {dayLabels.map(({ key: dayKey, label: dayLabel }) => (
                <div key={dayKey} className="p-5">
                  <p className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#1D9E75] text-lg">calendar_today</span>
                    {dayLabel}
                  </p>

                  {/* 샐러드 슬롯 */}
                  <p className="text-xs font-bold text-[#1D9E75] mb-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">eco</span>
                    샐러드
                  </p>
                  <div className="space-y-2 mb-4">
                    {[0, 1].map((slot) => {
                      const entry = getSlot(wIdx + 1, dayKey, slot);
                      return (
                        <div key={slot} className="flex items-center gap-2">
                          {entry ? (
                            <div className="flex-1 flex items-center gap-2 bg-[#f0faf4] rounded-lg px-3 py-2 border border-[#1D9E75]/15">
                              <span className="text-sm text-gray-800 flex-1 truncate">{entry.product?.name || entry.productId}</span>
                              <button
                                onClick={() => removeSlot(wIdx + 1, dayKey, slot)}
                                className="text-gray-400 hover:text-red-500 transition shrink-0"
                              >
                                <span className="material-symbols-outlined text-lg">close</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setPickerTarget({ week: wIdx + 1, day: dayKey, slot })}
                              className="flex-1 border-2 border-dashed border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 hover:border-[#1D9E75]/40 hover:text-[#1D9E75] transition text-left"
                            >
                              + 샐러드 추가
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* 간편식 슬롯 */}
                  <p className="text-xs font-bold text-[#EF9F27] mb-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">lunch_dining</span>
                    간편식
                  </p>
                  <div className="space-y-2">
                    {[2].map((slot) => {
                      const entry = getSlot(wIdx + 1, dayKey, slot);
                      return (
                        <div key={slot} className="flex items-center gap-2">
                          {entry ? (
                            <div className="flex-1 flex items-center gap-2 bg-[#FFF8EE] rounded-lg px-3 py-2 border border-[#EF9F27]/15">
                              <span className="text-sm text-gray-800 flex-1 truncate">{entry.product?.name || entry.productId}</span>
                              <button
                                onClick={() => removeSlot(wIdx + 1, dayKey, slot)}
                                className="text-gray-400 hover:text-red-500 transition shrink-0"
                              >
                                <span className="material-symbols-outlined text-lg">close</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setPickerTarget({ week: wIdx + 1, day: dayKey, slot })}
                              className="flex-1 border-2 border-dashed border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 hover:border-[#EF9F27]/40 hover:text-[#EF9F27] transition text-left"
                            >
                              + 간편식 추가
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 상품 선택 모달 */}
      {pickerTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPickerTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[70vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">
                {pickerTarget.slot < 2 ? "샐러드 선택" : "간편식 선택"}
              </h3>
              <button onClick={() => setPickerTarget(null)} className="text-gray-400 hover:text-gray-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[55vh] p-3">
              {(pickerTarget.slot < 2 ? salads : meals).length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">
                  {pickerTarget.slot < 2 ? "등록된 샐러드가 없습니다" : "등록된 간편식이 없습니다"}
                </p>
              ) : (
                <div className="space-y-1">
                  {(pickerTarget.slot < 2 ? salads : meals).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSlot(pickerTarget.week, pickerTarget.day, pickerTarget.slot, p.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <span className="material-symbols-outlined text-gray-300">lunch_dining</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.category?.name} · {p.price.toLocaleString()}원</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
