"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import useSWR from "swr";
import { fetcher } from "../../lib/fetcher";

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
};

type Product = {
  id: string;
  name: string;
  price: number;
  category: Category;
  imageUrl: string | null;
};

// 카테고리 색상 매핑 (DB color 우선, 폴백)
const CATEGORY_FALLBACK_COLOR = "#6b7280";
function getCatColor(cat?: Pick<Category, "color">) {
  return cat?.color || CATEGORY_FALLBACK_COLOR;
}
// 연한 배경색 (색상 + 알파)을 위한 유틸: color는 hex라 15% 투명도로 배경 구성
function getCatBgStyle(cat?: Pick<Category, "color">): React.CSSProperties {
  const c = getCatColor(cat);
  return { backgroundColor: `${c}14`, borderColor: `${c}26` };
}

/**
 * 캘린더 엔트리의 date(서버 ISO 문자열 또는 로컬 "YYYY-MM-DD")를
 * 비교용 키 "YYYY-MM-DD"로 정규화한다.
 */
function toDateKey(date: string): string {
  return new Date(date).toISOString().split("T")[0]!;
}

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
  substituteWeekday: number | null; // 휴일 대체 배송일이면 원래 요일 (0=일~6=토) — 요일별 구독 구성이 이 요일로 해석된다
  menuAssignments: MenuAssignmentData[];
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
/** 정규 배송 요일 — 이 요일이 아닌 날을 배송일로 켜면 "무슨 요일 대신인지" 고르게 한다 */
const REGULAR_WEEKDAYS = [2, 4];

