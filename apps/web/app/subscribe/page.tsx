"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { firstOrderableDate } from "../lib/cutoff";
import DeliveryAddressPicker, { type AddressSelection } from "../components/address/DeliveryAddressPicker";

type Product = {
  id: string;
  name: string;
  description: string | null;
  originalPrice: number | null;
  price: number;
  kcal: number | null;
  tags: string | null;
  imageUrl: string | null;
  category: { name: string; slug: string; isOption?: boolean };
};

type Cat = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isOption: boolean;
};

type CalendarDay = {
  id: string;
  date: string;
  isActive: boolean;
  menuAssignments: { productId: string; sortOrder: number; product: Product }[];
};

type Selection = { [dateStr: string]: string[] }; // date → productId[]
type SlotMap = Record<string, number>;

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const CYCLE_WEEK_OPTIONS = [2, 4, 6, 8] as const;
const DAY_MS = 86400000;

/** YYYY-MM-DD + n일 (UTC 기준, 시간대 영향 없음) */
function addDays(dateStr: string, n: number): string {
  return new Date(new Date(dateStr + "T00:00:00Z").getTime() + n * DAY_MS).toISOString().slice(0, 10);
}
function dowOf(dateStr: string): number {
  return new Date(dateStr + "T00:00:00Z").getUTCDay();
}
function fmtMD(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

export default function SubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-b from-[#f7fdf9] to-[#edf7f0] flex items-center justify-center"><p className="text-[#7aaa90]">로딩 중...</p></div>}>
      <SubscribeContent />
    </Suspense>
  );
}

function SubscribeContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const paramPlan = searchParams.get("plan");
  const paramMode = searchParams.get("mode"); // 새 포맷: mode=auto|manual

  // 초기 모드: mode 파라미터(신규) > plan 파라미터(레거시) > 기본 auto
  const initialMode: "manual" | "auto" | "trial" =
    paramMode === "manual" ? "manual" :
    paramMode === "auto" ? "auto" :
    paramPlan === "trial" ? "trial" :
    paramPlan === "auto" ? "auto" :
    paramPlan === "manual" ? "manual" :
    "auto";
  const [mode, setMode] = useState<"manual" | "auto" | "trial">(initialMode);

  // 배송당 기본 수량 — 카테고리 slug → 개수. 날짜별로 바꾸면 dateSlots 에 덮어쓴다
  const [categories, setCategories] = useState<Cat[]>([]);
  const [slotCounts, setSlotCounts] = useState<SlotMap>({ salad: 2 });
  const [dateSlots, setDateSlots] = useState<Record<string, SlotMap>>({});
  const itemsPerDelivery = useMemo(
    () => Object.values(slotCounts).reduce((sum, n) => sum + n, 0),
    [slotCounts],
  );
  const setSlot = (slug: string, value: number) =>
    setSlotCounts((prev) => ({ ...prev, [slug]: Math.max(0, value) }));

  // 회당 권장 상한(설정값)은 막지 않고 한 번 확인만 받는다 — 많이 시키는 걸 굳이 줄일 이유가 없다
  const [overLimitOk, setOverLimitOk] = useState(false);
  const confirmOverLimit = (nextTotal: number, max: number): boolean => {
    if (nextTotal <= max || overLimitOk) return true;
    const ok = window.confirm(`회당 ${max}개를 초과합니다.
${max}개 이상 주문하시겠습니까?`);
    if (ok) setOverLimitOk(true);
    return ok;
  };

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data: Cat[]) => {
        if (!Array.isArray(data)) return;
        setCategories(data);
        setSlotCounts((prev) => {
          const next: SlotMap = {};
          for (const c of data) next[c.slug] = prev[c.slug] ?? 0;
          return next;
        });
      })
      .catch(() => {});
  }, []);
  const [config, setConfig] = useState({ minItems: 1, maxItems: 10 });

  const [termsAgreed, setTermsAgreed] = useState(false);

  // 청구 주기(주)와 자동 갱신 — "8회"가 아니라 "4주"로 고른다. 배송은 화·목이라 4주 = 8회
  const [cycleWeeks, setCycleWeeks] = useState<number>(4);
  const [autoRenew, setAutoRenew] = useState(true);

  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [selection, setSelection] = useState<Selection>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [minOrderAmount, setMinOrderAmount] = useState(11000);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((data) => {
        const v = Number(data?.minOrderAmount);
        if (!isNaN(v) && v > 0) setMinOrderAmount(v);
      })
      .catch(() => {});
  }, []);

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;

  useEffect(() => {
    fetch("/api/subscribe/settings")
      .then((r) => r.json())
      .then((data) => {
        setConfig({
          minItems: parseInt(data["subscribe.minItems"] || "1"),
          maxItems: parseInt(data["subscribe.maxItems"] || "10"),
        });
      })
      .catch(() => {});
    // 8주 + 마감 밀림까지 넉넉히 4개월
    fetch(`/api/delivery-calendar?year=${curYear}&month=${curMonth}&months=4`)
      .then((r) => r.json())
      .then((data) => setCalendar(Array.isArray(data) ? data : []))
      .catch(() => setCalendar([]));
  }, [curYear, curMonth]);

  // 마감 기준: 배송 전날 14:00 — 그 시각을 넘기면 다음날 배송분은 닫힌다
  const cutoffDate = useMemo(() => firstOrderableDate(), []);
  // 주기 창: 첫 주문 가능일부터 N주
  const windowEnd = useMemo(() => addDays(cutoffDate, cycleWeeks * 7), [cutoffDate, cycleWeeks]);

  const allActiveDates = useMemo(
    () =>
      calendar
        .filter((d) => d.isActive)
        .map((d) => ({ ...d, dateStr: new Date(d.date).toISOString().split("T")[0]! }))
        .sort((a, b) => a.dateStr.localeCompare(b.dateStr)),
    [calendar],
  );

  // 이 주기의 배송일 (맛보기는 첫 회만)
  const deliveryDates = useMemo(() => {
    const inWindow = allActiveDates.filter((d) => d.dateStr >= cutoffDate && d.dateStr < windowEnd);
    return mode === "trial" ? inWindow.slice(0, 1) : inWindow;
  }, [allActiveDates, cutoffDate, windowEnd, mode]);

  const [skippedDates, setSkippedDates] = useState<Set<string>>(new Set());
  const toggleSkip = (dateStr: string) => {
    setSkippedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else {
        next.add(dateStr);
        setSelection((s) => ({ ...s, [dateStr]: [] }));
      }
      return next;
    });
    setSelectedDate(null);
  };

  const MIN_DELIVERIES = 2;
  const activeDates = deliveryDates.filter((d) => !skippedDates.has(d.dateStr));
  const deliveryDateSet = useMemo(() => new Set(activeDates.map((d) => d.dateStr)), [activeDates]);
  const windowDateSet = useMemo(() => new Set(deliveryDates.map((d) => d.dateStr)), [deliveryDates]);
  const allDeliveryDateSet = useMemo(() => new Set(allActiveDates.map((d) => d.dateStr)), [allActiveDates]);

  // 날짜별 수량 (기본 구성 또는 그 날짜만 바꾼 값)
  const slotsFor = (dateStr: string): SlotMap => dateSlots[dateStr] ?? slotCounts;
  const itemsFor = (dateStr: string): number => Object.values(slotsFor(dateStr)).reduce((s, n) => s + n, 0);
  const setDateSlot = (dateStr: string, slug: string, value: number) =>
    setDateSlots((prev) => ({ ...prev, [dateStr]: { ...slotsFor(dateStr), [slug]: Math.max(0, value) } }));
  const resetDateSlots = (dateStr: string) =>
    setDateSlots((prev) => { const n = { ...prev }; delete n[dateStr]; return n; });

  // 압축 캘린더: 첫 주문 가능일이 속한 주(일요일)부터 주기 마지막 날이 속한 주까지 이어서 그린다
  const weekRows = useMemo(() => {
    const first = addDays(cutoffDate, -dowOf(cutoffDate));
    const lastDay = addDays(windowEnd, -1);
    const last = addDays(lastDay, 6 - dowOf(lastDay));
    const rows: string[][] = [];
    for (let d = first; d <= last; d = addDays(d, 7)) {
      rows.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
    }
    return rows;
  }, [cutoffDate, windowEnd]);

  const getMenuForDate = (dateStr: string) =>
    calendar.find((d) => new Date(d.date).toISOString().split("T")[0] === dateStr)?.menuAssignments || [];

  const getCategoryOfProduct = (dateStr: string, productId: string): string =>
    getMenuForDate(dateStr).find((m) => m.productId === productId)?.product.category.slug || "";

  const getSelectedByCategory = (dateStr: string): Record<string, number> => {
    const counts: Record<string, number> = {};
    for (const id of selection[dateStr] || []) {
      const slug = getCategoryOfProduct(dateStr, id);
      if (!slug) continue;
      counts[slug] = (counts[slug] ?? 0) + 1;
    }
    return counts;
  };

  const getItemCount = (dateStr: string, productId: string) =>
    (selection[dateStr] || []).filter((id) => id === productId).length;

  const toggleItem = (dateStr: string, productId: string) => {
    setSelection((prev) => {
      const current = prev[dateStr] || [];
      const currentItemCount = current.filter((id) => id === productId).length;
      const cat = getCategoryOfProduct(dateStr, productId);
      const counts = getSelectedByCategory(dateStr);
      const catLimit = slotsFor(dateStr)[cat] ?? 0;
      const catCount = counts[cat] ?? 0;
      if (catCount < catLimit && current.length < itemsFor(dateStr)) {
        return { ...prev, [dateStr]: [...current, productId] };
      }
      if (currentItemCount > 0) {
        return { ...prev, [dateStr]: current.filter((id) => id !== productId) };
      }
      return prev;
    });
  };

  const getSelectedCount = (dateStr: string) => (selection[dateStr] || []).length;
  const isItemSelected = (dateStr: string, productId: string) => (selection[dateStr] || []).includes(productId);

  const meetsMinimum = mode === "trial" || activeDates.length >= MIN_DELIVERIES;
  const completedCount = activeDates.filter((d) => getSelectedCount(d.dateStr) >= itemsFor(d.dateStr)).length;

  // AUTO: 그날 메뉴풀에서 카테고리별 슬롯만큼, 모자라면 다른 본품으로 보정
  const getAutoSelectedProductIds = (dateStr: string): string[] => {
    const menus = getMenuForDate(dateStr);
    const slots = slotsFor(dateStr);
    const result: string[] = [];
    const used = new Set<string>();
    for (const [slug, count] of Object.entries(slots)) {
      if (count <= 0) continue;
      for (const m of menus.filter((m) => m.product.category?.slug === slug).slice(0, count)) {
        result.push(m.productId);
        used.add(m.productId);
      }
    }
    const remaining = itemsFor(dateStr) - result.length;
    if (remaining > 0) {
      for (const m of menus.filter((m) => !used.has(m.productId) && !m.product.category?.isOption).slice(0, remaining)) {
        result.push(m.productId);
        used.add(m.productId);
      }
    }
    return result;
  };

  const getDatePicks = (dateStr: string): string[] =>
    mode === "auto" ? getAutoSelectedProductIds(dateStr) : selection[dateStr] || [];

  const getDateBaseTotal = (dateStr: string): number => {
    const menus = getMenuForDate(dateStr);
    return getDatePicks(dateStr).reduce((sum, pid) => {
      const m = menus.find((x) => x.productId === pid);
      if (!m || m.product.category?.isOption) return sum;
      return sum + m.product.price;
    }, 0);
  };
  const getDateTotal = (dateStr: string): number => {
    const menus = getMenuForDate(dateStr);
    return getDatePicks(dateStr).reduce((sum, pid) => {
      const m = menus.find((x) => x.productId === pid);
      if (!m) return sum;
      return sum + (mode === "trial" ? (m.product.originalPrice || m.product.price) : m.product.price);
    }, 0);
  };

  const insufficientDates = mode === "trial" ? [] : activeDates.filter((d) => getDateBaseTotal(d.dateStr) < minOrderAmount);
  const allMeetMinAmount = insufficientDates.length === 0;

  const [addressSel, setAddressSel] = useState<AddressSelection | null>(null);

  const allReady = termsAgreed && meetsMinimum && allMeetMinAmount && addressSel !== null && (mode === "auto" || (activeDates.length > 0 && completedCount === activeDates.length));

  const totalPrice = activeDates.reduce((s, d) => s + getDateTotal(d.dateStr), 0);

  // 결제
  const handlePayment = async () => {
    setPaying(true);
    try {
      const selections = activeDates
        .map((d) => ({ date: d.dateStr, productIds: getDatePicks(d.dateStr) }))
        .filter((s) => s.productIds.length > 0);

      const isSub = mode !== "trial";
      const orderRes = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: isSub ? "subscription" : "trial",
          selectionMode: mode === "auto" ? "AUTO" : "MANUAL",
          itemsPerDelivery,
          slots: slotCounts,
          cycleWeeks,
          autoRenew: isSub && autoRenew,
          selections,
          ...(addressSel ?? {}),
        }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json();
        alert(err.message || err.error || "주문 생성에 실패했습니다.");
        setPaying(false);
        return;
      }

      const order = await orderRes.json();
      const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!TOSS_CLIENT_KEY) { alert("결제 키가 설정되지 않았습니다."); setPaying(false); return; }

      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      const userId = (session?.user as { id?: string })?.id ?? `GUEST_${Date.now()}`;
      const orderName = mode === "trial"
        ? "W2O 맛보기"
        : `W2O ${cycleWeeks}주 구독${mode === "auto" ? " (잘 챙겨서 보내줘)" : " (직접 골라먹기)"}`;
      const payment = tossPayments.payment({ customerKey: userId });

      if (isSub && autoRenew) {
        // 자동 갱신: 카드 등록(빌링키) → 첫 결제. 이후 주기마다 실제 배송 수량으로 자동 결제
        await payment.requestBillingAuth({
          method: "CARD",
          successUrl: `${window.location.origin}/checkout/success?orderId=${order.orderId}&billing=true&amount=${order.totalAmount}&orderNo=${order.orderNo}`,
          failUrl: `${window.location.origin}/checkout/fail?orderId=${order.orderId}`,
        });
      } else {
        // 맛보기 또는 "이번 주기만": 일반 결제 1회, 카드 등록 없음
        await payment.requestPayment({
          method: "CARD",
          amount: { value: order.totalAmount, currency: "KRW" },
          orderId: order.orderNo,
          orderName,
          customerName: session?.user?.name || "고객",
          successUrl: `${window.location.origin}/checkout/success?orderId=${order.orderId}`,
          failUrl: `${window.location.origin}/checkout/fail?orderId=${order.orderId}`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "결제 중 오류가 발생했습니다.";
      if (!msg.includes("취소")) alert(msg);
      setPaying(false);
    }
  };

  const firstMonth = deliveryDates[0] ? Number(deliveryDates[0].dateStr.slice(5, 7)) : curMonth;
  const lastMonth = deliveryDates.length ? Number(deliveryDates[deliveryDates.length - 1]!.dateStr.slice(5, 7)) : curMonth;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f7fdf9] to-[#edf7f0]">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#1D9E75]/10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5">
            <span className="text-lg font-black text-brand-green">W2O</span>
            <span className="text-xs text-gray-400 tracking-widest">SALADA</span>
          </Link>
          <Link href="/" className="text-[#7aaa90] text-sm hover:text-[#1D9E75] transition-colors">홈으로</Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 왼쪽: 수량 + 캘린더 + 메뉴 */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-[#0A1A0F]">
                  {mode === "auto" ? "내 배송 캘린더" : mode === "trial" ? "맛보기 메뉴 선택" : "수량 · 메뉴 선택"}
                </h1>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {mode === "auto" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#EF9F27]/10 text-[#EF9F27] text-[11px] font-bold rounded-full border border-[#EF9F27]/20">
                      <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
                      알아서 정기구독
                    </span>
                  )}
                  <span className="text-[#4a7a5e] text-sm">
                    {firstMonth === lastMonth ? `${firstMonth}월` : `${firstMonth}월~${lastMonth}월`} · 화·목 배송{" "}
                    <span className="font-bold text-[#0A1A0F]">{activeDates.length}회</span>
                    {skippedDates.size > 0 && <span className="text-gray-400"> ({skippedDates.size}회 건너뜀)</span>}
                  </span>
                </div>
              </div>
              <Link href="/#subscribe" className="text-sm text-[#7aaa90] hover:text-[#1D9E75] transition">
                ← 유형 변경
              </Link>
            </div>

            {/* 기본 수량 카드 */}
            {(() => {
              const cats = categories.map((c) => ({
                key: c.slug, label: c.name, icon: c.icon || "restaurant", color: c.color || "#1D9E75",
                value: slotCounts[c.slug] ?? 0, set: (v: number) => setSlot(c.slug, v),
              }));
              const totalReached = itemsPerDelivery >= config.maxItems;
              return (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
                    {cats.map((c) => (
                      <div key={c.key} className="bg-white rounded-xl px-3 py-3 border-2 transition" style={{ borderColor: `${c.color}25` }}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="material-symbols-outlined text-base" style={{ color: c.color }}>{c.icon}</span>
                          <span className="text-xs font-bold" style={{ color: c.color }}>{c.label}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <button type="button" onClick={() => c.set(c.value - 1)} disabled={c.value <= 0}
                            className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold disabled:opacity-25 disabled:cursor-not-allowed transition"
                            style={{ borderColor: `${c.color}50`, color: c.color }} aria-label={`${c.label} 감소`}>−</button>
                          <span className="text-2xl font-black text-[#0A1A0F] min-w-[1.5ch] text-center">{c.value}</span>
                          <button type="button" onClick={() => { if (confirmOverLimit(itemsPerDelivery + 1, config.maxItems)) c.set(c.value + 1); }}
                            title={totalReached ? `회당 권장 ${config.maxItems}개를 넘습니다 (확인 후 추가 가능)` : undefined}
                            className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold transition"
                            style={{ borderColor: `${c.color}50`, color: c.color }} aria-label={`${c.label} 증가`}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 합계 + 기간 선택 */}
                  <div className="flex flex-wrap items-center gap-3 mb-4 bg-white rounded-2xl border border-[#1D9E75]/10 px-5 py-3">
                    <span className="text-base font-bold text-[#0A1A0F]">
                      총 <span className="text-xl">{itemsPerDelivery}</span>개 / 회
                      {itemsPerDelivery > config.maxItems && <span className="ml-2 text-xs font-medium text-[#EF9F27]">회당 {config.maxItems}개 초과</span>}
                      {Object.keys(dateSlots).length > 0 && <span className="ml-2 text-[11px] font-medium text-[#7aaa90]">날짜별 변경 {Object.keys(dateSlots).length}건</span>}
                    </span>

                    {mode !== "trial" && (
                      <div className="ml-auto flex items-center gap-1.5">
                        <span className="text-xs text-[#7aaa90] mr-1">기간</span>
                        {CYCLE_WEEK_OPTIONS.map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => { setCycleWeeks(w); setSelectedDate(null); }}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition ${
                              cycleWeeks === w ? "bg-[#1D9E75] border-[#1D9E75] text-white" : "bg-white border-[#1D9E75]/20 text-[#1D9E75] hover:border-[#1D9E75]/60"
                            }`}
                          >
                            {w}주
                          </button>
                        ))}
                        {mode === "auto" ? (
                          <button type="button" onClick={() => { setMode("manual"); setTermsAgreed(false); }} className="ml-2 text-[10px] text-gray-400 hover:text-gray-600 underline">직접 선택</button>
                        ) : (
                          <button type="button" onClick={() => { setMode("auto"); setSelection({}); setSelectedDate(null); }}
                            className="ml-2 flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-[#EF9F27] to-[#f0b54a] text-white rounded-full text-[11px] font-bold hover:scale-105 transition-all">
                            <span className="material-symbols-outlined text-sm">auto_awesome</span>알아서 추천
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}

            {!meetsMinimum && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                <span className="material-symbols-outlined text-red-500 text-lg shrink-0 mt-0.5">error</span>
                <p className="text-red-700 text-sm font-semibold">배송 {activeDates.length}회 — 최소 {MIN_DELIVERIES}회 이상이어야 합니다. 건너뛰기를 줄이거나 기간을 늘려주세요.</p>
              </div>
            )}

            {/* 압축 캘린더 — 주기 전체를 한 화면에. 월이 바뀌는 칸에 월 표시 */}
            <div className="bg-white rounded-2xl border border-[#1D9E75]/10 overflow-hidden mb-4">
              <div className="grid bg-gray-50 border-b border-gray-100" style={{ gridTemplateColumns: "0.7fr 0.7fr 2fr 1fr 2fr 1fr 0.7fr" }}>
                {WEEKDAYS.map((d, i) => (
                  <div key={d} className={`text-center py-1 text-[10px] font-semibold ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400"}`}>{d}</div>
                ))}
              </div>
              {weekRows.map((row, ri) => {
                const firstOfMonthIdx = row.findIndex((d) => d.slice(8, 10) === "01");
                const bandMonth = ri === 0 ? Number(row[0]!.slice(5, 7)) : firstOfMonthIdx >= 0 ? Number(row[firstOfMonthIdx]!.slice(5, 7)) : null;
                const bandStartsMid = ri !== 0 && firstOfMonthIdx > 0;
                return (
                <div key={ri}>
                {bandMonth !== null && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1D9E75]/10 border-y border-[#1D9E75]/15">
                    <span className="text-base font-black text-[#1D9E75] tracking-tight">{bandMonth}월</span>
                    {bandStartsMid && <span className="text-[11px] text-[#1D9E75]/70">{fmtMD(row[firstOfMonthIdx]!)}부터</span>}
                  </div>
                )}
                <div className="grid" style={{ gridTemplateColumns: "0.7fr 0.7fr 2fr 1fr 2fr 1fr 0.7fr" }}>
                  {row.map((dateStr, ci) => {
                    const day = Number(dateStr.slice(8, 10));
                    const month = Number(dateStr.slice(5, 7));
                    const showMonth = day === 1;
                    const isAnyDelivery = allDeliveryDateSet.has(dateStr);
                    const inWindow = windowDateSet.has(dateStr);
                    const isClosed = isAnyDelivery && dateStr < cutoffDate;
                    const isSkipped = skippedDates.has(dateStr);
                    const isActive = deliveryDateSet.has(dateStr);
                    const isSelected = selectedDate === dateStr;
                    const picks = isActive ? getDatePicks(dateStr).length : 0;
                    const need = itemsFor(dateStr);
                    const done = picks >= need && need > 0;
                    const narrow = ci === 0 || ci === 1 || ci === 6;
                    const clickable = inWindow && !isClosed;
                    const beyond = isAnyDelivery && !inWindow && dateStr >= cutoffDate;

                    return (
                      <div
                        key={dateStr}
                        onClick={() => {
                          if (!clickable) return;
                          if (isSkipped) { toggleSkip(dateStr); return; }
                          setSelectedDate(isSelected ? null : dateStr);
                        }}
                        className={`min-h-[3rem] border-b border-r border-gray-50 px-0.5 py-1 text-center transition ${
                          isClosed ? "bg-gray-50 cursor-not-allowed"
                            : isSkipped ? "bg-gray-50/80 cursor-pointer"
                            : isSelected ? "bg-[#1D9E75]/10 ring-2 ring-[#1D9E75] ring-inset cursor-pointer"
                            : isActive && !done && mode !== "auto" ? "bg-amber-50/60 cursor-pointer"
                            : isActive ? "hover:bg-[#f0faf4] cursor-pointer"
                            : beyond ? "bg-gray-50/40"
                            : ""
                        }`}
                        title={beyond ? "기간을 늘리면 포함됩니다" : undefined}
                      >
                        <div className="flex items-center justify-center leading-none">
                          <span className={`${showMonth ? "text-[12px] font-black text-[#1D9E75]" : `text-[12px] ${ci === 0 ? "text-red-400" : ci === 6 ? "text-blue-400" : "text-gray-600"}`} ${!isAnyDelivery ? "opacity-20" : isClosed || beyond ? "opacity-40" : "font-bold"}`}>
                            {showMonth ? `${month}/${day}` : day}
                          </span>
                        </div>
                        {isClosed && <div className="text-[8px] text-gray-400">마감</div>}
                        {isSkipped && !isClosed && <div className="text-[8px] text-gray-400 line-through">건너뜀</div>}
                        {isActive && !isClosed && !narrow && (
                          <div className="flex items-center justify-center mt-1">
                            {mode === "auto" || done ? (
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-white text-[13px] font-black leading-none ${dateSlots[dateStr] ? "bg-[#EF9F27]" : mode === "auto" ? "bg-[#EF9F27]" : "bg-[#1D9E75]"}`}>
                                <span className="material-symbols-outlined text-[11px]">check</span>{need}개
                              </span>
                            ) : picks > 0 ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 text-[12px] font-black leading-none">{picks}/{need}</span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[12px] font-black leading-none">
                                <span className="material-symbols-outlined text-[11px]">warning</span>{need}개
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                </div>
                );
              })}
              <p className="text-[11px] text-[#7aaa90] px-3 py-1.5 border-t border-gray-50">
숫자는 그 날 받을 개수입니다. 날짜를 누르면 그 날만 수량을 바꾸거나 건너뛸 수 있고, 주황색은 기본 구성과 다르게 바꾼 날입니다.
              </p>
            </div>

            {/* 진행 바 (직접 선택) */}
            {mode === "manual" && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[#4a7a5e]">메뉴 선택 진행</span>
                  <span className="text-sm font-semibold text-[#1D9E75]">{completedCount}/{activeDates.length}회 완료</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#1D9E75] to-[#5DCAA5] rounded-full transition-all duration-500"
                    style={{ width: `${activeDates.length > 0 ? (completedCount / activeDates.length) * 100 : 0}%` }} />
                </div>
              </div>
            )}

            {/* 날짜 편집 패널 */}
            {selectedDate && deliveryDateSet.has(selectedDate) ? (
              <div className="bg-white rounded-2xl border border-[#1D9E75]/20 p-4 mb-4">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h3 className="font-bold text-[#0A1A0F]">
                    {new Date(selectedDate + "T00:00:00").toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}
                    <span className="ml-2 text-sm font-medium text-[#7aaa90]">{itemsFor(selectedDate)}개 · {getDateTotal(selectedDate).toLocaleString()}원</span>
                  </h3>
                  <div className="flex items-center gap-3">
                    {dateSlots[selectedDate] && (
                      <button type="button" onClick={() => resetDateSlots(selectedDate)} className="text-xs text-[#7aaa90] hover:text-[#1D9E75] underline">기본 구성으로</button>
                    )}
                    {mode !== "trial" && (
                      <button type="button" onClick={() => toggleSkip(selectedDate)} className="text-xs text-gray-400 hover:text-red-500 transition">이 날 건너뛰기</button>
                    )}
                    <button type="button" onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600" aria-label="닫기">
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  </div>
                </div>

                {/* 이 날만 수량 바꾸기 */}
                {mode !== "trial" && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {categories.map((c) => {
                      const v = slotsFor(selectedDate)[c.slug] ?? 0;
                      return (
                        <div key={c.slug} className="flex items-center gap-1.5 bg-[#f7fdf9] rounded-full pl-3 pr-1 py-1 border" style={{ borderColor: `${c.color || "#1D9E75"}30` }}>
                          <span className="text-xs font-bold" style={{ color: c.color || "#1D9E75" }}>{c.name}</span>
                          <button type="button" onClick={() => setDateSlot(selectedDate, c.slug, v - 1)} disabled={v <= 0}
                            className="w-6 h-6 rounded-full bg-white border flex items-center justify-center text-sm font-bold disabled:opacity-25" aria-label={`${c.name} 감소`}>−</button>
                          <span className="text-sm font-black min-w-[1.2ch] text-center">{v}</span>
                          <button type="button" onClick={() => { if (confirmOverLimit(itemsFor(selectedDate) + 1, config.maxItems)) setDateSlot(selectedDate, c.slug, v + 1); }}
                            className="w-6 h-6 rounded-full bg-white border flex items-center justify-center text-sm font-bold" aria-label={`${c.name} 증가`}>+</button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {mode === "auto" ? (
                  <div className="space-y-1">
                    {(() => {
                      const menus = getMenuForDate(selectedDate);
                      const picked = getAutoSelectedProductIds(selectedDate).map((pid) => menus.find((m) => m.productId === pid)).filter((m): m is NonNullable<typeof m> => !!m);
                      return picked.length > 0 ? picked.map((m, i) => (
                        <p key={`${m.productId}-${i}`} className="text-sm text-[#0A1A0F] flex items-center gap-1.5">
                          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.product.category?.isOption ? "#EF9F27" : "#1D9E75" }} />
                          {m.product.name} <span className="text-xs text-gray-400">{m.product.price.toLocaleString()}원</span>
                        </p>
                      )) : <p className="text-xs text-gray-400">이 날짜에 배정된 메뉴가 없습니다</p>;
                    })()}
                    <p className="text-[11px] text-[#7aaa90] mt-2">메뉴는 그날 식단표에서 알아서 담깁니다. 직접 고르려면 위의 "직접 선택"을 누르세요.</p>
                  </div>
                ) : (
                  <>
                    {(() => { const c = getSelectedByCategory(selectedDate); return (
                      <div className="flex flex-wrap gap-3 mb-3 text-xs">
                        {categories.filter((cat) => (slotsFor(selectedDate)[cat.slug] ?? 0) > 0).map((cat) => (
                          <span key={cat.slug} className="font-medium" style={{ color: cat.color || "#1D9E75" }}>
                            {cat.name} {c[cat.slug] ?? 0}/{slotsFor(selectedDate)[cat.slug]}
                          </span>
                        ))}
                        <span className={`ml-auto font-medium ${getSelectedCount(selectedDate) >= itemsFor(selectedDate) ? "text-[#1D9E75]" : "text-[#EF9F27]"}`}>
                          {getSelectedCount(selectedDate)}/{itemsFor(selectedDate)} 선택
                        </span>
                      </div>
                    ); })()}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {getMenuForDate(selectedDate).map((m) => {
                        const selected = isItemSelected(selectedDate, m.productId);
                        const qty = getItemCount(selectedDate, m.productId);
                        const cat = m.product.category.slug;
                        const counts = getSelectedByCategory(selectedDate);
                        const catFull = (counts[cat] ?? 0) >= (slotsFor(selectedDate)[cat] ?? 0);
                        const full = (catFull && !selected) || (getSelectedCount(selectedDate) >= itemsFor(selectedDate) && !selected);
                        const p = m.product;
                        return (
                          <button key={m.productId} onClick={() => toggleItem(selectedDate, m.productId)} disabled={full}
                            className={`text-left rounded-2xl border-2 overflow-hidden transition-all ${
                              selected ? "border-[#1D9E75] shadow-lg scale-[1.01]" : full ? "border-gray-200 opacity-40 cursor-not-allowed" : "border-gray-200 hover:border-[#1D9E75]/40 hover:shadow-md"
                            }`}>
                            <div className="h-28 bg-gradient-to-br from-[#e8f5ee] to-[#d4edda] flex items-center justify-center relative overflow-hidden">
                              {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                                : <span className="material-symbols-outlined text-[#1D9E75]/25 text-4xl">lunch_dining</span>}
                              {selected && (
                                <div className="absolute top-2 right-2 w-7 h-7 bg-[#1D9E75] rounded-full flex items-center justify-center shadow">
                                  {qty >= 2 ? <span className="text-white text-xs font-bold">×{qty}</span> : <span className="material-symbols-outlined text-white text-lg">check</span>}
                                </div>
                              )}
                              <span className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 text-[9px] font-semibold text-[#1D9E75] rounded-full">{p.category.name}</span>
                            </div>
                            <div className="p-3">
                              <h4 className="text-sm font-bold text-[#0A1A0F]">{p.name}</h4>
                              <div className="flex items-center gap-1.5 mt-1">
                                {p.originalPrice && p.originalPrice > p.price && <span className="text-gray-400 text-xs line-through">{p.originalPrice.toLocaleString()}원</span>}
                                <span className="text-[#1D9E75] text-sm font-bold">{(mode === "trial" ? (p.originalPrice || p.price) : p.price).toLocaleString()}원</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {getMenuForDate(selectedDate).length === 0 && (
                      <div className="text-center py-8 text-[#7aaa90]">
                        <span className="material-symbols-outlined text-3xl mb-2 block">restaurant_menu</span>
                        <p className="text-sm">이 날짜에 배정된 메뉴가 없습니다</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : null}

            {/* 배송 리스트 — 날짜 칩. 탭하면 위 패널이 열린다 */}
            <div className="space-y-1.5 mb-4">
              {activeDates.map((d) => {
                const menus = getMenuForDate(d.dateStr);
                const picked = getDatePicks(d.dateStr).map((pid) => menus.find((m) => m.productId === pid)).filter((m): m is NonNullable<typeof m> => !!m);
                const need = itemsFor(d.dateStr);
                const ok = picked.length >= need && need > 0;
                const dateObj = new Date(d.dateStr + "T00:00:00");
                return (
                  <button
                    key={d.dateStr}
                    type="button"
                    onClick={() => setSelectedDate(selectedDate === d.dateStr ? null : d.dateStr)}
                    className={`w-full flex items-center gap-3 bg-white rounded-xl border px-3 py-2 text-left transition ${
                      selectedDate === d.dateStr ? "border-[#1D9E75] ring-1 ring-[#1D9E75]" : ok ? "border-[#1D9E75]/10 hover:border-[#1D9E75]/40" : "border-amber-200 bg-amber-50/40"
                    }`}
                  >
                    <div className="shrink-0 text-center w-10">
                      <p className={`text-xs font-bold ${mode === "auto" ? "text-[#EF9F27]" : "text-[#1D9E75]"}`}>{fmtMD(d.dateStr)}</p>
                      <p className="text-[10px] text-gray-400">{dateObj.toLocaleDateString("ko-KR", { weekday: "short" })}</p>
                    </div>
                    <div className="flex-1 min-w-0 text-xs text-[#0A1A0F] truncate">
                      {picked.length > 0 ? picked.map((m) => m.product.name).join(" · ") : <span className="text-gray-400">{mode === "auto" ? "메뉴 미배정" : "메뉴를 선택하세요"}</span>}
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-sm font-black ${dateSlots[d.dateStr] ? "bg-[#EF9F27]/15 text-[#EF9F27]" : "bg-[#1D9E75]/10 text-[#1D9E75]"}`}>{need}개</span>
                    <span className="shrink-0 text-xs text-gray-500 w-14 text-right">{getDateTotal(d.dateStr).toLocaleString()}원</span>
                    <span className={`material-symbols-outlined text-lg ${ok ? (mode === "auto" ? "text-[#EF9F27]" : "text-[#1D9E75]") : "text-amber-400"}`}>{ok ? "check_circle" : "warning"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 오른쪽: 주문 요약 */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 bg-white rounded-2xl border border-[#1D9E75]/10 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-[#0A1A0F] mb-4">주문 요약</h2>

              <div className="flex items-center gap-2 mb-4 pb-4 border-b border-[#1D9E75]/10 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  mode === "auto" ? "bg-[#EF9F27]/10 text-[#EF9F27]" : mode === "trial" ? "bg-gray-100 text-gray-600" : "bg-[#1D9E75]/10 text-[#1D9E75]"
                }`}>
                  {mode === "manual" ? "직접 골라먹기" : mode === "auto" ? "잘 챙겨서 보내줘" : "맛보기"}
                </span>
                <span className="text-[#7aaa90] text-xs">
                  {categories.filter((c) => (slotCounts[c.slug] ?? 0) > 0).map((c) => `${c.name} ${slotCounts[c.slug]}`).join(" + ")}
                </span>
              </div>

              <div className="space-y-2 mb-4 text-sm">
                {mode !== "trial" && (
                  <div className="flex justify-between">
                    <span className="text-[#7aaa90]">기간</span>
                    <span className="text-[#0A1A0F] font-medium">{cycleWeeks}주 ({fmtMD(cutoffDate)} ~ {fmtMD(addDays(windowEnd, -1))})</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#7aaa90]">배송 횟수</span>
                  <span className="text-[#0A1A0F] font-medium">{activeDates.length}회{skippedDates.size > 0 ? ` (${skippedDates.size}회 건너뜀)` : ""}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#7aaa90]">회당 수량</span>
                  <span className="text-[#0A1A0F] font-medium">{itemsPerDelivery}개{Object.keys(dateSlots).length > 0 ? " (일부 날짜 변경)" : ""}</span>
                </div>
              </div>

              <div className="border-t border-[#1D9E75]/10 pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span className="text-[#0A1A0F]">{mode === "trial" ? "결제 금액" : `${cycleWeeks}주 결제 금액`}</span>
                  <span className={mode === "trial" ? "text-[#EF9F27]" : "text-[#1D9E75]"}>
                    {totalPrice > 0 ? `${totalPrice.toLocaleString()}원` : "-"}
                  </span>
                </div>
              </div>

              {/* 자동 갱신 — 주기가 끝나면 다음 주기를 실제 배송 수량으로 자동 결제 */}
              {mode !== "trial" && (
                <div className="mt-4 p-3 rounded-xl border border-[#1D9E75]/15 bg-[#f7fdf9]">
                  <label className="flex items-center justify-between cursor-pointer select-none">
                    <span>
                      <span className="text-sm font-bold text-[#0A1A0F]">{cycleWeeks}주마다 자동 결제</span>
                      <span className="block text-[11px] text-[#7aaa90] mt-0.5">
                        {autoRenew
                          ? `카드를 등록하고 ${cycleWeeks}주가 끝나기 이틀 전에 다음 ${cycleWeeks}주를 자동 결제합니다. 언제든 해지·일시정지할 수 있어요.`
                          : `이번 ${cycleWeeks}주만 결제합니다. 끝나면 자동으로 종료되고 카드는 저장하지 않아요.`}
                      </span>
                    </span>
                    <span
                      role="switch"
                      aria-checked={autoRenew}
                      onClick={() => setAutoRenew((v) => !v)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${autoRenew ? "bg-[#1D9E75]" : "bg-gray-300"}`}
                    >
                      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${autoRenew ? "translate-x-5" : "translate-x-0.5"}`} />
                    </span>
                  </label>
                  {autoRenew && (
                    <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                      다음 결제 금액은 그 기간의 실제 배송 횟수·수량으로 계산되며, 결제 7일 전 알림톡으로 예정 금액을 알려드립니다. 결제 후 건너뛴 배송분은 다음 결제에서 빼드립니다.
                    </p>
                  )}
                </div>
              )}

              {/* 배송지 */}
              <div className="mt-5 pt-4 border-t border-[#1D9E75]/10">
                <h3 className="text-sm font-bold text-[#0A1A0F] mb-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-base text-[#1D9E75]">location_on</span>
                  배송지
                </h3>
                <DeliveryAddressPicker loggedIn={!!session?.user} defaultName={session?.user?.name} theme="light" onChange={setAddressSel} />
              </div>

              {/* 약관 동의 */}
              <div className="mt-5">
                <label className="flex items-start gap-2.5 cursor-pointer group select-none py-1">
                  <input type="checkbox" checked={termsAgreed} onChange={(e) => setTermsAgreed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#1D9E75] focus:ring-[#1D9E75] cursor-pointer shrink-0" />
                  <span className="text-xs text-gray-600 leading-relaxed">
                    서비스 이용약관 및 결제에 동의합니다.
                    {mode !== "trial" && autoRenew && (
                      <span className="text-gray-400 block mt-0.5">정기결제 금액은 실제 배송 횟수·수량에 따라 달라질 수 있으며, 결제 전 알림으로 안내됩니다.</span>
                    )}
                  </span>
                </label>
                <a href="/terms/subscription" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 mt-2 ml-6 px-2.5 py-1 text-[11px] text-[#7aaa90] hover:text-[#1D9E75] hover:bg-[#1D9E75]/5 rounded-md transition">
                  <span className="material-symbols-outlined text-[13px]">description</span>
                  이용약관 전문 보기
                  <span className="material-symbols-outlined text-[11px]">open_in_new</span>
                </a>
              </div>

              <button
                disabled={!allReady || paying}
                onClick={handlePayment}
                className={`w-full mt-3 py-4 rounded-xl font-bold text-base transition ${
                  allReady && !paying
                    ? mode === "trial" ? "bg-[#EF9F27] text-white hover:bg-[#D48A1E] shadow-lg" : "bg-[#1D9E75] text-white hover:bg-[#167A5B] shadow-lg"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {paying ? "결제 처리 중..."
                  : !termsAgreed ? "약관에 동의해주세요"
                  : !meetsMinimum ? `최소 ${MIN_DELIVERIES}회 이상 필요 (현재 ${activeDates.length}회)`
                  : mode !== "auto" && completedCount < activeDates.length ? `메뉴를 선택해주세요 (${completedCount}/${activeDates.length})`
                  : !allMeetMinAmount ? `회당 ${minOrderAmount.toLocaleString()}원 미달 ${insufficientDates.length}회`
                  : addressSel === null ? "배송지를 입력해주세요"
                  : mode === "trial" ? "맛보기 결제하기"
                  : autoRenew ? `${totalPrice.toLocaleString()}원 결제하고 구독 시작` : `${totalPrice.toLocaleString()}원 결제 (이번 ${cycleWeeks}주만)`}
              </button>

              {!allMeetMinAmount && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-xs font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">error</span>
                    회당 본품 합계 {minOrderAmount.toLocaleString()}원 미달
                  </p>
                  <p className="text-red-600/80 text-[10px] mt-1 leading-relaxed">
                    {insufficientDates.map((d) => fmtMD(d.dateStr)).join(", ")} — 샐러드·간편식·반찬(본품)을 더 담거나 그 날을 건너뛰세요. 음료는 최소액에 포함되지 않습니다.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
