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

  // Step 관리
  const [step, setStep] = useState(1);

  // Step 1: 구독 유형
  const [mode, setMode] = useState<"manual" | "auto" | "trial">(
    paramPlan === "trial" ? "trial" : paramPlan === "auto" ? "auto" : "manual"
  );

  // Step 2: 배송당 수량
  const [itemsPerDelivery, setItemsPerDelivery] = useState(2);
  const [config, setConfig] = useState({ minItems: 2, maxItems: 5 });

  // Step 3: 캘린더 메뉴 선택
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [selection, setSelection] = useState<Selection>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const now = new Date();
  const [viewYear] = useState(now.getFullYear());
  const [viewMonth] = useState(now.getMonth() + 1);

  // 설정 + 캘린더 로드
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

    fetch(`/api/delivery-calendar?year=${viewYear}&month=${viewMonth}`)
      .then((r) => r.json())
      .then((data) => setCalendar(Array.isArray(data) ? data : []))
      .catch(() => setCalendar([]));
  }, [viewYear, viewMonth]);

  // 배송일 목록
  const deliveryDates = useMemo(() => {
    return calendar
      .filter((d) => d.isActive)
      .map((d) => {
        const dateStr = new Date(d.date).toISOString().split("T")[0]!;
        return { ...d, dateStr };
      });
  }, [calendar]);

  // 맛보기: 첫 배송일만
  const activeDates = mode === "trial" ? deliveryDates.slice(0, 1) : deliveryDates;

  // 달력 그리드
  const calendarGrid = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth - 1, 1);
    const lastDay = new Date(viewYear, viewMonth, 0);
    const startPad = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const grid: (number | null)[] = [];
    for (let i = 0; i < startPad; i++) grid.push(null);
    for (let d = 1; d <= totalDays; d++) grid.push(d);
    while (grid.length % 7 !== 0) grid.push(null);
    return grid;
  }, [viewYear, viewMonth]);

  const deliveryDateSet = useMemo(() => {
    return new Set(activeDates.map((d) => d.dateStr));
  }, [activeDates]);

  const getDateStr = (day: number) =>
    `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const getMenuForDate = (dateStr: string) => {
    return calendar.find((d) => new Date(d.date).toISOString().split("T")[0] === dateStr)?.menuAssignments || [];
  };

  // 메뉴 선택
  const toggleItem = (dateStr: string, productId: string) => {
    setSelection((prev) => {
      const current = prev[dateStr] || [];
      if (current.includes(productId)) {
        return { ...prev, [dateStr]: current.filter((id) => id !== productId) };
      }
      if (current.length >= itemsPerDelivery) return prev;
      return { ...prev, [dateStr]: [...current, productId] };
    });
  };

  const getSelectedCount = (dateStr: string) => (selection[dateStr] || []).length;
  const isItemSelected = (dateStr: string, productId: string) => (selection[dateStr] || []).includes(productId);

  // 완료 체크
  const completedCount = activeDates.filter((d) => getSelectedCount(d.dateStr) >= itemsPerDelivery).length;
  const allReady = mode === "auto" || (activeDates.length > 0 && completedCount === activeDates.length);

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
        {/* 스텝 인디케이터 */}
        <div className="flex items-center gap-2 mb-8">
          {["구독 유형", "수량 선택", mode === "auto" ? "확인 및 결제" : "메뉴 선택"].map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step > i + 1 ? "bg-[#1D9E75] text-white" : step === i + 1 ? "bg-[#0A1A0F] text-white" : "bg-gray-200 text-gray-400"
              }`}>
                {step > i + 1 ? <span className="material-symbols-outlined text-sm">check</span> : i + 1}
              </div>
              <span className={`text-sm hidden sm:inline ${step === i + 1 ? "font-semibold text-[#0A1A0F]" : "text-gray-400"}`}>{label}</span>
              {i < 2 && <div className="w-8 h-px bg-gray-300" />}
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
                onClick={() => { setMode("manual"); setStep(2); }}
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
                onClick={() => { setMode("auto"); setStep(2); }}
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
                onClick={() => { setMode("trial"); setStep(2); }}
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

        {/* Step 2: 수량 선택 */}
        {step === 2 && (
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#0A1A0F] mb-2">몇 개씩 받으시겠어요?</h1>
            <p className="text-[#4a7a5e] text-sm mb-8">배송 1회당 받으실 수량을 선택하세요</p>

            <div className="flex gap-3 flex-wrap max-w-xl mb-8">
              {Array.from({ length: config.maxItems - config.minItems + 1 }, (_, i) => config.minItems + i).map((n) => (
                <button
                  key={n}
                  onClick={() => setItemsPerDelivery(n)}
                  className={`px-6 py-4 rounded-2xl border-2 font-bold text-lg transition-all ${
                    itemsPerDelivery === n
                      ? "border-[#1D9E75] bg-[#1D9E75] text-white shadow-lg scale-105"
                      : "border-gray-200 bg-white text-[#0A1A0F] hover:border-[#1D9E75]/40"
                  }`}
                >
                  {n}개
                </button>
              ))}
            </div>

            <p className="text-[#4a7a5e] text-sm mb-6">
              샐러드와 간편식을 자유롭게 조합할 수 있습니다.
              {mode !== "trial" && ` (이번 달 배송 ${activeDates.length}회)`}
            </p>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="px-6 py-3 border border-gray-300 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition">
                이전
              </button>
              <button onClick={() => setStep(3)} className="px-8 py-3 bg-[#1D9E75] text-white rounded-xl font-semibold hover:bg-[#167A5B] transition">
                다음
              </button>
            </div>
          </div>
        )}

        {/* Step 3: 메뉴 선택 (MANUAL/TRIAL) 또는 확인+결제 (AUTO) */}
        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 왼쪽: 캘린더 + 메뉴 */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#0A1A0F]">
                    {mode === "auto" ? "배송 일정 확인" : "메뉴를 선택하세요"}
                  </h1>
                  <p className="text-[#4a7a5e] text-sm mt-1">
                    {viewYear}년 {viewMonth}월 · 배송 {activeDates.length}회 · 회당 {itemsPerDelivery}개
                  </p>
                </div>
                <button onClick={() => setStep(2)} className="text-sm text-[#7aaa90] hover:text-[#1D9E75] transition">
                  ← 수량 변경
                </button>
              </div>

              {/* 미니 캘린더 */}
              <div className="bg-white rounded-2xl border border-[#1D9E75]/10 overflow-hidden mb-6">
                <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
                  {WEEKDAYS.map((d, i) => (
                    <div key={d} className={`text-center py-2 text-xs font-semibold ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400"}`}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {calendarGrid.map((day, i) => {
                    if (day === null) return <div key={i} className="h-16 border-b border-r border-gray-50" />;
                    const dateStr = getDateStr(day);
                    const isDelivery = deliveryDateSet.has(dateStr);
                    const isSelected = selectedDate === dateStr;
                    const count = getSelectedCount(dateStr);
                    const done = count >= itemsPerDelivery;
                    const dayOfWeek = new Date(viewYear, viewMonth - 1, day).getDay();

                    return (
                      <div
                        key={i}
                        onClick={() => isDelivery && setSelectedDate(dateStr)}
                        className={`h-16 border-b border-r border-gray-50 p-1 text-center transition cursor-pointer ${
                          isSelected ? "bg-[#1D9E75]/10 ring-2 ring-[#1D9E75] ring-inset" : isDelivery ? "hover:bg-[#f0faf4]" : ""
                        } ${!isDelivery ? "cursor-default" : ""}`}
                      >
                        <span className={`text-sm ${dayOfWeek === 0 ? "text-red-400" : dayOfWeek === 6 ? "text-blue-400" : "text-gray-600"} ${!isDelivery ? "opacity-30" : "font-medium"}`}>
                          {day}
                        </span>
                        {isDelivery && (
                          <div className="mt-1">
                            {mode === "auto" ? (
                              <span className="w-2 h-2 bg-[#EF9F27] rounded-full inline-block" />
                            ) : done ? (
                              <span className="w-5 h-5 bg-[#1D9E75] rounded-full inline-flex items-center justify-center">
                                <span className="material-symbols-outlined text-white text-[10px]">check</span>
                              </span>
                            ) : count > 0 ? (
                              <span className="text-[10px] font-bold text-[#EF9F27]">{count}/{itemsPerDelivery}</span>
                            ) : (
                              <span className="w-2 h-2 bg-[#1D9E75]/30 rounded-full inline-block" />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 진행 바 */}
              {mode !== "auto" && (
                <div className="mb-6">
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

              {/* 선택한 날짜의 메뉴 */}
              {mode === "auto" ? (
                <div className="bg-white rounded-2xl border border-[#EF9F27]/15 p-6 text-center">
                  <span className="material-symbols-outlined text-[#EF9F27] text-4xl mb-3 block">auto_awesome</span>
                  <h3 className="text-lg font-bold text-[#0A1A0F] mb-2">메뉴 선택이 필요 없어요!</h3>
                  <p className="text-[#4a7a5e] text-sm">
                    매 배송일마다 저희가 엄선한 {itemsPerDelivery}개의 메뉴를 보내드립니다.<br/>
                    배송일은 위 캘린더에서 확인하실 수 있습니다.
                  </p>
                </div>
              ) : selectedDate && deliveryDateSet.has(selectedDate) ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-[#0A1A0F]">
                      {new Date(selectedDate + "T00:00:00").toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}
                    </h3>
                    <span className={`text-sm font-medium ${getSelectedCount(selectedDate) >= itemsPerDelivery ? "text-[#1D9E75]" : "text-[#EF9F27]"}`}>
                      {getSelectedCount(selectedDate)}/{itemsPerDelivery} 선택
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {getMenuForDate(selectedDate).map((m) => {
                      const selected = isItemSelected(selectedDate, m.productId);
                      const full = getSelectedCount(selectedDate) >= itemsPerDelivery && !selected;
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
                                <span className="material-symbols-outlined text-white text-lg">check</span>
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
                  <span className="text-[#7aaa90] text-xs">회당 {itemsPerDelivery}개</span>
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

                <button
                  disabled={!allReady || paying}
                  onClick={handlePayment}
                  className={`w-full mt-6 py-4 rounded-xl font-bold text-base transition ${
                    allReady && !paying
                      ? mode === "trial"
                        ? "bg-[#EF9F27] text-white hover:bg-[#D48A1E] shadow-lg"
                        : "bg-[#1D9E75] text-white hover:bg-[#167A5B] shadow-lg"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {paying ? "결제 처리 중..." : !allReady ? `메뉴를 선택해주세요 (${completedCount}/${activeDates.length})` : mode === "trial" ? "맛보기 결제하기" : "구독 결제하기"}
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
