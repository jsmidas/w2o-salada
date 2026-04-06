"use client";

import { useState, useEffect, useMemo } from "react";

type Product = {
  id: string;
  name: string;
  price: number;
  category: { name: string; slug: string };
  imageUrl: string | null;
};

type MenuAssignmentData = {
  id: string;
  productId: string;
  sortOrder: number;
  product: Product;
};

type CalendarEntry = {
  id: string;
  date: string;
  isActive: boolean;
  memo: string | null;
  menuAssignments: MenuAssignmentData[];
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function DeliveryCalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [calendars, setCalendars] = useState<CalendarEntry[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  // 배송일/상품 로드
  useEffect(() => {
    fetch(`/api/admin/delivery-calendar?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((data) => setCalendars(Array.isArray(data) ? data : []))
      .catch(() => setCalendars([]));
  }, [year, month]);

  useEffect(() => {
    fetch("/api/admin/products")
      .then((r) => r.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setProducts([]));
  }, []);

  // 월의 날짜 그리드 생성
  const calendarGrid = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startPad = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const grid: (number | null)[] = [];
    for (let i = 0; i < startPad; i++) grid.push(null);
    for (let d = 1; d <= totalDays; d++) grid.push(d);
    while (grid.length % 7 !== 0) grid.push(null);
    return grid;
  }, [year, month]);

  const calendarMap = useMemo(() => {
    const map = new Map<string, CalendarEntry>();
    for (const c of calendars) {
      const dateStr = new Date(c.date).toISOString().split("T")[0];
      map.set(dateStr!, c);
    }
    return map;
  }, [calendars]);

  const getDateStr = (day: number) => {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  const getEntry = (day: number) => calendarMap.get(getDateStr(day));

  // 배송일 토글
  const toggleDeliveryDay = async (day: number) => {
    const dateStr = getDateStr(day);
    const existing = getEntry(day);
    const newActive = existing ? !existing.isActive : true;

    const res = await fetch("/api/admin/delivery-calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year,
        month,
        dates: [{ date: dateStr, isActive: newActive, memo: existing?.memo }],
      }),
    });

    if (res.ok) {
      // 리로드
      const data = await fetch(`/api/admin/delivery-calendar?year=${year}&month=${month}`).then((r) => r.json());
      setCalendars(Array.isArray(data) ? data : []);
    }
  };

  // 화/목 일괄 지정
  const bulkSetTueThu = async () => {
    const dates: { date: string; isActive: boolean }[] = [];
    const lastDay = new Date(year, month, 0).getDate();

    for (let d = 1; d <= lastDay; d++) {
      const dateObj = new Date(year, month - 1, d);
      const dayOfWeek = dateObj.getDay();
      const dateStr = getDateStr(d);
      const isTueThu = dayOfWeek === 2 || dayOfWeek === 4;
      dates.push({ date: dateStr, isActive: isTueThu });
    }

    const res = await fetch("/api/admin/delivery-calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month, dates }),
    });

    if (res.ok) {
      const data = await fetch(`/api/admin/delivery-calendar?year=${year}&month=${month}`).then((r) => r.json());
      setCalendars(Array.isArray(data) ? data : []);
      setMessage("화/목 일괄 지정 완료");
      setTimeout(() => setMessage(""), 2000);
    }
  };

  // 식단 배정 저장
  const selectedEntry = selectedDate ? calendarMap.get(selectedDate) : null;
  const selectedAssignments = selectedEntry?.menuAssignments || [];

  const addProduct = async (productId: string) => {
    if (!selectedDate) return;
    const existing = selectedAssignments.map((a) => ({ id: a.productId, sortOrder: a.sortOrder }));
    if (existing.some((e) => e.id === productId)) return;

    const newList = [...existing, { id: productId, sortOrder: existing.length }];
    await saveAssignments(selectedDate, newList);
    setPickerOpen(false);
  };

  const removeProduct = async (productId: string) => {
    if (!selectedDate) return;
    const newList = selectedAssignments
      .filter((a) => a.productId !== productId)
      .map((a, i) => ({ id: a.productId, sortOrder: i }));
    await saveAssignments(selectedDate, newList);
  };

  const saveAssignments = async (date: string, productIds: { id: string; sortOrder: number }[]) => {
    setSaving(true);
    await fetch("/api/admin/menu-assignment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, productIds }),
    });
    const data = await fetch(`/api/admin/delivery-calendar?year=${year}&month=${month}`).then((r) => r.json());
    setCalendars(Array.isArray(data) ? data : []);
    setSaving(false);
  };

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setYear(y);
    setMonth(m);
    setSelectedDate(null);
  };

  const salads = products.filter((p) => p.category?.slug === "salad");
  const meals = products.filter((p) => p.category?.slug !== "salad");

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">배송일 캘린더</h1>
          <p className="text-gray-500 text-sm mt-1">배송일을 지정하고, 날짜별 메뉴를 배정합니다</p>
        </div>
        <button
          onClick={bulkSetTueThu}
          className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition"
        >
          화/목 일괄 지정
        </button>
      </div>

      {message && (
        <div className="mb-4 px-4 py-2 rounded-lg text-sm font-medium bg-green-50 text-green-600">{message}</div>
      )}

      {/* 월 이동 */}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 캘린더 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
              {WEEKDAYS.map((d, i) => (
                <div key={d} className={`text-center py-2 text-xs font-semibold ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-500"}`}>
                  {d}
                </div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div className="grid grid-cols-7">
              {calendarGrid.map((day, i) => {
                if (day === null) return <div key={i} className="h-24 border-b border-r border-gray-100" />;

                const dateStr = getDateStr(day);
                const entry = getEntry(day);
                const isActive = entry?.isActive === true;
                const isSelected = selectedDate === dateStr;
                const assignCount = entry?.menuAssignments?.length || 0;
                const dayOfWeek = new Date(year, month - 1, day).getDay();

                return (
                  <div
                    key={i}
                    className={`h-24 border-b border-r border-gray-100 p-1.5 cursor-pointer transition relative ${
                      isSelected ? "bg-[#1D9E75]/5 ring-2 ring-[#1D9E75] ring-inset" : "hover:bg-gray-50"
                    }`}
                    onClick={() => setSelectedDate(dateStr)}
                  >
                    {/* 날짜 번호 */}
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${dayOfWeek === 0 ? "text-red-400" : dayOfWeek === 6 ? "text-blue-400" : "text-gray-700"}`}>
                        {day}
                      </span>
                      {/* 배송일 토글 */}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleDeliveryDay(day); }}
                        className={`w-5 h-5 rounded-full flex items-center justify-center transition ${
                          isActive ? "bg-[#1D9E75] text-white" : "bg-gray-200 text-gray-400 hover:bg-gray-300"
                        }`}
                      >
                        {isActive && <span className="material-symbols-outlined text-[12px]">check</span>}
                      </button>
                    </div>

                    {/* 배송일 표시 */}
                    {isActive && (
                      <div className="mt-1">
                        <span className="text-[10px] font-bold text-[#1D9E75]">배송일</span>
                        {assignCount > 0 && (
                          <span className="text-[10px] text-gray-400 ml-1">메뉴 {assignCount}종</span>
                        )}
                      </div>
                    )}

                    {entry?.memo && (
                      <p className="text-[9px] text-[#EF9F27] mt-0.5 truncate">{entry.memo}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 오른쪽: 선택한 날짜의 식단 배정 */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 bg-white rounded-xl border border-gray-200 p-5">
            {selectedDate ? (
              <>
                <h3 className="font-bold text-gray-800 mb-1">
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}
                </h3>
                {selectedEntry?.isActive ? (
                  <>
                    <span className="text-xs text-[#1D9E75] font-semibold">배송일</span>

                    {/* 배정된 메뉴 */}
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-bold text-gray-500">배정된 메뉴 ({selectedAssignments.length}종)</p>
                      {selectedAssignments.length === 0 ? (
                        <p className="text-xs text-gray-300 italic">메뉴를 추가하세요</p>
                      ) : (
                        selectedAssignments.map((a) => (
                          <div key={a.productId} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                            a.product.category?.slug === "salad" ? "bg-[#f0faf4] border-[#1D9E75]/15" : "bg-[#FFF8EE] border-[#EF9F27]/15"
                          }`}>
                            <div className="flex-1 min-w-0">
                              <span className={`text-[9px] font-bold ${
                                a.product.category?.slug === "salad" ? "text-[#1D9E75]" : "text-[#EF9F27]"
                              }`}>
                                {a.product.category?.name}
                              </span>
                              <p className="text-sm text-gray-800 truncate">{a.product.name}</p>
                            </div>
                            <button
                              onClick={() => removeProduct(a.productId)}
                              className="text-gray-400 hover:text-red-500 shrink-0"
                            >
                              <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                          </div>
                        ))
                      )}

                      <button
                        onClick={() => setPickerOpen(true)}
                        className="w-full border-2 border-dashed border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-400 hover:border-[#1D9E75]/40 hover:text-[#1D9E75] transition"
                      >
                        + 메뉴 추가
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 mt-2">배송일이 아닙니다. 오른쪽 상단 체크를 눌러 배송일로 지정하세요.</p>
                )}
              </>
            ) : (
              <div className="text-center text-gray-400 py-8">
                <span className="material-symbols-outlined text-3xl mb-2 block">calendar_month</span>
                <p className="text-sm">날짜를 선택하세요</p>
              </div>
            )}

            {saving && <p className="text-xs text-[#1D9E75] mt-3">저장 중...</p>}
          </div>
        </div>
      </div>

      {/* 메뉴 추가 모달 */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPickerOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[70vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">메뉴 추가</h3>
              <button onClick={() => setPickerOpen(false)} className="text-gray-400 hover:text-gray-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[55vh] p-3">
              {salads.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-bold text-[#1D9E75] mb-2 px-1">샐러드</p>
                  {salads.map((p) => {
                    const alreadyAdded = selectedAssignments.some((a) => a.productId === p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => !alreadyAdded && addProduct(p.id)}
                        disabled={alreadyAdded}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${
                          alreadyAdded ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <span className="material-symbols-outlined text-gray-300">eco</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.price.toLocaleString()}원</p>
                        </div>
                        {alreadyAdded && <span className="text-xs text-gray-400">추가됨</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {meals.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-[#EF9F27] mb-2 px-1">간편식</p>
                  {meals.map((p) => {
                    const alreadyAdded = selectedAssignments.some((a) => a.productId === p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => !alreadyAdded && addProduct(p.id)}
                        disabled={alreadyAdded}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${
                          alreadyAdded ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50"
                        }`}
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
                          <p className="text-xs text-gray-400">{p.price.toLocaleString()}원</p>
                        </div>
                        {alreadyAdded && <span className="text-xs text-gray-400">추가됨</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {salads.length === 0 && meals.length === 0 && (
                <p className="text-center text-gray-400 py-8">등록된 상품이 없습니다</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
