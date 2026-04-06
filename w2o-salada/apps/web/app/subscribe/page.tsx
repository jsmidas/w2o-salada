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

const dayLabels = ["월", "화", "수", "목", "금"];
const weekLabels = ["1주차", "2주차", "3주차", "4주차"];

// week-day 복합 키
type DayKey = `${number}-${number}`; // "week-day"
type Selection = { [key: DayKey]: string[] };

function makeDayKey(week: number, day: number): DayKey {
  return `${week}-${day}`;
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
  const router = useRouter();
  const { data: session } = useSession();
  const paramPlan = searchParams.get("plan");
  const initialPlan = paramPlan === "trial" ? "trial" : paramPlan === "mixed" ? "mixed" : "subscription";

  const [plan, setPlan] = useState<"trial" | "subscription" | "mixed">(initialPlan);
  const [products, setProducts] = useState<Product[]>([]);
  const [selection, setSelection] = useState<Selection>({});
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [selectedDay, setSelectedDay] = useState(1); // 화요일 기본
  const [paying, setPaying] = useState(false);
  const [config, setConfig] = useState({ minItems: 2, maxItems: 2, weeksPerMonth: 4, deliveryDays: [1, 3] as number[] });

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setProducts([]));

    // 구독 설정 로드
    fetch("/api/subscribe/settings")
      .then((r) => r.json())
      .then((data) => {
        const dayMap: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4 };
        const days = (data["subscribe.deliveryDays"] || "tue,thu").split(",").map((d: string) => dayMap[d.trim()] ?? 1);
        setConfig({
          minItems: parseInt(data["subscribe.minItems"] || "2"),
          maxItems: parseInt(data["subscribe.maxItems"] || "2"),
          weeksPerMonth: parseInt(data["subscribe.weeksPerMonth"] || "4"),
          deliveryDays: days,
        });
      })
      .catch(() => {});
  }, []);

  // 배송 요일 (설정에서 로드)
  const deliveryDayIndices = config.deliveryDays;

  // 주차 수: 구독/혼합은 설정값, 맛보기는 1주
  const weekCount = plan === "trial" ? 1 : config.weeksPerMonth;

  // 전체 배송일 목록
  const allDeliveryKeys: DayKey[] = useMemo(() => {
    const keys: DayKey[] = [];
    for (let w = 0; w < weekCount; w++) {
      for (const d of deliveryDayIndices) {
        keys.push(makeDayKey(w, d));
      }
    }
    return keys;
  }, [weekCount]);

  // 요일별 배송 메뉴 (데모: 상품을 요일+주차별로 분배)
  const getMenuForDay = (week: number, day: number): Product[] => {
    if (products.length < 2) return [];
    const seed = week * 5 + day;
    const start = (seed * 3) % products.length;
    const dayProducts: Product[] = [];
    for (let j = 0; j < Math.min(4, products.length); j++) {
      dayProducts.push(products[(start + j) % products.length]);
    }
    return dayProducts;
  };

  const currentKey = makeDayKey(selectedWeek, selectedDay);

  const toggleItem = (key: DayKey, productId: string) => {
    setSelection((prev) => {
      const current = prev[key] || [];
      if (current.includes(productId)) {
        return { ...prev, [key]: current.filter((id) => id !== productId) };
      }
      if (current.length >= config.maxItems) return prev;
      return { ...prev, [key]: [...current, productId] };
    });
  };

  const isSelected = (key: DayKey, productId: string) => {
    return (selection[key] || []).includes(productId);
  };

  const getSelectedCount = (key: DayKey) => {
    return (selection[key] || []).length;
  };

  // 가격 계산
  const calculatePrice = () => {
    let total = 0;
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const key of allDeliveryKeys) {
      const items = selection[key] || [];
      for (const id of items) {
        const product = productMap.get(id);
        if (product) {
          total += plan === "trial" ? (product.originalPrice || product.price) : product.price;
        }
      }
    }

    const deliveryCount = allDeliveryKeys.length;
    if (plan !== "trial") {
      return { perDelivery: deliveryCount > 0 ? total / deliveryCount : 0, monthly: total, total };
    }
    return { perDelivery: total, monthly: 0, total };
  };

  const price = calculatePrice();

  // 전체 배송일 선택 완료 확인
  const allDeliveriesReady = allDeliveryKeys.every((k) => getSelectedCount(k) >= config.minItems);
  const completedCount = allDeliveryKeys.filter((k) => getSelectedCount(k) >= config.minItems).length;

  // 결제 처리
  const handlePayment = async () => {
    if (!allDeliveriesReady) return;

    // 로그인 확인
    if (!session?.user) {
      router.push(`/login?redirect=/subscribe?plan=${plan}`);
      return;
    }

    setPaying(true);

    try {
      // 선택한 메뉴 정리
      const selections = allDeliveryKeys.map((key) => {
        const [week, day] = key.split("-");
        return {
          week: parseInt(week!) + 1,
          day: parseInt(day!) === 1 ? "tue" : "thu",
          productIds: selection[key] || [],
        };
      }).filter((s) => s.productIds.length > 0);

      // 주문 생성
      const orderRes = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, selections }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json();
        alert(err.error || "주문 생성에 실패했습니다.");
        setPaying(false);
        return;
      }

      const order = await orderRes.json();

      // 토스 결제 요청
      const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!TOSS_CLIENT_KEY) {
        alert("결제 키가 설정되지 않았습니다.");
        setPaying(false);
        return;
      }

      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      const userId = (session.user as { id?: string }).id ?? "guest";
      const payment = tossPayments.payment({ customerKey: userId });

      const orderName = plan === "trial"
        ? "W2O 맛보기 (1회)"
        : plan === "subscription"
        ? "W2O 정기구독 (월)"
        : "W2O 혼합신청 (월)";

      if (plan === "trial") {
        // 맛보기: 일반결제
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
        // 구독/혼합: 빌링키 발급 (자동결제)
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
          <Link href="/" className="text-[#7aaa90] text-sm hover:text-[#1D9E75] transition-colors">
            홈으로
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* 타이틀 */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-[#0A1A0F] mb-2">식단을 선택하세요</h1>
          <p className="text-[#4a7a5e] text-sm">
            {plan === "trial"
              ? "맛보기 1회 배송 — 화·목 중 원하는 날의 메뉴 {config.minItems}~{config.maxItems}개를 선택하세요"
              : `4주간 배송될 메뉴를 미리 선택하세요 (주 2회 × 4주 = 총 ${allDeliveryKeys.length}회)`}
          </p>
        </div>

        {/* 플랜 토글 */}
        <div className="flex gap-3 mb-8">
          {([
            { key: "trial" as const, label: "맛보기 (1회)", activeColor: "bg-[#EF9F27] border-[#EF9F27] shadow-[#EF9F27]/20" },
            { key: "subscription" as const, label: "정기구독 (샐러드)", activeColor: "bg-[#1D9E75] border-[#1D9E75] shadow-[#1D9E75]/20" },
            { key: "mixed" as const, label: "혼합신청", activeColor: "bg-[#EF9F27] border-[#EF9F27] shadow-[#EF9F27]/20" },
          ]).map((p) => (
            <button
              key={p.key}
              onClick={() => { setPlan(p.key); setSelectedWeek(0); setSelectedDay(1); }}
              className={`flex-1 py-3.5 rounded-xl font-semibold text-sm transition border ${
                plan === p.key
                  ? `${p.activeColor} text-white shadow-md`
                  : "bg-white text-[#4a7a5e] border-[#1D9E75]/15 hover:border-[#1D9E75]/50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* 진행 상황 바 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[#4a7a5e]">메뉴 선택 진행</span>
            <span className="text-sm font-semibold text-[#1D9E75]">{completedCount}/{allDeliveryKeys.length}회 완료</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#1D9E75] to-[#5DCAA5] rounded-full transition-all duration-500"
              style={{ width: `${allDeliveryKeys.length > 0 ? (completedCount / allDeliveryKeys.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 왼쪽: 식단 선택 */}
          <div className="lg:col-span-2">
            {/* 주차 탭 */}
            {weekCount > 1 && (
              <div className="flex gap-2 mb-4">
                {weekLabels.slice(0, weekCount).map((label, w) => {
                  const weekComplete = deliveryDayIndices.every(
                    (d) => getSelectedCount(makeDayKey(w, d)) >= config.minItems
                  );
                  return (
                    <button
                      key={w}
                      onClick={() => { setSelectedWeek(w); setSelectedDay(deliveryDayIndices[0]); }}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition relative ${
                        selectedWeek === w
                          ? "bg-[#0A1A0F] text-white shadow-md"
                          : "bg-white text-[#4a7a5e] border border-[#1D9E75]/15 hover:border-[#1D9E75]/40"
                      }`}
                    >
                      {label}
                      {weekComplete && (
                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#1D9E75] text-white text-[10px] rounded-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-[12px]">check</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 요일 탭 */}
            <div className="flex gap-2 mb-6">
              {dayLabels.map((day, i) => {
                const isDeliveryDay = deliveryDayIndices.includes(i);
                const key = makeDayKey(selectedWeek, i);
                const count = getSelectedCount(key);
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(i)}
                    disabled={!isDeliveryDay}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium transition relative ${
                      !isDeliveryDay
                        ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                        : selectedDay === i
                        ? "bg-[#1D9E75] text-white shadow-md"
                        : "bg-white text-[#4a7a5e] border border-[#1D9E75]/15 hover:border-[#1D9E75]/40"
                    }`}
                  >
                    {day}
                    {isDeliveryDay && count > 0 && (
                      <span className={`absolute -top-1.5 -right-1.5 w-5 h-5 text-white text-[10px] font-bold rounded-full flex items-center justify-center ${
                        count >= config.minItems ? "bg-[#1D9E75]" : "bg-[#EF9F27]"
                      }`}>
                        {count >= config.minItems ? <span className="material-symbols-outlined text-[12px]">check</span> : count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 선택 안내 */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-[#4a7a5e] text-sm">
                {weekCount > 1 && <span className="font-semibold text-[#0A1A0F]">{weekLabels[selectedWeek]} </span>}
                <span className="font-semibold text-[#0A1A0F]">{dayLabels[selectedDay]}요일</span> 배송 메뉴에서 {config.minItems}~{config.maxItems}개를 선택하세요
              </p>
              <span className={`text-sm font-medium ${getSelectedCount(currentKey) >= config.minItems ? "text-[#1D9E75]" : "text-[#EF9F27]"}`}>
                {getSelectedCount(currentKey)}/{config.maxItems} 선택
              </span>
            </div>

            {/* 메뉴 그리드 */}
            {!deliveryDayIndices.includes(selectedDay) ? (
              <div className="text-center py-16 text-[#7aaa90] bg-white rounded-2xl border border-[#1D9E75]/10">
                <span className="material-symbols-outlined text-4xl mb-2 block">event_busy</span>
                <p className="text-sm">이 요일은 배송일이 아닙니다</p>
                <p className="text-xs mt-1">화요일 또는 목요일을 선택해주세요</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {getMenuForDay(selectedWeek, selectedDay).map((item) => {
                  const selected = isSelected(currentKey, item.id);
                  const full = getSelectedCount(currentKey) >= config.maxItems && !selected;
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleItem(currentKey, item.id)}
                      disabled={full}
                      className={`text-left rounded-2xl border-2 overflow-hidden transition-all duration-200 ${
                        selected
                          ? "border-[#1D9E75] shadow-lg shadow-[#1D9E75]/15 scale-[1.01]"
                          : full
                          ? "border-gray-200 opacity-50 cursor-not-allowed"
                          : "border-[#1D9E75]/10 hover:border-[#1D9E75]/40 hover:shadow-md"
                      }`}
                    >
                      <div className="h-36 bg-gradient-to-br from-[#e8f5ee] to-[#d4edda] flex items-center justify-center relative overflow-hidden">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="material-symbols-outlined text-[#1D9E75]/25 text-5xl">lunch_dining</span>
                        )}
                        {selected && (
                          <div className="absolute top-3 right-3 w-8 h-8 bg-[#1D9E75] rounded-full flex items-center justify-center shadow-lg">
                            <span className="material-symbols-outlined text-white text-xl">check</span>
                          </div>
                        )}
                        <span className="absolute top-3 left-3 px-2.5 py-0.5 bg-white/90 backdrop-blur-sm text-[10px] font-semibold text-[#1D9E75] rounded-full">
                          {item.category.name}
                        </span>
                      </div>
                      <div className="p-4">
                        <h3 className="text-[#0A1A0F] font-bold text-sm">{item.name}</h3>
                        <p className="text-[#7aaa90] text-xs mt-1 line-clamp-1">{item.description}</p>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-[#7aaa90] text-xs">{item.kcal ? `${item.kcal}kcal` : ""}</span>
                          <div className="flex items-center gap-1.5">
                            {item.originalPrice && item.originalPrice > item.price && (
                              <span className="text-gray-400 text-xs line-through">{item.originalPrice.toLocaleString()}원</span>
                            )}
                            <span className={`font-bold text-sm ${plan !== "trial" ? "text-[#1D9E75]" : "text-[#4a7a5e]"}`}>
                              {plan !== "trial"
                                ? `${item.price.toLocaleString()}원`
                                : `${(item.originalPrice || item.price).toLocaleString()}원`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 오른쪽: 주문 요약 */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 bg-white rounded-2xl border border-[#1D9E75]/10 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-[#0A1A0F] mb-4">주문 요약</h2>

              {/* 플랜 */}
              <div className="flex items-center gap-2 mb-4 pb-4 border-b border-[#1D9E75]/10">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  plan === "subscription"
                    ? "bg-[#1D9E75]/10 text-[#1D9E75]"
                    : "bg-[#EF9F27]/10 text-[#EF9F27]"
                }`}>
                  {plan === "subscription" ? "정기구독" : plan === "mixed" ? "혼합신청" : "맛보기"}
                </span>
                <span className="text-[#7aaa90] text-xs">
                  {plan === "trial" ? "1회 체험 · 화 또는 목" : `주 2회 × 4주 = ${allDeliveryKeys.length}회`}
                </span>
              </div>

              {/* 선택한 메뉴 — 주차별 */}
              <div className="space-y-4 mb-6 max-h-[40vh] overflow-y-auto">
                {Array.from({ length: weekCount }, (_, w) => (
                  <div key={w}>
                    {weekCount > 1 && (
                      <p className="text-[10px] font-bold text-[#7aaa90] tracking-wider mb-1.5">{weekLabels[w]}</p>
                    )}
                    <div className="space-y-2">
                      {deliveryDayIndices.map((d) => {
                        const key = makeDayKey(w, d);
                        const items = selection[key] || [];
                        return (
                          <div key={key} className="pl-2 border-l-2 border-[#1D9E75]/10">
                            <p className="text-xs font-semibold text-[#4a7a5e] mb-1">{dayLabels[d]}</p>
                            {items.length === 0 ? (
                              <p className="text-[10px] text-gray-300 italic">미선택</p>
                            ) : (
                              <div className="space-y-0.5">
                                {items.map((id) => {
                                  const p = products.find((pr) => pr.id === id);
                                  if (!p) return null;
                                  return (
                                    <div key={id} className="flex justify-between items-center">
                                      <span className="text-[#0A1A0F] text-xs truncate flex-1 mr-2">{p.name}</span>
                                      <span className="text-[#1D9E75] font-semibold text-[10px] shrink-0">
                                        {plan !== "trial"
                                          ? `${p.price.toLocaleString()}원`
                                          : `${(p.originalPrice || p.price).toLocaleString()}원`}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* 금액 */}
              <div className="border-t border-[#1D9E75]/10 pt-4 space-y-2">
                {plan !== "trial" ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#7aaa90]">1회 배송 평균</span>
                      <span className="text-[#0A1A0F] font-medium">
                        {price.perDelivery > 0 ? `${Math.round(price.perDelivery).toLocaleString()}원` : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between text-lg font-bold pt-2 border-t border-dashed border-[#1D9E75]/10">
                      <span className="text-[#0A1A0F]">월 결제 금액</span>
                      <span className="text-[#1D9E75]">
                        {price.monthly > 0 ? `${price.monthly.toLocaleString()}원` : "-"}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-lg font-bold">
                    <span className="text-[#0A1A0F]">결제 금액</span>
                    <span className="text-[#EF9F27]">
                      {price.total > 0 ? `${price.total.toLocaleString()}원` : "-"}
                    </span>
                  </div>
                )}
              </div>

              {/* 결제 버튼 */}
              <button
                disabled={!allDeliveriesReady || paying}
                onClick={handlePayment}
                className={`w-full mt-6 py-4 rounded-xl font-bold text-base transition ${
                  allDeliveriesReady && !paying
                    ? plan === "subscription"
                      ? "bg-[#1D9E75] text-white hover:bg-[#167A5B] shadow-lg shadow-[#1D9E75]/20"
                      : "bg-[#EF9F27] text-white hover:bg-[#D48A1E] shadow-lg shadow-[#EF9F27]/20"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {paying
                  ? "결제 처리 중..."
                  : !allDeliveriesReady
                  ? `메뉴를 선택해주세요 (${completedCount}/${allDeliveryKeys.length}회 완료)`
                  : plan === "subscription"
                  ? "구독 결제하기"
                  : plan === "mixed"
                  ? "혼합 결제하기"
                  : "맛보기 결제하기"
                }
              </button>

              {plan !== "trial" && (
                <p className="text-[#7aaa90] text-[10px] text-center mt-3">
                  언제든 일시정지·해지 가능 | 매월 자동 결제
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
