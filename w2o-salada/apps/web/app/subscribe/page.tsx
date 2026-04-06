"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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

type Selection = { [dayIndex: number]: string[] }; // dayIndex → productId[]

export default function SubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-b from-[#f7fdf9] to-[#edf7f0] flex items-center justify-center"><p className="text-[#7aaa90]">로딩 중...</p></div>}>
      <SubscribeContent />
    </Suspense>
  );
}

function SubscribeContent() {
  const searchParams = useSearchParams();
  const initialPlan = searchParams.get("plan") === "trial" ? "trial" : "subscription";

  const [plan, setPlan] = useState<"trial" | "subscription">(initialPlan);
  const [products, setProducts] = useState<Product[]>([]);
  const [selection, setSelection] = useState<Selection>({});
  const [selectedDay, setSelectedDay] = useState(0);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setProducts([]));
  }, []);

  // 요일별 배송 메뉴 (데모: 상품을 요일별로 분배)
  const menuByDay = useMemo(() => {
    return dayLabels.map((_, i) => {
      if (products.length < 2) return [];
      const start = (i * 3) % products.length;
      const dayProducts: Product[] = [];
      for (let j = 0; j < Math.min(4, products.length); j++) {
        dayProducts.push(products[(start + j) % products.length]);
      }
      return dayProducts;
    });
  }, [products]);

  // 맛보기: 1일만, 구독: 주 2회(화/목 기본)
  const deliveryDays = plan === "trial" ? [selectedDay] : [1, 3]; // 화, 목

  const toggleItem = (dayIdx: number, productId: string) => {
    setSelection((prev) => {
      const current = prev[dayIdx] || [];
      if (current.includes(productId)) {
        return { ...prev, [dayIdx]: current.filter((id) => id !== productId) };
      }
      if (current.length >= 2) return prev; // 최대 2개
      return { ...prev, [dayIdx]: [...current, productId] };
    });
  };

  const isSelected = (dayIdx: number, productId: string) => {
    return (selection[dayIdx] || []).includes(productId);
  };

  const getSelectedCount = (dayIdx: number) => {
    return (selection[dayIdx] || []).length;
  };

  // 가격 계산
  const calculatePrice = () => {
    let total = 0;
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const dayIdx of deliveryDays) {
      const items = selection[dayIdx] || [];
      for (const id of items) {
        const product = productMap.get(id);
        if (product) {
          total += plan === "subscription" ? product.price : (product.originalPrice || product.price);
        }
      }
    }

    if (plan === "subscription") {
      return { perDelivery: total / Math.max(deliveryDays.length, 1), monthly: total * 4, total };
    }
    return { perDelivery: total, monthly: 0, total };
  };

  const price = calculatePrice();

  // 최소 2개 선택 확인
  const allDeliveriesReady = deliveryDays.every((d) => getSelectedCount(d) >= 2);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f7fdf9] to-[#edf7f0]">
      {/* 헤더 */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#1D9E75]/10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5">
            <span className="text-lg font-black text-brand-green">W2O</span>
            <span className="text-xs text-gray-400 tracking-widest">SALADA</span>
          </Link>
          <Link href="/" className="text-[#7aaa90] text-sm hover:text-[#1D9E75] transition-colors">
            홈으로
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* 1단계: 플랜 선택 */}
        <div className="mb-10">
          <h1 className="text-2xl md:text-3xl font-bold text-[#0A1A0F] mb-2">식단을 선택하세요</h1>
          <p className="text-[#4a7a5e] text-sm">원하는 메뉴 조합을 자유롭게 골라보세요</p>
        </div>

        {/* 플랜 토글 */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => setPlan("trial")}
            className={`flex-1 py-3.5 rounded-xl font-semibold text-sm transition border ${
              plan === "trial"
                ? "bg-[#EF9F27] text-white border-[#EF9F27] shadow-md shadow-[#EF9F27]/20"
                : "bg-white text-[#4a7a5e] border-[#1D9E75]/15 hover:border-[#EF9F27]/50"
            }`}
          >
            맛보기 (1회)
          </button>
          <button
            onClick={() => setPlan("subscription")}
            className={`flex-1 py-3.5 rounded-xl font-semibold text-sm transition border ${
              plan === "subscription"
                ? "bg-[#1D9E75] text-white border-[#1D9E75] shadow-md shadow-[#1D9E75]/20"
                : "bg-white text-[#4a7a5e] border-[#1D9E75]/15 hover:border-[#1D9E75]/50"
            }`}
          >
            정기구독 (주 2회)
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 왼쪽: 식단 선택 */}
          <div className="lg:col-span-2">
            {/* 요일 탭 */}
            <div className="flex gap-2 mb-6">
              {dayLabels.map((day, i) => {
                const isDeliveryDay = deliveryDays.includes(i);
                const count = getSelectedCount(i);
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
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#EF9F27] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 선택 안내 */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-[#4a7a5e] text-sm">
                <span className="font-semibold text-[#0A1A0F]">{dayLabels[selectedDay]}요일</span> 배송 메뉴에서 2개를 선택하세요
              </p>
              <span className="text-sm font-medium text-[#1D9E75]">
                {getSelectedCount(selectedDay)}/2 선택
              </span>
            </div>

            {/* 메뉴 그리드 */}
            {!deliveryDays.includes(selectedDay) ? (
              <div className="text-center py-16 text-[#7aaa90] bg-white rounded-2xl border border-[#1D9E75]/10">
                <span className="material-symbols-outlined text-4xl mb-2 block">event_busy</span>
                <p className="text-sm">이 요일은 배송일이 아닙니다</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(menuByDay[selectedDay] || []).map((item) => {
                  const selected = isSelected(selectedDay, item.id);
                  const full = getSelectedCount(selectedDay) >= 2 && !selected;
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleItem(selectedDay, item.id)}
                      disabled={full}
                      className={`text-left rounded-2xl border-2 overflow-hidden transition-all duration-200 ${
                        selected
                          ? "border-[#1D9E75] shadow-lg shadow-[#1D9E75]/15 scale-[1.01]"
                          : full
                          ? "border-gray-200 opacity-50 cursor-not-allowed"
                          : "border-[#1D9E75]/10 hover:border-[#1D9E75]/40 hover:shadow-md"
                      }`}
                    >
                      {/* 이미지 */}
                      <div className="h-36 bg-gradient-to-br from-[#e8f5ee] to-[#d4edda] flex items-center justify-center relative overflow-hidden">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="material-symbols-outlined text-[#1D9E75]/25 text-5xl">lunch_dining</span>
                        )}
                        {/* 선택 체크 */}
                        {selected && (
                          <div className="absolute top-3 right-3 w-8 h-8 bg-[#1D9E75] rounded-full flex items-center justify-center shadow-lg">
                            <span className="material-symbols-outlined text-white text-xl">check</span>
                          </div>
                        )}
                        {/* 카테고리 */}
                        <span className="absolute top-3 left-3 px-2.5 py-0.5 bg-white/90 backdrop-blur-sm text-[10px] font-semibold text-[#1D9E75] rounded-full">
                          {item.category.name}
                        </span>
                      </div>

                      {/* 정보 */}
                      <div className="p-4">
                        <h3 className="text-[#0A1A0F] font-bold text-sm">{item.name}</h3>
                        <p className="text-[#7aaa90] text-xs mt-1 line-clamp-1">{item.description}</p>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-[#7aaa90] text-xs">{item.kcal ? `${item.kcal}kcal` : ""}</span>
                          <div className="flex items-center gap-1.5">
                            {item.originalPrice && item.originalPrice > item.price && (
                              <span className="text-gray-400 text-xs line-through">{item.originalPrice.toLocaleString()}원</span>
                            )}
                            <span className={`font-bold text-sm ${plan === "subscription" ? "text-[#1D9E75]" : "text-[#4a7a5e]"}`}>
                              {plan === "subscription"
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
                  {plan === "subscription" ? "정기구독" : "맛보기"}
                </span>
                <span className="text-[#7aaa90] text-xs">
                  {plan === "subscription" ? "주 2회 · 월 결제" : "1회 체험"}
                </span>
              </div>

              {/* 선택한 메뉴 */}
              <div className="space-y-3 mb-6">
                {deliveryDays.map((dayIdx) => {
                  const items = selection[dayIdx] || [];
                  return (
                    <div key={dayIdx}>
                      <p className="text-xs font-semibold text-[#7aaa90] mb-1.5">{dayLabels[dayIdx]}요일</p>
                      {items.length === 0 ? (
                        <p className="text-xs text-gray-300 italic">메뉴를 선택해주세요</p>
                      ) : (
                        <div className="space-y-1.5">
                          {items.map((id) => {
                            const p = products.find((pr) => pr.id === id);
                            if (!p) return null;
                            return (
                              <div key={id} className="flex justify-between items-center text-sm">
                                <span className="text-[#0A1A0F] truncate flex-1 mr-2">{p.name}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {p.originalPrice && p.originalPrice > p.price && plan === "subscription" && (
                                    <span className="text-gray-400 text-[10px] line-through">{p.originalPrice.toLocaleString()}</span>
                                  )}
                                  <span className="text-[#1D9E75] font-semibold text-xs">
                                    {plan === "subscription"
                                      ? `${p.price.toLocaleString()}원`
                                      : `${(p.originalPrice || p.price).toLocaleString()}원`}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 금액 */}
              <div className="border-t border-[#1D9E75]/10 pt-4 space-y-2">
                {plan === "subscription" ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#7aaa90]">1회 배송</span>
                      <span className="text-[#0A1A0F] font-medium">
                        {price.perDelivery > 0 ? `${price.perDelivery.toLocaleString()}원` : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#7aaa90]">주 2회 × 4주</span>
                      <span className="text-[#0A1A0F] font-medium">
                        {price.monthly > 0 ? `${price.monthly.toLocaleString()}원` : "-"}
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
                disabled={!allDeliveriesReady}
                className={`w-full mt-6 py-4 rounded-xl font-bold text-base transition ${
                  allDeliveriesReady
                    ? plan === "subscription"
                      ? "bg-[#1D9E75] text-white hover:bg-[#167A5B] shadow-lg shadow-[#1D9E75]/20"
                      : "bg-[#EF9F27] text-white hover:bg-[#D48A1E] shadow-lg shadow-[#EF9F27]/20"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {!allDeliveriesReady
                  ? `메뉴를 선택해주세요 (최소 2개)`
                  : plan === "subscription"
                  ? "구독 결제하기"
                  : "맛보기 결제하기"
                }
              </button>

              {plan === "subscription" && (
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