/** 상품 썸네일 — imageUrl이 깨진 경우 카테고리 아이콘으로 폴백 */
function ProductThumb({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(product.imageUrl) && !failed;

  return (
    <div className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
      {showImage ? (
        <img
          src={product.imageUrl!}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="material-symbols-outlined text-gray-300 text-xl">
          {product.category?.icon || "restaurant"}
        </span>
      )}
    </div>
  );
}

export default function DeliveryCalendarClient({
  initialProducts,
}: {
  initialProducts: Product[];
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [calendars, setCalendars] = useState<CalendarEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"ok" | "error">("ok");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [modalPos, setModalPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // 모달 내 선택 상태 (다중 선택)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [activeCatId, setActiveCatId] = useState<string>("all");

  const notify = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    setMessage(text);
    setMessageTone(tone);
    setTimeout(() => setMessage(""), 2500);
  }, []);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: modalPos.x, originY: modalPos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setModalPos({
        x: dragRef.current.originX + (ev.clientX - dragRef.current.startX),
        y: dragRef.current.originY + (ev.clientY - dragRef.current.startY),
      });
    };
    const onUp = () => { dragRef.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [modalPos]);

  // ESC로 모달 닫기
  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPickerOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickerOpen]);

  // 배송일/상품 로드
  useEffect(() => {
    fetch(`/api/admin/delivery-calendar?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((data) => setCalendars(Array.isArray(data) ? data : []))
      .catch(() => setCalendars([]));
  }, [year, month]);

  const { data: productsData } = useSWR<Product[]>("/api/admin/products", fetcher, {
    fallbackData: initialProducts,
    revalidateOnFocus: false,
  });
  const products = Array.isArray(productsData) ? productsData : [];

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
      map.set(toDateKey(c.date), c);
    }
    return map;
  }, [calendars]);

  const getDateStr = (day: number) => {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  const getEntry = (day: number) => calendarMap.get(getDateStr(day));

  // 식단 배정 (로컬 편집 → 일괄 저장)
  const [dirtyDates, setDirtyDates] = useState<Set<string>>(new Set());
  // 비동기 응답 처리 중에도 최신 dirty 집합을 읽기 위한 미러
  const dirtyDatesRef = useRef<Set<string>>(new Set());
  const hasDirty = dirtyDates.size > 0;

  const markDirty = useCallback((date: string) => {
    setDirtyDates((prev) => {
      const next = new Set(prev).add(date);
      dirtyDatesRef.current = next;
      return next;
    });
  }, []);

  const setDirty = useCallback((next: Set<string>) => {
    dirtyDatesRef.current = next;
    setDirtyDates(next);
  }, []);

  /**
   * 서버 응답으로 캘린더를 갱신하되, 아직 저장하지 않은(dirty) 날짜의 메뉴 배정은
   * 로컬 편집본을 유지한다. 이걸 하지 않으면 배송일 토글이나 화/목 일괄 지정이
   * 미저장 배정을 통째로 덮어써 사라지게 만든다.
   */
  const mergeCalendars = useCallback((server: CalendarEntry[]) => {
    setCalendars((prev) => {
      const localByDate = new Map(prev.map((c) => [toDateKey(c.date), c]));
      return server.map((c) => {
        const key = toDateKey(c.date);
        const local = localByDate.get(key);
        return dirtyDatesRef.current.has(key) && local
          ? { ...c, menuAssignments: local.menuAssignments }
          : c;
      });
    });
  }, []);

  // 배송일 토글
  const toggleDeliveryDay = async (day: number) => {
    const dateStr = getDateStr(day);
    const existing = getEntry(day);
    const newActive = existing ? !existing.isActive : true;

    // 메뉴가 배정된 날을 해제할 때만 확인한다. 배정 자체는 지워지지 않고 남는다.
    const assigned = existing?.menuAssignments.length ?? 0;
    if (
      !newActive &&
      assigned > 0 &&
      !confirm(`${month}월 ${day}일에 메뉴 ${assigned}종이 배정돼 있습니다.
배송일에서 해제할까요? (메뉴 배정은 그대로 남습니다)`)
    ) {
      return;
    }

    // 낙관적 업데이트
    setCalendars((prev) => {
      const idx = prev.findIndex((c) => toDateKey(c.date) === dateStr);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx]!, isActive: newActive };
        return updated;
      }
      return [...prev, { id: "", date: dateStr, isActive: newActive, memo: null, substituteWeekday: null, menuAssignments: [] }];
    });

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
      const data = await res.json();
      if (Array.isArray(data)) mergeCalendars(data);
    }
  };

  // 휴일 대체 배송일의 원래 요일 지정 — 월요일에 나가는 "화요일 배송"이면 2. null 이면 실제 요일로 본다
  const setSubstituteWeekday = async (dateStr: string, value: number | null) => {
    const existing = calendarMap.get(dateStr);
    setCalendars((prev) => prev.map((c) => (toDateKey(c.date) === dateStr ? { ...c, substituteWeekday: value } : c)));
    const res = await fetch("/api/admin/delivery-calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year,
        month,
        dates: [{ date: dateStr, isActive: true, memo: existing?.memo, substituteWeekday: value }],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) mergeCalendars(data);
      notify(value == null ? "대체 요일 해제" : `${WEEKDAYS[value]}요일 대체 배송일로 지정`);
    } else {
      notify("대체 요일 저장 실패", "error");
    }
  };

  // 화/목 일괄 지정
  const bulkSetTueThu = async () => {
    // 달 전체를 덮어쓰므로 직접 추가한 요일(주 3회 배송 등)이 해제된다 — 먼저 확인
    const activeCount = calendars.filter((c) => c.isActive).length;
    if (
      activeCount > 0 &&
      !confirm("이 달 배송일을 화·목으로 다시 지정합니다. 직접 추가한 다른 요일은 해제됩니다. 계속할까요?")
    ) {
      return;
    }

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
      body: JSON.stringify({ year, month, dates, replaceMonth: true }),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) mergeCalendars(data);
      notify("화/목 일괄 지정 완료");
    }
  };

  const selectedEntry = selectedDate ? calendarMap.get(selectedDate) : null;
  const selectedAssignments = useMemo(
    () => selectedEntry?.menuAssignments || [],
    [selectedEntry],
  );

  /** 선택한 날짜의 배정 목록을 통째로 교체 (엔트리가 없으면 새로 만든다) */
  const replaceAssignments = useCallback(
    (date: string, next: MenuAssignmentData[]) => {
      setCalendars((prev) => {
        const idx = prev.findIndex((c) => toDateKey(c.date) === date);
        if (idx < 0) {
          return [...prev, { id: "", date, isActive: true, memo: null, substituteWeekday: null, menuAssignments: next }];
        }
        const updated = [...prev];
        updated[idx] = { ...updated[idx]!, menuAssignments: next };
        return updated;
      });
      markDirty(date);
    },
    [markDirty],
  );

  const removeProduct = (productId: string) => {
    if (!selectedDate) return;
    const next = selectedAssignments
      .filter((a) => a.productId !== productId)
      .map((a, i) => ({ ...a, sortOrder: i }));
    replaceAssignments(selectedDate, next);
  };

  // 메뉴 선택 모달
  const openPicker = () => {
    // 이미 배정된 메뉴를 선택 상태로 열어, 체크/해제만으로 추가·제거가 되게 한다
    setSelectedIds(new Set(selectedAssignments.map((a) => a.productId)));
    setSearch("");
    setActiveCatId("all");
    setModalPos({ x: 0, y: 0 });
    setPickerOpen(true);
  };

  const toggleSelect = (productId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  /** 모달에서 고른 상품 집합을 해당 날짜의 배정으로 반영 */
  const applySelection = () => {
    if (!selectedDate) return;

    // 기존 배정은 순서를 유지한 채 남기고, 새로 고른 항목을 체크 순서대로 뒤에 붙인다
    const kept = selectedAssignments.filter((a) => selectedIds.has(a.productId));
    const added = Array.from(selectedIds)
      .filter((id) => !selectedAssignments.some((a) => a.productId === id))
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is Product => Boolean(p))
      .map((p) => ({ id: `temp-${p.id}`, productId: p.id, sortOrder: 0, product: p }));

    const next = [...kept, ...added].map((a, i) => ({ ...a, sortOrder: i }));
    replaceAssignments(selectedDate, next);
    setPickerOpen(false);
  };

  const saveAllAssignments = async () => {
    if (dirtyDates.size === 0) return;
    setSaving(true);

    const targets = Array.from(dirtyDates);
    const results = await Promise.all(
      targets.map(async (date) => {
        const entry = calendarMap.get(date);
        const productIds = (entry?.menuAssignments || []).map((a, i) => ({ id: a.productId, sortOrder: i }));
        try {
          const res = await fetch("/api/admin/menu-assignment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date, productIds }),
          });
          return { date, ok: res.ok, data: res.ok ? await res.json() : null };
        } catch {
          return { date, ok: false, data: null };
        }
      }),
    );

    // 성공한 날짜는 서버 응답(실제 id 포함)으로 교체하고, 실패한 날짜는 dirty로 남긴다
    const savedByDate = new Map(
      results.filter((r) => r.ok && r.data).map((r) => [r.date, r.data as CalendarEntry]),
    );
    if (savedByDate.size > 0) {
      setCalendars((prev) =>
        prev.map((c) => {
          const saved = savedByDate.get(toDateKey(c.date));
          return saved ? { ...c, id: saved.id, menuAssignments: saved.menuAssignments ?? [] } : c;
        }),
      );
    }

    const failed = targets.filter((d) => !savedByDate.has(d));
    setDirty(new Set(failed));
    setSaving(false);

    if (failed.length > 0) {
      notify(`${savedByDate.size}일 저장 완료 · ${failed.length}일 실패`, "error");
    } else {
      notify("메뉴 배정 저장 완료");
    }
  };

  const changeMonth = (delta: number) => {
    if (hasDirty && !confirm(`저장하지 않은 메뉴 배정이 ${dirtyDates.size}일 있습니다. 이동하면 사라집니다. 계속할까요?`)) {
      return;
    }
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setYear(y);
    setMonth(m);
    setSelectedDate(null);
    setDirty(new Set());
  };

  // 카테고리별 동적 그룹핑 (category.sortOrder 기준)
  const productsByCategory = useMemo(() => {
    const groups = new Map<string, { category: Category; items: Product[] }>();
    for (const p of products) {
      if (!p.category) continue;
      const key = p.category.id;
      if (!groups.has(key)) {
        groups.set(key, { category: p.category, items: [] });
      }
      groups.get(key)!.items.push(p);
    }
    return Array.from(groups.values()).sort(
      (a, b) => (a.category.sortOrder ?? 99) - (b.category.sortOrder ?? 99),
    );
  }, [products]);

  // 모달에 실제로 그릴 목록 (카테고리 필터 + 이름 검색)
  const visibleGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return productsByCategory
      .filter((g) => activeCatId === "all" || g.category.id === activeCatId)
      .map((g) => ({
        category: g.category,
        items: q ? g.items.filter((p) => p.name.toLowerCase().includes(q)) : g.items,
      }))
      .filter((g) => g.items.length > 0);
  }, [productsByCategory, activeCatId, search]);

  const totalProductCount = useMemo(
    () => productsByCategory.reduce((sum, g) => sum + g.items.length, 0),
    [productsByCategory],
  );

  return (
    <div className="p-4 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">배송일 캘린더</h1>
          <p className="text-gray-400 text-xs">배송일을 지정하고, 날짜별 메뉴를 배정합니다</p>
        </div>
        <button
          onClick={bulkSetTueThu}
          className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition"
        >
          화/목 일괄 지정
        </button>
      </div>

      {message && (
        <div
          className={`mb-2 px-4 py-2 rounded-lg text-sm font-medium ${
            messageTone === "error" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
          }`}
        >
          {message}
        </div>
      )}

      {/* 월 이동 */}
      <div className="flex items-center gap-3 mb-2">
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
                if (day === null) return <div key={i} className="min-h-[120px] border-b border-r border-gray-100" />;

                const dateStr = getDateStr(day);
                const entry = getEntry(day);
                const isActive = entry?.isActive === true;
                const isSelected = selectedDate === dateStr;
                const isDirty = dirtyDates.has(dateStr);
                const assignments = entry?.menuAssignments || [];
                const dayOfWeek = new Date(year, month - 1, day).getDay();

                return (
                  <div
                    key={i}
                    className={`min-h-[120px] border-b border-r border-gray-100 p-1.5 cursor-pointer transition relative ${
                      isSelected ? "bg-[#1D9E75]/5 ring-2 ring-[#1D9E75] ring-inset" : isDirty ? "bg-amber-50" : "hover:bg-gray-50"
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

                    {/* 메뉴 이름 목록 — 배송일이 아니어도 배정이 남아 있으면 흐리게 보여준다 */}
                    {assignments.length > 0 && (
                      <div className={`mt-1 space-y-px ${isActive ? "" : "opacity-40"}`}>
                        {!isActive && (
                          <p className="text-[9px] text-amber-600 font-bold leading-tight">
                            배송일 아님 · {assignments.length}종
                          </p>
                        )}
                        {assignments.map((a) => (
                          <p
                            key={a.productId}
                            className="text-[10px] leading-tight truncate font-medium"
                            style={{ color: getCatColor(a.product.category) }}
                          >
                            {a.product.name}
                          </p>
                        ))}
                      </div>
                    )}

                    {isActive && entry?.substituteWeekday != null && (
                      <p className="text-[9px] text-[#EF9F27] font-bold mt-0.5">{WEEKDAYS[entry.substituteWeekday]}요일 대체</p>
                    )}
                    {isActive && entry?.substituteWeekday == null && !REGULAR_WEEKDAYS.includes(dayOfWeek) && (
                      <p className="text-[9px] text-red-500 font-bold mt-0.5">대체 요일 미지정</p>
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

                    {/* 휴일 대체 배송일 — 정규 요일(화·목)이 아닌 날을 켰으면 어느 요일 대신인지 정한다.
                        요일별 구독 구성("화요일은 샐러드 2")이 이 요일로 해석된다 */}
                    {(() => {
                      const realDow = new Date(selectedDate + "T00:00:00").getDay();
                      if (REGULAR_WEEKDAYS.includes(realDow) && selectedEntry.substituteWeekday == null) return null;
                      return (
                        <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                          <p className="text-xs font-bold text-amber-800">휴일 대체 배송일</p>
                          <p className="text-[11px] text-amber-700 mt-0.5 mb-2">
                            {WEEKDAYS[realDow]}요일에 나가지만 고객 구독은 어느 요일 구성으로 볼까요?
                            {selectedEntry.substituteWeekday == null && " 지정하지 않으면 기본 구성이 적용됩니다."}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {REGULAR_WEEKDAYS.map((dow) => (
                              <button
                                key={dow}
                                type="button"
                                onClick={() => setSubstituteWeekday(selectedDate, dow)}
                                className={`px-3 py-1 rounded-full text-xs font-bold border transition ${
                                  selectedEntry.substituteWeekday === dow
                                    ? "bg-[#EF9F27] border-[#EF9F27] text-white"
                                    : "bg-white border-amber-300 text-amber-800 hover:bg-amber-100"
                                }`}
                              >
                                {WEEKDAYS[dow]}요일 대신
                              </button>
                            ))}
                            {selectedEntry.substituteWeekday != null && (
                              <button type="button" onClick={() => setSubstituteWeekday(selectedDate, null)}
                                className="px-3 py-1 rounded-full text-xs text-gray-500 hover:text-gray-700 underline">
                                해제
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* 배정된 메뉴 */}
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-bold text-gray-500">배정된 메뉴 ({selectedAssignments.length}종)</p>
                      {selectedAssignments.length === 0 ? (
                        <p className="text-xs text-gray-300 italic">메뉴를 추가하세요</p>
                      ) : (
                        selectedAssignments.map((a) => (
                          <div
                            key={a.productId}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                            style={getCatBgStyle(a.product.category)}
                          >
                            <div className="flex-1 min-w-0">
                              <span
                                className="text-[9px] font-bold"
                                style={{ color: getCatColor(a.product.category) }}
                              >
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
                        onClick={openPicker}
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

            {/* 일괄 저장 버튼 (항상 표시) */}
            <button
              onClick={saveAllAssignments}
              disabled={saving || !hasDirty}
              className={`mt-4 w-full py-3 rounded-xl text-sm font-bold transition ${
                hasDirty
                  ? "bg-[#1D9E75] text-white hover:bg-[#178a65]"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              } disabled:opacity-50`}
            >
              {saving ? "저장 중..." : hasDirty ? `메뉴 배정 저장 (${dirtyDates.size}일)` : "변경사항 없음"}
            </button>
          </div>
        </div>
      </div>

      {/* 메뉴 선택 모달 (드래그 이동 가능 · 다중 선택) */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setPickerOpen(false)}>
          <div
            ref={modalRef}
            className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-gray-200"
            style={{ transform: `translate(${modalPos.x}px, ${modalPos.y}px)` }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 (드래그 핸들) */}
            <div
              className="px-5 py-3 border-b border-gray-200 flex items-center justify-between cursor-grab active:cursor-grabbing select-none bg-gray-50 rounded-t-2xl shrink-0"
              onMouseDown={onDragStart}
            >
              <div>
                <h3 className="font-bold text-gray-900 text-sm">메뉴 선택</h3>
                {selectedDate && (
                  <p className="text-xs text-[#1D9E75] font-medium">
                    {new Date(selectedDate + "T00:00:00").toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}
                  </p>
                )}
              </div>
              <button onClick={() => setPickerOpen(false)} className="text-gray-400 hover:text-gray-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* 검색 + 카테고리 필터 */}
            <div className="px-5 py-3 border-b border-gray-100 space-y-2.5 shrink-0">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-lg">search</span>
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="메뉴 이름 검색"
                  className="w-full pl-10 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]/40 transition"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setActiveCatId("all")}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                    activeCatId === "all"
                      ? "bg-gray-800 text-white border-gray-800"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  전체 <span className="opacity-60">{totalProductCount}</span>
                </button>
                {productsByCategory.map(({ category, items }) => {
                  const active = activeCatId === category.id;
                  return (
                    <button
                      key={category.id}
                      onClick={() => setActiveCatId(category.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition flex items-center gap-1 ${
                        active ? "text-white" : "bg-white hover:border-gray-300"
                      }`}
                      style={
                        active
                          ? { backgroundColor: getCatColor(category), borderColor: getCatColor(category) }
                          : { color: getCatColor(category), borderColor: `${getCatColor(category)}40` }
                      }
                    >
                      {category.icon && (
                        <span className="material-symbols-outlined text-sm">{category.icon}</span>
                      )}
                      {category.name} <span className="opacity-60">{items.length}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 상품 그리드 */}
            <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
              {visibleGroups.length === 0 ? (
                <p className="text-center text-gray-400 py-12 text-sm">
                  {totalProductCount === 0 ? "등록된 상품이 없습니다" : "검색 결과가 없습니다"}
                </p>
              ) : (
                visibleGroups.map(({ category, items }) => (
                  <div key={category.id} className="mb-5 last:mb-0">
                    <p
                      className="text-xs font-bold mb-2 px-0.5 flex items-center gap-1.5"
                      style={{ color: getCatColor(category) }}
                    >
                      {category.icon && (
                        <span className="material-symbols-outlined text-sm">{category.icon}</span>
                      )}
                      {category.name}
                      <span className="text-gray-400 font-medium">({items.length})</span>
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {items.map((p) => {
                        const checked = selectedIds.has(p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() => toggleSelect(p.id)}
                            className={`relative flex items-center gap-2.5 p-2 pr-7 rounded-xl border-2 text-left transition ${
                              checked
                                ? "border-[#1D9E75] bg-[#1D9E75]/5"
                                : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            <span
                              className={`absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center transition ${
                                checked ? "bg-[#1D9E75] text-white" : "bg-gray-200 text-transparent"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[12px] leading-none">check</span>
                            </span>
                            <ProductThumb product={p} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                              <p className="text-xs text-gray-400">{p.price.toLocaleString()}원</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 하단 액션 바 */}
            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3 shrink-0">
              <p className="text-sm text-gray-500">
                <span className="font-bold text-[#1D9E75]">{selectedIds.size}개</span> 선택됨
                <span className="text-xs text-gray-400 ml-2">체크를 해제하면 배정에서 제거됩니다</span>
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setSelectedIds(new Set())}
                  disabled={selectedIds.size === 0}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-200 transition disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  전체 해제
                </button>
                <button
                  onClick={applySelection}
                  className="px-5 py-2 rounded-lg text-sm font-bold bg-[#1D9E75] text-white hover:bg-[#178a65] transition"
                >
                  적용
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
