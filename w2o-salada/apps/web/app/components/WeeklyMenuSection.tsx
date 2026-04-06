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

type CalendarDay = {
  id: string;
  date: string;
  isActive: boolean;
  menuAssignments: { productId: string; sortOrder: number; product: Product }[];
};

export default function WeeklyMenuSection() {
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [fallbackProducts, setFallbackProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const MIN_DELIVERIES = 8;

  useEffect(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const nextMonth = curMonth === 12 ? 1 : curMonth + 1;
    const nextYear = curMonth === 12 ? curYear + 1 : curYear;

    // 이번 달 + 다음 달 로드
    Promise.all([
      fetch(`/api/delivery-calendar?year=${curYear}&month=${curMonth}`).then((r) => r.json()),
      fetch(`/api/delivery-calendar?year=${nextYear}&month=${nextMonth}`).then((r) => r.json()),
    ]).then(([cur, next]) => {
      const all = [
        ...(Array.isArray(cur) ? cur : []),
        ...(Array.isArray(next) ? next : []),
      ];
      if (all.length > 0) {
        setCalendar(all);
      } else {
        fetch("/api/products")
          .then((r) => r.json())
          .then((d) => setFallbackProducts(Array.isArray(d) ? d : []))
          .catch(() => setFallbackProducts([]));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // cutoff: 내일부터 주문 가능
  const cutoffDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const hasCalendar = calendar.length > 0;
  const deliveryDays = hasCalendar
    ? calendar
        .filter((d) => d.isActive && d.menuAssignments.length > 0)
        .map((d) => ({
          date: new Date(d.date).toISOString().split("T")[0]!,
          items: d.menuAssignments.map((m) => m.product),
        }))
        .filter((d) => d.date >= cutoffDate)
        .slice(0, MIN_DELIVERIES)
    : [];

  // 폴백: 상품 자동 분배 (캘린더 데이터 없을 때)
  const fallbackDays = !hasCalendar && fallbackProducts.length > 0
    ? generateFallback(fallbackProducts)
    : [];

  const displayDays = hasCalendar ? deliveryDays : fallbackDays;

  if (loading) return null;

  if (displayDays.length === 0) {
    return (
      <section id="weekly-menu" className="py-20 bg-gradient-to-b from-[#f7fdf9] to-[#edf7f0]">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <span className="text-[#1D9E75] text-xs tracking-[0.3em] uppercase font-medium">MONTHLY MENU</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0A1A0F] mt-3">이달의 식단표</h2>
          <div className="py-16 text-[#7aaa90]">
            <span className="material-symbols-outlined text-5xl mb-4 block">restaurant_menu</span>
            <p className="text-lg font-medium">식단표를 준비 중입니다</p>
          </div>
        </div>
      </section>
    );
  }

  // 주차별 그룹핑
  const weeks = groupByWeek(displayDays);

  return (
    <section id="weekly-menu" className="py-20 bg-gradient-to-b from-[#f7fdf9] to-[#edf7f0]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="text-[#1D9E75] text-xs tracking-[0.3em] uppercase font-medium">MONTHLY MENU</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0A1A0F] mt-3">이달의 식단표</h2>
          <p className="text-[#4a7a5e] mt-3 text-sm md:text-base">
            지금 구독하면 이런 메뉴가 새벽에 배송됩니다 · {displayDays.length}회 배송
          </p>
        </div>

        <div className="space-y-8">
          {weeks.map((week, wIdx) => (
            <div key={wIdx}>
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-[#0A1A0F] text-white text-xs font-bold rounded-full">{wIdx + 1}주차</span>
                <div className="flex-1 h-px bg-[#1D9E75]/15" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {week.map((day) => {
                  const dateObj = new Date(day.date);
                  const dayLabel = dateObj.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
                  const salads = day.items.filter((p) => p.category.slug === "salad" || p.category.name.includes("샐러드"));
                  const meals = day.items.filter((p) => p.category.slug !== "salad" && !p.category.name.includes("샐러드"));

                  return (
                    <div key={day.date} className="bg-white rounded-2xl border border-[#1D9E75]/10 overflow-hidden hover:shadow-lg hover:shadow-[#1D9E75]/10 transition-all duration-300">
                      <div className="bg-gradient-to-r from-[#1D9E75] to-[#5DCAA5] px-5 py-2.5 flex items-center justify-between">
                        <span className="text-white font-bold">{dayLabel}</span>
                        <span className="text-white/70 text-xs">
                          {salads.length > 0 ? `샐러드 ${salads.length}종` : ""}
                          {salads.length > 0 && meals.length > 0 ? " + " : ""}
                          {meals.length > 0 ? `간편식 ${meals.length}종` : ""}
                        </span>
                      </div>
                      <div className="p-4">
                        {salads.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[10px] font-bold text-[#1D9E75] tracking-wider mb-2 flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">eco</span>샐러드
                            </p>
                            <div className="space-y-2">
                              {salads.map((item, idx) => <MenuItemRow key={idx} item={item} />)}
                            </div>
                          </div>
                        )}
                        {meals.length > 0 && (
                          <div className={salads.length > 0 ? "pt-3 border-t border-[#1D9E75]/10" : ""}>
                            <p className="text-[10px] font-bold text-[#EF9F27] tracking-wider mb-2 flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">lunch_dining</span>간편식
                            </p>
                            <div className="space-y-2">
                              {meals.map((item, idx) => <MenuItemRow key={idx} item={item} />)}
                            </div>
                          </div>
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
          <Link href="/subscribe?plan=subscription" className="inline-block px-8 py-3 bg-[#1D9E75] text-white rounded-full font-semibold hover:bg-[#167A5B] hover:shadow-lg hover:shadow-[#1D9E75]/30 hover:-translate-y-0.5 transition-all duration-300">
            이 식단으로 구독 시작하기
          </Link>
        </div>
      </div>
    </section>
  );
}

// 주차별 그룹핑
function groupByWeek(days: { date: string; items: Product[] }[]): { date: string; items: Product[] }[][] {
  const weeks: { date: string; items: Product[] }[][] = [];
  let currentWeek: { date: string; items: Product[] }[] = [];
  let lastWeekNum = -1;

  for (const day of days) {
    const d = new Date(day.date);
    const weekNum = Math.ceil(d.getDate() / 7);
    if (weekNum !== lastWeekNum && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(day);
    lastWeekNum = weekNum;
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);
  return weeks;
}

// 폴백: 캘린더 없을 때 상품으로 자동 생성
function generateFallback(products: Product[]) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const days: { date: string; items: Product[] }[] = [];

  let idx = 0;
  for (let d = 1; d <= lastDay; d++) {
    const dateObj = new Date(year, month, d);
    const dow = dateObj.getDay();
    if (dow === 2 || dow === 4) { // 화, 목
      const items = products.slice(0, Math.min(3, products.length));
      // 순환
      const rotated = [...items.slice(idx % items.length), ...items.slice(0, idx % items.length)].slice(0, 3);
      days.push({
        date: dateObj.toISOString().split("T")[0]!,
        items: rotated,
      });
      idx++;
    }
  }
  return days;
}

function MenuItemRow({ item }: { item: Product }) {
  return (
    <Link href={`/products/${item.id}`} className="flex gap-3 items-center group/item hover:bg-[#f0faf4] rounded-xl p-1.5 -m-1.5 transition-colors">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#e8f5ee] to-[#d4edda] flex items-center justify-center shrink-0 overflow-hidden group-hover/item:shadow-md transition-shadow">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover rounded-xl" />
        ) : (
          <span className="material-symbols-outlined text-[#1D9E75] text-xl">lunch_dining</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {item.tags && <span className="text-[9px] font-bold text-[#EF9F27] tracking-wider">{item.tags}</span>}
        <p className="text-[#0A1A0F] font-semibold text-sm leading-tight truncate group-hover/item:text-[#1D9E75] transition-colors">{item.name}</p>
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
