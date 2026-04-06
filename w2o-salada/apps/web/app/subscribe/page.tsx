"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

type Product = {
  id: string;
  name: string;
  description: string | null;
  originalPrice: number | null;
  price: number;
  kcal: number | null;
  tags: string | null;
  imageUrl: string | null;
  category: { name: string; slug: string };
};

type CalendarDay = {
  id: string;
  date: string;
  isActive: boolean;
  menuAssignments: { productId: string; sortOrder: number; product: Product }[];
};

type Selection = { [dateStr: string]: string[] }; // date → productId[]

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function SubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-b from-[#f7fdf9] to-[#edf7f0] flex items-center justify-center"><p className="text-[#7aaa90]">로딩 중...</p></div>}>
      <SubscribeContent />
    </Suspense>
  );
}

function SubscribeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  const paramPlan = searchParams.get("plan");

  // plan 파라미터가 있으면 Step 1 건너뛰고 바로 수량·메뉴 선택
  const hasValidPlan = paramPlan === "trial" || paramPlan === "auto" || paramPlan === "subscription" || paramPlan === "mixed" || paramPlan === "manual";
  const [step, setStep] = useState(hasValidPlan ? 3 : 1);

  // Step 1: 구독 유형
  const [mode, setMode] = useState<"manual" | "auto" | "trial">(
    paramPlan === "trial" ? "trial" : paramPlan === "auto" ? "auto" : "manual"
  );

  // Step 2: 배송당 수량 (샐러드 + 간편식)
  const [saladCount, setSaladCount] = useState(2);
  const [mealCount, setMealCount] = useState(0);
  const itemsPerDelivery = saladCount + mealCount;
  const [config, setConfig] = useState({ minItems: 2, maxItems: 10 });

  // 약관 동의
  const [termsAgreed, setTermsAgreed] = useState(false);

  // AUTO 모드 배송 횟수 (8~12회 조절 가능)
  const [autoCount, setAutoCount] = useState(8);

  // 캘린더 월 탭
  const [calTab, setCalTab] = useState(0);

  // Step 3: 캘린더 메뉴 선택
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [selection, setSelection] = useState<Selection>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const nextMonth = curMonth === 12 ? 1 : curMonth + 1;
  const nextYear = curMonth === 12 ? curYear + 1 : curYear;

  // 설정 + 캘린더 로드 (이번 달 + 다음 달)
  useEffect(() => {
    fetch("/api/subscribe/settings")
      .then((r) => r.json())
      .then((data) => {
        setConfig({
          minItems: parseInt(data["subscribe.minItems"] || "2"),
          maxItems: parseInt(data["subscribe.maxItems"] || "5"),
        });
      })
      .catch(() => {});

    Promise.all([
      fetch(`/api/delivery-calendar?year=${curYear}&month=${curMonth}`).then((r) => r.json()),
      fetch(`/api/delivery-calendar?year=${nextYear}&month=${nextMonth}`).then((r) => r.json()),
    ]).then(([cur, next]) => {
      const all = [
        ...(Array.isArray(cur) ? cur : []),
        ...(Array.isArray(next) ? next : []),
      ];
      setCalendar(all);
    }).catch(() => setCalendar([]));
  }, [curYear, curMonth, nextYear, nextMonth]);

  // 마감 기준: 배송일 -1일 (24시간 전 마감)
  const cutoffDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // 내일부터 주문 가능
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  // 배송일 목록 (마감 이후, 최대 12회까지)
  const MAX_DELIVERIES = 12;
  const deliveryDates = useMemo(() => {
    return calendar
      .filter((d) => d.isActive)
      .map((d) => {
        const dateStr = new Date(d.date).toISOString().split("T")[0]!;
        return { ...d, dateStr };
      })
      .filter((d) => d.dateStr >= cutoffDate)
      .slice(0, MAX_DELIVERIES);
  }, [calendar, cutoffDate]);

  // 건너뛰기 (사용자가 해제한 배송일)
  const [skippedDates, setSkippedDates] = useState<Set<string>>(new Set());

  const toggleSkip = (dateStr: string) => {
    setSkippedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else {
        next.add(dateStr);
        // 건너뛴 날짜의 선택 초기화
        setSelection((s) => ({ ...s, [dateStr]: [] }));
      }
      return next;
    });
  };

  // 최소 주문 조건: 구독/혼합은 8회 이상
  const MIN_DELIVERIES = 8;

  // 맛보기: 첫 배송일만, AUTO: 앞에서 autoCount개 중 건너뛴 것 제외, MANUAL: 건너뛰지 않은 배송일
  const activeDates = mode === "trial"
    ? deliveryDates.slice(0, 1)
    : mode === "auto"
    ? deliveryDates.slice(0, autoCount).filter((d) => !skippedDates.has(d.dateStr))
    : deliveryDates.filter((d) => !skippedDates.has(d.dateStr));

  // 달력 그리드 (2개월)
  const months = useMemo(() => {
    return [
      { year: curYear, month: curMonth },
      { year: nextYear, month: nextMonth },
    ].map(({ year, month }) => {
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      const startPad = firstDay.getDay();
      const totalDays = lastDay.getDate();
      const grid: (number | null)[] = [];
      for (let i = 0; i < startPad; i++) grid.push(null);
      for (let d = 1; d <= totalDays; d++) grid.push(d);
      while (grid.length % 7 !== 0) grid.push(null);
      return { year, month, grid };
    });
  }, [curYear, curMonth, nextYear, nextMonth]);

  // 12회 범위 내 배송일의 마지막 날짜
  const lastDeliveryDate = deliveryDates.length > 0 ? deliveryDates[deliveryDates.length - 1]!.dateStr : "";

  // 전체 배송일 세트 (마감 포함, 캘린더 표시용 — 12회 범위까지만)
  const allDeliveryDateSet = useMemo(() => {
    return new Set(
      calendar
        .filter((d) => d.isActive)
        .map((d) => new Date(d.date).toISOString().split("T")[0]!)
        .filter((dateStr) => !lastDeliveryDate || dateStr <= lastDeliveryDate)
    );
  }, [calendar, lastDeliveryDate]);

  // 주문 가능한 배송일 세트
  const deliveryDateSet = useMemo(() => {
    return new Set(activeDates.map((d) => d.dateStr));
  }, [activeDates]);

  const getDateStr = (year: number, month: number, day: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const getMenuForDate = (dateStr: string) => {
    return calendar.find((d) => new Date(d.date).toISOString().split("T")[0] === dateStr)?.menuAssignments || [];
  };

  // 메뉴 선택 (카테고리별 수량 제한)
  const getCategoryOfProduct = (dateStr: string, productId: string): string => {
    const menu = getMenuForDate(dateStr);
    return menu.find((m) => m.productId === productId)?.product.category.slug || "";
  };

  const getSelectedByCategory = (dateStr: string) => {
    const ids = selection[dateStr] || [];
    let salads = 0;
    let meals = 0;
    for (const id of ids) {
      if (getCategoryOfProduct(dateStr, id) === "salad") salads++;
      else meals++;
    }
    return { salads, meals };
  };

  const getItemCount = (dateStr: string, productId: string) =>
    (selection[dateStr] || []).filter((id) => id === productId).length;

  const toggleItem = (dateStr: string, productId: string) => {
    setSelection((prev) => {
      const current = prev[dateStr] || [];
      const currentItemCount = current.filter((id) => id === productId).length;
      const cat = getCategoryOfProduct(dateStr, productId);
      const counts = getSelectedByCategory(dateStr);
      const catLimit = cat === "salad" ? saladCount : mealCount;
      const catCount = cat === "salad" ? counts.salads : counts.meals;

      // 카테고리 여유가 있고 총 수량도 여유 있으면 → 1개 추가 (중복 허용)
      if (catCount < catLimit && current.length < itemsPerDelivery) {
        return { ...prev, [dateStr]: [...current, productId] };
      }

      // 여유 없으면 → 해당 상품 전부 제거
      if (currentItemCount > 0) {
        return { ...prev, [dateStr]: current.filter((id) => id !== productId) };
      }

      return prev;
    });
  };

  const getSelectedCount = (dateStr: string) => (selection[dateStr] || []).length;
  const isItemSelected = (dateStr: string, productId: string) => (selection[dateStr] || []).includes(productId);

  // 최소 주문 조건: 맛보기는 제한 없음
  const meetsMinimum = mode === "trial" || activeDates.length >= MIN_DELIVERIES;

  // 완료 체크
  const completedCount = activeDates.filter((d) => getSelectedCount(d.dateStr) >= itemsPerDelivery).length;
  const allReady = termsAgreed && meetsMinimum && (mode === "auto" || (activeDates.length > 0 && completedCount === activeDates.length));

  // 가격 계산
  const calculatePrice = () => {
    let total = 0;
    for (const d of activeDates) {
      const items = selection[d.dateStr] || [];
      for (const pid of items) {
        const product = d.menuAssignments.find((m) => m.productId === pid)?.product;
        if (product) {
          total += mode === "trial" ? (product.originalPrice || product.price) : product.price;
        }
      }
    }
    // AUTO 모드: 배정 메뉴 상위 N개로 계산
    if (mode === "auto") {
      total = 0;
      for (const d of activeDates) {
        const topItems = d.menuAssignments.slice(0, itemsPerDelivery);
        for (const m of topItems) {
          total += m.product.price;
        }
      }
    }
    return total;
  };

  const totalPrice = calculatePrice();

  // 결제
  const handlePayment = async () => {
    if (!session?.user) {
      router.push(`/login?redirect=/subscribe?plan=${mode}`);
      return;
    }
    setPaying(true);

    try {
      const selections = mode === "auto"
        ? activeDates.map((d) => ({
            date: d.dateStr,
            productIds: d.menuAssignments.slice(0, itemsPerDelivery).map((m) => m.productId),
          }))
        : activeDates.map((d) => ({
            date: d.dateStr,
            productIds: selection[d.dateStr] || [],
          })).filter((s) => s.productIds.length > 0);

      const orderRes = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: mode === "trial" ? "trial" : mode === "auto" ? "subscription" : "subscription",
          selectionMode: mode === "auto" ? "AUTO" : "MANUAL",
          itemsPerDelivery,
          selections,
        }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json();
        alert(err.error || "주문 생성에 실패했습니다.");
        setPaying(false);
        return;
      }

      const order = await orderRes.json();
      const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!TOSS_CLIENT_KEY) { alert("결제 키가 설정되지 않았습니다."); setPaying(false); return; }

      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      const userId = (session.user as { id?: string }).id ?? "guest";

      const orderName = mode === "trial"
        ? "W2O 맛보기"
        : mode === "auto"
        ? "W2O 구독 (잘 챙겨서 보내줘)"
        : "W2O 구독 (직접 골라먹기)";

      if (mode === "trial") {
        const payment = tossPayments.payment({ customerKey: userId });
        await payment.requestPayment({
          method: "CARD",
          amount: { value: order.totalAmount, currency: "KRW" },
          orderId: order.orderNo,
          orderName,
          customerName: session.user?.name || "고객",
          successUrl: `${window.location.origin}/checkout/success?orderId=${order.orderId}`,
          failUrl: `${window.location.origin}/checkout/fail?orderId=${order.orderId}`,
        });
      } else {
        const billing = tossPayments.billing({ customerKey: userId });
        await billing.requestBillingKeyAuth({
          method: "CARD",
          successUrl: `${window.location.origin}/checkout/success?orderId=${order.orderId}&billing=true&amount=${order.totalAmount}&orderNo=${order.orderNo}`,
          failUrl: `${window.location.origin}/checkout/fail?orderId=${order.orderId}`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "결제 중 오류가 발생했습니다.";
      if (!msg.includes("취소")) alert(msg);
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f7fdf9] to-[#edf7f0]">
      {/* 헤더 */}
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
        {/* 스텝 인디케이터 (2단계) */}
        <div className="flex items-center gap-2 mb-8">
          {["구독 유형", mode === "auto" ? "확인 및 결제" : "수량 · 메뉴 선택"].map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step > i + 1 ? "bg-[#1D9E75] text-white" : step === i + 1 ? "bg-[#0A1A0F] text-white" : "bg-gray-200 text-gray-400"
              }`}>
                {step > i + 1 ? <span className="material-symbols-outlined text-sm">check</span> : i + 1}
              </div>
              <span className={`text-sm hidden sm:inline ${step === i + 1 ? "font-semibold text-[#0A1A0F]" : "text-gray-400"}`}>{label}</span>
              {i < 1 && <div className="w-8 h-px bg-gray-300" />}
            </div>
          ))}
        </div>

        {/* Step 1: 구독 유형 선택 */}
        {step === 1 && (
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#0A1A0F] mb-2">어떤 방식으로 받으시겠어요?</h1>
            <p className="text-[#4a7a5e] text-sm mb-8">구독 유형을 선택하세요</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl">
              {/* 직접 골라먹기 */}
              <button
                onClick={() => { setMode("manual"); setStep(3); }}
                className={`text-left p-6 rounded-2xl border-2 transition-all hover:scale-[1.02] ${
                  mode === "manual" ? "border-[#1D9E75] bg-white shadow-lg" : "border-gray-200 bg-white/80"
                }`}
              >
                <span className="material-symbols-outlined text-[#1D9E75] text-3xl mb-3 block">restaurant_menu</span>
                <h3 className="text-lg font-bold text-[#0A1A0F]">직접 골라먹기</h3>
                <p className="text-[#4a7a5e] text-sm mt-1">배송일마다 원하는 메뉴를 직접 선택합니다</p>
                <p className="text-[#1D9E75] text-xs font-semibold mt-3">월 자동결제 · 구독 할인 적용</p>
              </button>

              {/* 잘 챙겨서 보내줘 */}
              <button
                onClick={() => { setMode("auto"); setStep(3); }}
                className={`text-left p-6 rounded-2xl border-2 transition-all hover:scale-[1.02] relative ${
                  mode === "auto" ? "border-[#EF9F27] bg-white shadow-lg" : "border-gray-200 bg-white/80"
                }`}
              >
                <span className="absolute -top-2.5 right-4 px-3 py-0.5 bg-[#EF9F27] text-white text-[10px] font-bold rounded-full">추천</span>
                <span className="material-symbols-outlined text-[#EF9F27] text-3xl mb-3 block">auto_awesome</span>
                <h3 className="text-lg font-bold text-[#0A1A0F]">잘 챙겨서 보내줘</h3>
                <p className="text-[#4a7a5e] text-sm mt-1">메뉴 선택 없이, 저희가 엄선한 구성으로 보내드립니다</p>
                <p className="text-[#EF9F27] text-xs font-semibold mt-3">가장 간편 · 월 자동결제</p>
              </button>

              {/* 맛보기 */}
              <button
                onClick={() => { setMode("trial"); setStep(3); }}
                className={`text-left p-6 rounded-2xl border-2 transition-all hover:scale-[1.02] ${
                  mode === "trial" ? "border-[#1D9E75] bg-white shadow-lg" : "border-gray-200 bg-white/80"
                }`}
              >
                <span className="material-symbols-outlined text-[#7aaa90] text-3xl mb-3 block">local_dining</span>
                <h3 className="text-lg font-bold text-[#0A1A0F]">맛보기</h3>
                <p className="text-[#4a7a5e] text-sm mt-1">1회 배송으로 먼저 체험해보세요</p>
                <p className="text-[#7aaa90] text-xs font-semibold mt-3">1회 결제 · 부담 없이 시작</p>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: 수량 + 메뉴 선택 통합 */}
        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 왼쪽: 수량 + 캘린더 + 메뉴 */}
            <div className="lg:col-span-2">
              {/* 수량 선택 (컴팩트) */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#0A1A0F]">
                    {mode === "auto" ? "배송 일정 확인" : "수량 · 메뉴 선택"}
                  </h1>
                  <p className="text-[#4a7a5e] text-sm mt-1">
                    {curMonth}월~{nextMonth}월 · 배송 {activeDates.length}회
                  </p>
                </div>
                <button onClick={() => setStep(1)} className="text-sm text-[#7aaa90] hover:text-[#1D9E75] transition">
                  ← 유형 변경
                </button>
              </div>

              {/* 수량 +/- (샐러드 + 간편식) */}
              <div className="flex flex-wrap items-center gap-3 mb-6 bg-white rounded-2xl border border-[#1D9E75]/10 px-5 py-3">
                {/* 샐러드 */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#1D9E75]">샐러드</span>
                  <button
                    onClick={() => setSaladCount(Math.max(0, saladCount - 1))}
                    disabled={saladCount <= 0 || (saladCount + mealCount) <= config.minItems}
                    className="w-8 h-8 rounded-full border-2 border-[#1D9E75]/30 flex items-center justify-center text-[#1D9E75] font-bold hover:bg-[#1D9E75]/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
                  >−</button>
                  <span className="text-xl font-black text-[#1D9E75] min-w-[2ch] text-center">{saladCount}</span>
                  <button
                    onClick={() => setSaladCount(saladCount + 1)}
                    disabled={(saladCount + mealCount) >= config.maxItems}
                    className="w-8 h-8 rounded-full border-2 border-[#1D9E75]/30 flex items-center justify-center text-[#1D9E75] font-bold hover:bg-[#1D9E75]/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
                  >+</button>
                </div>

                <span className="text-gray-300 text-lg">+</span>

                {/* 간편식 */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#EF9F27]">간편식</span>
                  <button
                    onClick={() => setMealCount(Math.max(0, mealCount - 1))}
                    disabled={mealCount <= 0 || (saladCount + mealCount) <= config.minItems}
                    className="w-8 h-8 rounded-full border-2 border-[#EF9F27]/30 flex items-center justify-center text-[#EF9F27] font-bold hover:bg-[#EF9F27]/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
                  >−</button>
                  <span className="text-xl font-black text-[#EF9F27] min-w-[2ch] text-center">{mealCount}</span>
                  <button
                    onClick={() => setMealCount(mealCount + 1)}
                    disabled={(saladCount + mealCount) >= config.maxItems}
                    className="w-8 h-8 rounded-full border-2 border-[#EF9F27]/30 flex items-center justify-center text-[#EF9F27] font-bold hover:bg-[#EF9F27]/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
                  >+</button>
                </div>

                <span className="text-gray-300 text-lg">=</span>
                <span className="text-lg font-black text-[#0A1A0F]">총 {itemsPerDelivery}개</span>

                {/* 알아서 배송 추천 버튼 / 상태 표시 */}
                {mode === "auto" ? (
                  <div className="ml-auto flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-[#EF9F27]/10 text-[#EF9F27] rounded-full text-xs font-bold">
                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                    <span className="hidden sm:inline">잘 챙겨서 보내줘</span>
                    {/* 배송 횟수 조절 */}
                    <button
                      onClick={() => setAutoCount(Math.max(MIN_DELIVERIES, autoCount - 1))}
                      disabled={autoCount <= MIN_DELIVERIES}
                      className="w-8 h-8 rounded-full border-2 border-[#EF9F27]/50 flex items-center justify-center text-lg font-black disabled:opacity-30 hover:bg-[#EF9F27]/10 transition"
                    >−</button>
                    <span className="text-xl font-black min-w-[3ch] text-center">{autoCount}회</span>
                    <button
                      onClick={() => setAutoCount(Math.min(MAX_DELIVERIES, autoCount + 1))}
                      disabled={autoCount >= MAX_DELIVERIES}
                      className="w-8 h-8 rounded-full border-2 border-[#EF9F27]/50 flex items-center justify-center text-lg font-black disabled:opacity-30 hover:bg-[#EF9F27]/10 transition"
                    >+</button>
                    <button
                      onClick={() => { setMode("manual"); setTermsAgreed(false); }}
                      className="ml-1 text-[10px] text-gray-400 hover:text-gray-600 underline"
                    >직접 선택</button>
                  </div>
                ) : mode !== "trial" ? (
                  <button
                    onClick={() => { setMode("auto"); setSelection({}); }}
                    className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#EF9F27] to-[#f0b54a] text-white rounded-full text-xs font-bold hover:scale-110 transition-all animate-shimmer"
                  >
                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                    알아서 배송 추천!
                  </button>
                ) : null}
              </div>

              {/* 최소 8회 미달 경고 */}
              {!meetsMinimum && mode !== "trial" && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                  <span className="material-symbols-outlined text-red-500 text-lg shrink-0 mt-0.5">error</span>
                  <div>
                    <p className="text-red-700 text-sm font-semibold">배송 {activeDates.length}회 — 최소 {MIN_DELIVERIES}회 이상 필요합니다</p>
                    <p className="text-red-500 text-xs mt-0.5">
                      구독 할인(5,900원)은 6주 내 {MIN_DELIVERIES}회 이상 주문 시 적용됩니다.
                      건너뛰기를 줄이거나, 다음 달까지 포함하여 주문해주세요.
                    </p>
                  </div>
                </div>
              )}

              {/* 월 탭 캘린더 */}
              {(() => {
                const m = months[calTab] ?? months[0];
                if (!m) return null;
                const { year: mY, month: mM, grid } = m;
                // 비대칭 그리드: 일(1fr) 월(1fr) 화(2fr) 수(2fr) 목(2fr) 금(1fr) 토(1fr)
                return (
                  <div className="bg-white rounded-2xl border border-[#1D9E75]/10 overflow-hidden mb-4">
                    {/* 월 탭 */}
                    <div className="flex border-b border-[#1D9E75]/10">
                      {months.map((mo, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCalTab(idx)}
                          className={`flex-1 py-2.5 text-sm font-bold text-center transition ${
                            calTab === idx ? "bg-[#1D9E75] text-white" : "bg-[#f7fdf9] text-gray-500 hover:bg-[#e8f5ee]"
                          }`}
                        >{mo.month}월</button>
                      ))}
                    </div>
                    {/* 요일 헤더 — 일/월/금/토 좁게, 화~목 넓게 */}
                    <div className="grid bg-gray-50 border-b border-gray-100" style={{ gridTemplateColumns: "0.7fr 0.7fr 2fr 1.5fr 2fr 2fr 0.7fr" }}>
                      {WEEKDAYS.map((d, i) => (
                        <div key={d} className={`text-center py-1.5 text-[10px] font-semibold ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400"}`}>{d}</div>
                      ))}
                    </div>
                    {/* 날짜 그리드 */}
                    <div className="grid" style={{ gridTemplateColumns: "0.7fr 0.7fr 2fr 1.5fr 2fr 2fr 0.7fr" }}>
                      {grid.map((day, i) => {
                        if (day === null) return <div key={i} className="min-h-[3rem] border-b border-r border-gray-50" />;
                        const dateStr = getDateStr(mY, mM, day);
                        const isAllDelivery = allDeliveryDateSet.has(dateStr);
                        const isClosed = isAllDelivery && dateStr < cutoffDate;
                        const isSkipped = skippedDates.has(dateStr);
                        const isDelivery = deliveryDateSet.has(dateStr) && !isSkipped;
                        const isSelected = selectedDate === dateStr;
                        const count = getSelectedCount(dateStr);
                        const done = count >= itemsPerDelivery;
                        const incomplete = isDelivery && count > 0 && !done;
                        const empty = isDelivery && count === 0 && mode !== "auto";
                        const dayOfWeek = new Date(mY, mM - 1, day).getDay();
                        const isNarrowDay = dayOfWeek === 0 || dayOfWeek === 6 || dayOfWeek === 1;

                        return (
                          <div
                            key={i}
                            onClick={() => {
                              if (isClosed) return;
                              if (mode === "auto" && isAllDelivery) { toggleSkip(dateStr); return; }
                              if (isAllDelivery && mode !== "trial") {
                                if (isSkipped) { toggleSkip(dateStr); }
                                setSelectedDate(dateStr);
                              } else if (isDelivery) { setSelectedDate(dateStr); }
                            }}
                            className={`min-h-[3rem] border-b border-r border-gray-50 p-0.5 text-center transition cursor-pointer ${
                              isClosed ? "bg-gray-50 cursor-not-allowed"
                                : isSkipped ? "bg-gray-50/80"
                                : isSelected ? "bg-[#1D9E75]/10 ring-2 ring-[#1D9E75] ring-inset"
                                : incomplete ? "bg-red-50/60 ring-1 ring-red-300 ring-inset"
                                : empty ? "bg-amber-50/40"
                                : isDelivery ? "hover:bg-[#f0faf4]" : ""
                            } ${!isAllDelivery ? "cursor-default" : ""}`}
                          >
                            <span className={`text-xs ${dayOfWeek === 0 ? "text-red-400" : dayOfWeek === 6 ? "text-blue-400" : "text-gray-600"} ${!isAllDelivery ? "opacity-20" : isClosed ? "opacity-40" : "font-medium"}`}>
                              {day}
                            </span>
                            {isClosed && <div className="text-[8px] text-gray-400">마감</div>}
                            {isSkipped && !isClosed && <div className="text-[8px] text-gray-400 line-through">건너뜀</div>}
                            {isDelivery && !isClosed && !isNarrowDay && (
                              <div>
                                {mode === "auto" ? (
                                  <span className="w-4 h-4 bg-[#EF9F27] rounded-full inline-flex items-center justify-center">
                                    <span className="material-symbols-outlined text-white text-[9px]">check</span>
                                  </span>
                                ) : done ? (
                                  <span className="w-4 h-4 bg-[#1D9E75] rounded-full inline-flex items-center justify-center">
                                    <span className="material-symbols-outlined text-white text-[9px]">check</span>
                                  </span>
                                ) : count > 0 ? (
                                  <span className="text-[9px] font-bold text-red-500">{count}/{itemsPerDelivery}</span>
                                ) : (
                                  <span className="material-symbols-outlined text-amber-400 text-[12px]">warning</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* 진행 바 */}
              {mode !== "auto" && (
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

              {/* AUTO: 배송 리스트 */}
              {mode === "auto" ? (
                <div className="space-y-2 mb-4">
                  <p className="text-xs text-[#7aaa90] mb-2">날짜를 탭하면 건너뛸 수 있습니다</p>
                  {activeDates.map((d) => {
                    const menus = getMenuForDate(d.dateStr).slice(0, itemsPerDelivery);
                    const dateObj = new Date(d.dateStr + "T00:00:00");
                    return (
                      <div key={d.dateStr} className="flex items-center gap-3 bg-white rounded-xl border border-[#EF9F27]/10 px-4 py-3">
                        <div className="shrink-0 text-center">
                          <p className="text-xs text-[#EF9F27] font-bold">{dateObj.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}</p>
                          <p className="text-[10px] text-gray-400">{dateObj.toLocaleDateString("ko-KR", { weekday: "short" })}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          {menus.length > 0 ? menus.map((m) => (
                            <p key={m.productId} className="text-sm text-[#0A1A0F] truncate">{m.product.name}</p>
                          )) : (
                            <p className="text-xs text-gray-400">메뉴 미배정</p>
                          )}
                        </div>
                        <span className="material-symbols-outlined text-[#EF9F27] text-lg">check_circle</span>
                      </div>
                    );
                  })}
                  {skippedDates.size > 0 && (
                    <p className="text-xs text-gray-400 text-center mt-2">{skippedDates.size}회 건너뜀</p>
                  )}
                </div>
              ) : selectedDate && deliveryDateSet.has(selectedDate) ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-[#0A1A0F]">
                      {new Date(selectedDate + "T00:00:00").toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}
                    </h3>
                    <div className="flex items-center gap-3">
                      {mode !== "trial" && (
                        <button
                          onClick={() => toggleSkip(selectedDate)}
                          className="text-xs text-gray-400 hover:text-red-400 transition"
                        >
                          이 날 건너뛰기
                        </button>
                      )}
                      <span className={`text-sm font-medium ${getSelectedCount(selectedDate) >= itemsPerDelivery ? "text-[#1D9E75]" : "text-[#EF9F27]"}`}>
                        {getSelectedCount(selectedDate)}/{itemsPerDelivery} 선택
                      </span>
                    </div>
                  </div>

                  {/* 카테고리별 잔여 표시 */}
                  {(() => { const c = getSelectedByCategory(selectedDate); return (
                    <div className="flex gap-3 mb-3 text-xs">
                      <span className="text-[#1D9E75] font-medium">샐러드 {c.salads}/{saladCount}</span>
                      {mealCount > 0 && <span className="text-[#EF9F27] font-medium">간편식 {c.meals}/{mealCount}</span>}
                    </div>
                  ); })()}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {getMenuForDate(selectedDate).map((m) => {
                      const selected = isItemSelected(selectedDate, m.productId);
                      const qty = getItemCount(selectedDate, m.productId);
                      const cat = m.product.category.slug;
                      const counts = getSelectedByCategory(selectedDate);
                      const catFull = cat === "salad" ? counts.salads >= saladCount : counts.meals >= mealCount;
                      const full = (catFull && !selected) || (getSelectedCount(selectedDate) >= itemsPerDelivery && !selected);
                      const p = m.product;
                      return (
                        <button
                          key={m.productId}
                          onClick={() => toggleItem(selectedDate, m.productId)}
                          disabled={full}
                          className={`text-left rounded-2xl border-2 overflow-hidden transition-all ${
                            selected ? "border-[#1D9E75] shadow-lg scale-[1.01]" : full ? "border-gray-200 opacity-40 cursor-not-allowed" : "border-gray-200 hover:border-[#1D9E75]/40 hover:shadow-md"
                          }`}
                        >
                          <div className="h-32 bg-gradient-to-br from-[#e8f5ee] to-[#d4edda] flex items-center justify-center relative overflow-hidden">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="material-symbols-outlined text-[#1D9E75]/25 text-4xl">lunch_dining</span>
                            )}
                            {selected && (
                              <div className="absolute top-2 right-2 w-7 h-7 bg-[#1D9E75] rounded-full flex items-center justify-center shadow">
                                {qty >= 2 ? (
                                  <span className="text-white text-xs font-bold">×{qty}</span>
                                ) : (
                                  <span className="material-symbols-outlined text-white text-lg">check</span>
                                )}
                              </div>
                            )}
                            <span className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 text-[9px] font-semibold text-[#1D9E75] rounded-full">
                              {p.category.name}
                            </span>
                          </div>
                          <div className="p-3">
                            <h4 className="text-sm font-bold text-[#0A1A0F]">{p.name}</h4>
                            <div className="flex items-center gap-1.5 mt-1">
                              {p.originalPrice && p.originalPrice > p.price && (
                                <span className="text-gray-400 text-xs line-through">{p.originalPrice.toLocaleString()}원</span>
                              )}
                              <span className="text-[#1D9E75] text-sm font-bold">
                                {(mode === "trial" ? (p.originalPrice || p.price) : p.price).toLocaleString()}원
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {getMenuForDate(selectedDate).length === 0 && (
                    <div className="text-center py-10 text-[#7aaa90]">
                      <span className="material-symbols-outlined text-3xl mb-2 block">restaurant_menu</span>
                      <p className="text-sm">이 날짜에 배정된 메뉴가 없습니다</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-10 text-[#7aaa90] bg-white rounded-2xl border border-[#1D9E75]/10">
                  <span className="material-symbols-outlined text-3xl mb-2 block">touch_app</span>
                  <p className="text-sm">캘린더에서 배송일을 선택하세요</p>
                </div>
              )}
            </div>

            {/* 오른쪽: 주문 요약 */}
            <div className="lg:col-span-1">
              <div className="sticky top-20 bg-white rounded-2xl border border-[#1D9E75]/10 p-6 shadow-sm">
                <h2 className="text-lg font-bold text-[#0A1A0F] mb-4">주문 요약</h2>

                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-[#1D9E75]/10">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    mode === "auto" ? "bg-[#EF9F27]/10 text-[#EF9F27]" : mode === "trial" ? "bg-gray-100 text-gray-600" : "bg-[#1D9E75]/10 text-[#1D9E75]"
                  }`}>
                    {mode === "manual" ? "직접 골라먹기" : mode === "auto" ? "잘 챙겨서 보내줘" : "맛보기"}
                  </span>
                  <span className="text-[#7aaa90] text-xs">
                    샐러드 {saladCount}{mealCount > 0 ? ` + 간편식 ${mealCount}` : ""}
                  </span>
                </div>

                <div className="space-y-2 mb-6 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#7aaa90]">배송 횟수</span>
                    <span className="text-[#0A1A0F] font-medium">{activeDates.length}회</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#7aaa90]">회당 수량</span>
                    <span className="text-[#0A1A0F] font-medium">{itemsPerDelivery}개</span>
                  </div>
                </div>

                <div className="border-t border-[#1D9E75]/10 pt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span className="text-[#0A1A0F]">{mode === "trial" ? "결제 금액" : "월 결제 금액"}</span>
                    <span className={mode === "trial" ? "text-[#EF9F27]" : "text-[#1D9E75]"}>
                      {totalPrice > 0 ? `${totalPrice.toLocaleString()}원` : "-"}
                    </span>
                  </div>
                </div>

                {/* 약관 동의 */}
                <label className="flex items-start gap-2 mt-5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={termsAgreed}
                    onChange={(e) => setTermsAgreed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#1D9E75] focus:ring-[#1D9E75] cursor-pointer"
                  />
                  <span className="text-xs text-gray-500 leading-relaxed">
                    <a href="/terms/subscription" target="_blank" className="text-[#1D9E75] underline hover:text-[#167A5B]">
                      구독 서비스 이용약관
                    </a>
                    에 동의합니다.
                    {mode !== "trial" && (
                      <span className="text-gray-400 block mt-0.5">
                        중도해지 시 배송된 상품은 정가(7,500원) 기준으로 정산됩니다.
                      </span>
                    )}
                  </span>
                </label>

                <button
                  disabled={!allReady || paying}
                  onClick={handlePayment}
                  className={`w-full mt-3 py-4 rounded-xl font-bold text-base transition ${
                    allReady && !paying
                      ? mode === "trial"
                        ? "bg-[#EF9F27] text-white hover:bg-[#D48A1E] shadow-lg"
                        : "bg-[#1D9E75] text-white hover:bg-[#167A5B] shadow-lg"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {paying ? "결제 처리 중..."
                    : !termsAgreed ? "약관에 동의해주세요"
                    : !meetsMinimum && mode !== "trial" ? `최소 ${MIN_DELIVERIES}회 이상 필요 (현재 ${activeDates.length}회)`
                    : mode !== "auto" && completedCount < activeDates.length ? `메뉴를 선택해주세요 (${completedCount}/${activeDates.length})`
                    : mode === "trial" ? "맛보기 결제하기" : "구독 결제하기"}
                </button>

                {mode !== "trial" && (
                  <p className="text-[#7aaa90] text-[10px] text-center mt-3">언제든 일시정지·해지 가능 | 매월 자동 결제</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
