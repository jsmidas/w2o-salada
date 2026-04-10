"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useCart } from "../store/cart";

type Category = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  icon: string | null;
  color: string | null;
  isActive: boolean;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  originalPrice: number | null;
  price: number;
  kcal: number | null;
  tags: string | null;
  imageUrl: string | null;
  category: Category;
};

type CalendarDay = {
  id: string;
  date: string;
  isActive: boolean;
  menuAssignments: { productId: string; sortOrder: number; product: Product }[];
};

type DisplayDay = { date: string; items: Product[] };

const ALL_TAB = "__all__";
const DEFAULT_COLOR = "#1D9E75";
const DEFAULT_ICON = "restaurant";

export default function WeeklyMenuSection() {
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [fallbackProducts, setFallbackProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB);
  const [loading, setLoading] = useState(true);

  const MIN_DELIVERIES = 8;

  useEffect(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const nextMonth = curMonth === 12 ? 1 : curMonth + 1;
    const nextYear = curMonth === 12 ? curYear + 1 : curYear;

    Promise.all([
      fetch(`/api/delivery-calendar?year=${curYear}&month=${curMonth}`).then((r) => r.json()),
      fetch(`/api/delivery-calendar?year=${nextYear}&month=${nextMonth}`).then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]).then(([cur, next, cats]) => {
      const all = [
        ...(Array.isArray(cur) ? cur : []),
        ...(Array.isArray(next) ? next : []),
      ];
      setCategories(Array.isArray(cats) ? cats : []);

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

  const cutoffDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const hasCalendar = calendar.length > 0;

  const deliveryDays: DisplayDay[] = hasCalendar
    ? calendar
        .filter((d) => d.isActive && d.menuAssignments.length > 0)
        .map((d) => ({
          date: new Date(d.date).toISOString().split("T")[0]!,
          items: d.menuAssignments.map((m) => m.product),
        }))
        .filter((d) => d.date >= cutoffDate)
        .slice(0, MIN_DELIVERIES)
    : [];

  const fallbackDays = !hasCalendar && fallbackProducts.length > 0
    ? generateFallback(fallbackProducts)
    : [];

  const allDays = hasCalendar ? deliveryDays : fallbackDays;

  // 실제 식단에 쓰이는 카테고리만 추려서 탭 구성 (공개 + 상품 존재)
  const activeCategories = useMemo(() => {
    const usedIds = new Set<string>();
    allDays.forEach((d) => d.items.forEach((p) => p.category?.id && usedIds.add(p.category.id)));
    return categories
      .filter((c) => c.isActive && usedIds.has(c.id))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [allDays, categories]);

  // 탭 필터링 적용된 일자 목록
  const displayDays = useMemo(() => {
    if (activeTab === ALL_TAB) return allDays;
    return allDays
      .map((d) => ({
        date: d.date,
        items: d.items.filter((p) => p.category?.id === activeTab),
      }))
      .filter((d) => d.items.length > 0);
  }, [allDays, activeTab]);

  if (loading) return null;

  if (allDays.length === 0) {
    return (
      <section className="py-20 bg-gradient-to-b from-[#f7fdf9] to-[#edf7f0]">
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

  const weeks = groupByWeek(displayDays);

  return (
    <section id="weekly-menu" className="py-20 bg-gradient-to-b from-[#f7fdf9] to-[#edf7f0] overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-8">
          <span className="text-[#1D9E75] text-xs tracking-[0.3em] uppercase font-medium">MONTHLY MENU</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0A1A0F] mt-3">이달의 식단표</h2>
          <p className="text-[#4a7a5e] mt-3 text-sm md:text-base">
            지금 구독하면 이런 메뉴가 새벽에 배송됩니다 · {allDays.length}회 배송
          </p>
        </div>

        {/* Pill 탭 */}
        {activeCategories.length > 0 && (
          <div className="flex items-center justify-center gap-2 mb-10 flex-wrap">
            <TabButton
              active={activeTab === ALL_TAB}
              onClick={() => setActiveTab(ALL_TAB)}
              icon="restaurant_menu"
              label="전체"
              color="#0A1A0F"
            />
            {activeCategories.map((cat) => (
              <TabButton
                key={cat.id}
                active={activeTab === cat.id}
                onClick={() => setActiveTab(cat.id)}
                icon={cat.icon ?? DEFAULT_ICON}
                label={cat.name}
                color={cat.color ?? DEFAULT_COLOR}
              />
            ))}
          </div>
        )}

        {/* 주차별 카드 — 탭 변경 시 key로 리마운트하여 fadeIn */}
        <div key={activeTab} className="space-y-8 animate-[fadeInUp_0.4s_ease-out]">
          {weeks.length === 0 ? (
            <div className="text-center py-16 text-[#7aaa90]">
              <span className="material-symbols-outlined text-5xl mb-4 block">hourglass_empty</span>
              <p className="text-lg font-medium">선택한 카테고리 메뉴가 없습니다</p>
            </div>
          ) : (
            weeks.map((week, wIdx) => (
              <div key={wIdx} className="animate-[fadeInUp_0.5s_ease-out]" style={{ animationDelay: `${wIdx * 60}ms`, animationFillMode: "backwards" }}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 bg-[#0A1A0F] text-white text-xs font-bold rounded-full">{wIdx + 1}주차</span>
                  <div className="flex-1 h-px bg-[#1D9E75]/15" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {week.map((day, dIdx) => {
                    const isLoneCard = week.length === 1;
                    const isLastOdd = week.length % 2 === 1 && dIdx === week.length - 1;
                    const spanClass = isLoneCard || isLastOdd ? "md:col-span-2" : "";
                    return (
                      <DayCard key={day.date} day={day} spanClass={spanClass} activeCategories={activeCategories} />
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="text-center mt-10 space-y-3">
          <p className="text-[#7aaa90] text-xs">* 식단은 재료 수급에 따라 변경될 수 있습니다</p>
          <Link href="/subscribe?plan=subscription" className="inline-block px-8 py-3 bg-[#1D9E75] text-white rounded-full font-semibold hover:bg-[#167A5B] hover:shadow-lg hover:shadow-[#1D9E75]/30 hover:-translate-y-0.5 transition-all duration-300">
            이 식단으로 구독 시작하기
          </Link>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
}

function TabButton({ active, onClick, icon, label, color }: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
        active
          ? "text-white shadow-lg scale-105"
          : "text-[#4a7a5e] bg-white border border-[#1D9E75]/15 hover:border-[#1D9E75]/40 hover:scale-105"
      }`}
      style={active ? { backgroundColor: color, boxShadow: `0 8px 24px -8px ${color}` } : undefined}
    >
      <span className="material-symbols-outlined text-lg">{icon}</span>
      {label}
    </button>
  );
}

function DayCard({ day, spanClass, activeCategories }: {
  day: DisplayDay;
  spanClass: string;
  activeCategories: Category[];
}) {
  const dateObj = new Date(day.date);
  const dayLabel = dateObj.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });

  // 카테고리별 그룹핑 (활성 카테고리 순서대로)
  const groupedMap = new Map<string, { category: Category; items: Product[] }>();
  for (const item of day.items) {
    if (!item.category) continue;
    const key = item.category.id;
    if (!groupedMap.has(key)) {
      groupedMap.set(key, { category: item.category, items: [] });
    }
    groupedMap.get(key)!.items.push(item);
  }

  const grouped = Array.from(groupedMap.values()).sort((a, b) => {
    const aIdx = activeCategories.findIndex((c) => c.id === a.category.id);
    const bIdx = activeCategories.findIndex((c) => c.id === b.category.id);
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

  const summaryText = grouped
    .map((g) => `${g.category.name} ${g.items.length}종`)
    .join(" + ");

  return (
    <div className={`bg-white rounded-2xl border border-[#1D9E75]/10 overflow-hidden hover:shadow-lg hover:shadow-[#1D9E75]/10 hover:-translate-y-0.5 transition-all duration-300 ${spanClass}`}>
      <div className="bg-gradient-to-r from-[#1D9E75] to-[#5DCAA5] px-5 py-2.5 flex items-center justify-between">
        <span className="text-white font-bold">{dayLabel}</span>
        <span className="text-white/80 text-xs">{summaryText}</span>
      </div>
      <div className="p-4 space-y-3">
        {grouped.map((group, gIdx) => {
          const color = group.category.color ?? DEFAULT_COLOR;
          const icon = group.category.icon ?? DEFAULT_ICON;
          return (
            <div key={group.category.id} className={gIdx > 0 ? "pt-3 border-t border-[#1D9E75]/10" : ""}>
              <p className="text-[10px] font-bold tracking-wider mb-2 flex items-center gap-1" style={{ color }}>
                <span className="material-symbols-outlined text-sm">{icon}</span>
                {group.category.name}
              </p>
              <div className="space-y-2">
                {group.items.map((item, idx) => <MenuItemRow key={idx} item={item} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function groupByWeek(days: DisplayDay[]): DisplayDay[][] {
  const weeks: DisplayDay[][] = [];
  let currentWeek: DisplayDay[] = [];
  let lastKey = "";

  for (const day of days) {
    const d = new Date(day.date);
    // 월요일 기준 주 시작일을 key로 사용 (일요일=0 → 월요일까지 -6, 그 외 → -(dow-1))
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    const key = `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;

    if (key !== lastKey && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(day);
    lastKey = key;
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);
  return weeks;
}

function generateFallback(products: Product[]): DisplayDay[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const days: DisplayDay[] = [];

  let idx = 0;
  for (let d = 1; d <= lastDay; d++) {
    const dateObj = new Date(year, month, d);
    const dow = dateObj.getDay();
    if (dow === 2 || dow === 4) {
      const items = products.slice(0, Math.min(3, products.length));
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
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      productId: item.id,
      name: item.name,
      price: item.originalPrice && item.originalPrice > item.price ? item.originalPrice : item.price,
      imageUrl: item.imageUrl,
      quantity: 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="flex gap-3 items-center group/item hover:bg-[#f0faf4] rounded-xl p-1.5 -m-1.5 transition-colors">
      <Link href={`/products/${item.id}`} className="flex gap-3 items-center flex-1 min-w-0">
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
      <button
        type="button"
        onClick={handleAddToCart}
        className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
          added
            ? "bg-[#1D9E75] text-white"
            : "bg-[#1D9E75]/10 text-[#1D9E75] hover:bg-[#1D9E75]/20"
        }`}
        title="장바구니 담기"
      >
        <span className="material-symbols-outlined text-lg">{added ? "check" : "add_shopping_cart"}</span>
      </button>
    </div>
  );
}
