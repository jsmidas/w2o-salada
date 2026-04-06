"use client";

import { useState, useEffect } from "react";
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

type ScheduleEntry = {
  week: number;
  day: string;
  slot: number;
  product: Product;
};

const weekLabels = ["1주차", "2주차", "3주차", "4주차"];
const dayMap: Record<string, string> = { tue: "화", thu: "목" };

export default function WeeklyMenuSection() {
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [fallbackProducts, setFallbackProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // 배정된 식단 로드
    fetch(`/api/menu-schedule?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setSchedule(data);
        } else {
          // 배정 데이터 없으면 상품 목록으로 자동 분배 (폴백)
          fetch("/api/products")
            .then((r) => r.json())
            .then((d) => setFallbackProducts(Array.isArray(d) ? d : []))
            .catch(() => setFallbackProducts([]));
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  // 배정 데이터가 있으면 그걸 사용, 없으면 자동 분배
  const hasSchedule = schedule.length > 0;

  const getScheduledMenu = (week: number, day: string) => {
    if (hasSchedule) {
      const entries = schedule.filter((s) => s.week === week && s.day === day);
      const salads = entries.filter((e) => e.slot < 2).map((e) => e.product);
      const meals = entries.filter((e) => e.slot >= 2).map((e) => e.product);
      return { salads, meals };
    }
    // 폴백: 자동 분배
    const allSalads = fallbackProducts.filter(
      (p) => p.category.slug === "salad" || p.category.name.includes("샐러드")
    );
    const allMeals = fallbackProducts.filter(
      (p) => p.category.slug !== "salad" && !p.category.name.includes("샐러드")
    );
    const dayIdx = day === "tue" ? 0 : 1;
    const idx = (week - 1) * 2 + dayIdx;
    const s1 = allSalads.length > 0 ? allSalads[idx % allSalads.length] : null;
    const s2 = allSalads.length > 1 ? allSalads[(idx + 1) % allSalads.length] : null;
    const m1 = allMeals.length > 0 ? allMeals[idx % allMeals.length] : null;
    return {
      salads: [s1, s2].filter(Boolean) as Product[],
      meals: m1 ? [m1] : [],
    };
  };

  if (loading) return null;

  const isEmpty = !hasSchedule && fallbackProducts.length === 0;

  if (isEmpty) {
    return (
      <section id="weekly-menu" className="py-20 bg-gradient-to-b from-[#f7fdf9] to-[#edf7f0]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="text-[#1D9E75] text-xs tracking-[0.3em] uppercase font-medium">MONTHLY MENU</span>
            <h2 className="text-3xl md:text-4xl font-bold text-[#0A1A0F] mt-3">이달의 식단표</h2>
          </div>
          <div className="text-center py-16 text-[#7aaa90]">
            <span className="material-symbols-outlined text-5xl mb-4 block">restaurant_menu</span>
            <p className="text-lg font-medium">식단표를 준비 중입니다</p>
            <p className="text-sm mt-2">곧 이번 달 메뉴가 공개됩니다</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="weekly-menu" className="py-20 bg-gradient-to-b from-[#f7fdf9] to-[#edf7f0]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="text-[#1D9E75] text-xs tracking-[0.3em] uppercase font-medium">MONTHLY MENU</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0A1A0F] mt-3">이달의 식단표</h2>
          <p className="text-[#4a7a5e] mt-3 text-sm md:text-base">
            매주 화·목, 이런 메뉴가 새벽에 배송됩니다
          </p>
        </div>

        <div className="space-y-8">
          {weekLabels.map((weekLabel, wIdx) => (
            <div key={wIdx}>
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-[#0A1A0F] text-white text-xs font-bold rounded-full">{weekLabel}</span>
                <div className="flex-1 h-px bg-[#1D9E75]/15" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(["tue", "thu"] as const).map((dayKey) => {
                  const { salads, meals } = getScheduledMenu(wIdx + 1, dayKey);
                  return (
                    <div
                      key={dayKey}
                      className="bg-white rounded-2xl border border-[#1D9E75]/10 overflow-hidden hover:shadow-lg hover:shadow-[#1D9E75]/10 transition-all duration-300"
                    >
                      <div className="bg-gradient-to-r from-[#1D9E75] to-[#5DCAA5] px-5 py-2.5 flex items-center justify-between">
                        <span className="text-white font-bold text-lg">{dayMap[dayKey]}요일</span>
                        <span className="text-white/70 text-xs">
                          샐러드 {salads.length}종{meals.length > 0 ? ` + 간편식 ${meals.length}종` : ""}
                        </span>
                      </div>

                      <div className="p-4">
                        {salads.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[10px] font-bold text-[#1D9E75] tracking-wider mb-2 flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">eco</span>샐러드
                            </p>
                            <div className="space-y-2">
                              {salads.map((item, idx) => (
                                <MenuItemRow key={idx} item={item} />
                              ))}
                            </div>
                          </div>
                        )}
                        {meals.length > 0 && (
                          <div className="pt-3 border-t border-[#1D9E75]/10">
                            <p className="text-[10px] font-bold text-[#EF9F27] tracking-wider mb-2 flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">lunch_dining</span>간편식
                            </p>
                            <div className="space-y-2">
                              {meals.map((item, idx) => (
                                <MenuItemRow key={idx} item={item} />
                              ))}
                            </div>
                          </div>
                        )}
                        {salads.length === 0 && meals.length === 0 && (
                          <p className="text-center text-gray-300 text-sm py-4">메뉴 준비 중</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10 space-y-3">
          <p className="text-[#7aaa90] text-xs">* 식단은 재료 수급에 따라 변경될 수 있습니다</p>
          <Link
            href="/subscribe?plan=subscription"
            className="inline-block px-8 py-3 bg-[#1D9E75] text-white rounded-full font-semibold hover:bg-[#167A5B] hover:shadow-lg hover:shadow-[#1D9E75]/30 hover:-translate-y-0.5 transition-all duration-300"
          >
            이 식단으로 구독 시작하기
          </Link>
        </div>
      </div>
    </section>
  );
}

function MenuItemRow({ item }: { item: Product }) {
  return (
    <Link
      href={`/products/${item.id}`}
      className="flex gap-3 items-center group/item hover:bg-[#f0faf4] rounded-xl p-1.5 -m-1.5 transition-colors"
    >
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#e8f5ee] to-[#d4edda] flex items-center justify-center shrink-0 overflow-hidden group-hover/item:shadow-md transition-shadow">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover rounded-xl" />
        ) : (
          <span className="material-symbols-outlined text-[#1D9E75] text-xl">lunch_dining</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {item.tags && (
          <span className="text-[9px] font-bold text-[#EF9F27] tracking-wider">{item.tags}</span>
        )}
        <p className="text-[#0A1A0F] font-semibold text-sm leading-tight truncate group-hover/item:text-[#1D9E75] transition-colors">
          {item.name}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {item.originalPrice && item.originalPrice > item.price && (
          <span className="text-gray-400 text-[10px] line-through">{item.originalPrice.toLocaleString()}원</span>
        )}
        <span className="text-[#1D9E75] text-xs font-bold">{item.price.toLocaleString()}원</span>
      </div>
    </Link>
  );
}
