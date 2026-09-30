"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useCart } from "../store/cart";
import Image from "next/image";
import { firstOrderableDate } from "../lib/cutoff";
import { productBadge } from "../lib/product-badge";

type Category = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  icon: string | null;
  color: string | null;
  isActive: boolean;
  isOption?: boolean;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  originalPrice: number | null;
  singlePrice: number | null;
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
  substituteWeekday?: number | null; // 휴일 대체 배송일이면 원래 요일 (0=일~6=토)
  menuAssignments: { productId: string; sortOrder: number; product: Product }[];
};

type DisplayDay = { date: string; items: Product[]; substituteWeekday?: number | null };

// 정규 배송 요일(화·목). 이 밖의 요일에 나가는 배송은 휴일 대체 배송으로 표시한다
const REGULAR_WEEKDAYS = [2, 4];
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

const ALL_TAB = "__all__";
const DEFAULT_COLOR = "#1D9E75";
const DEFAULT_ICON = "restaurant";

type InitialMenuData = {
  calendar: CalendarDay[];
  categories: Category[];
};

export default function WeeklyMenuSection({ initialData }: { initialData?: InitialMenuData }) {
  const [calendar, setCalendar] = useState<CalendarDay[]>(initialData?.calendar ?? []);
  const [fallbackProducts, setFallbackProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>(initialData?.categories ?? []);
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB);
  const [loading, setLoading] = useState(!initialData);

  const MIN_DELIVERIES = 8;

  useEffect(() => {
    if (initialData) return;
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
  }, [initialData]);

  // 배송 전날 14:00 마감 — 마감된 배송일은 목록에서 빼고 보여준다
  const cutoffDate = firstOrderableDate();

  const hasCalendar = calendar.length > 0;

  const deliveryDays: DisplayDay[] = hasCalendar
    ? calendar
        .filter((d) => d.isActive && d.menuAssignments.length > 0)
        .map((d) => ({
          date: new Date(d.date).toISOString().split("T")[0]!,
          items: d.menuAssignments.map((m) => m.product),
          substituteWeekday: d.substituteWeekday ?? null,
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
        ...d,
        items: d.items.filter((p) => p.category?.id === activeTab),
      }))
      .filter((d) => d.items.length > 0);
  }, [allDays, activeTab]);

  if (loading) return null;

  if (allDays.length === 0) {
    return (
      <section className="py-20 bg-gradient-to-b from-[#f7fdf9] to-[#edf7f0]">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <span className="text-[#1D9E75] text-xs tracking-[0.3em] uppercase font-medium">W2O · WEEKLY</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0A1A0F] mt-3">Weekly 식단</h2>
          <div className="py-16 text-[#7aaa90]">
            <span className="material-symbols-outlined text-5xl mb-4 block">restaurant_menu</span>
            <p className="text-lg font-medium">식단을 준비 중입니다</p>
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
          <span className="text-[#1D9E75] text-xs tracking-[0.3em] uppercase font-medium">W2O · WEEKLY</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0A1A0F] mt-3">Weekly 식단</h2>
          <p className="text-[#4a7a5e] mt-3 text-sm md:text-base font-medium">
            매주 새롭게, 6주 앞까지 미리 확정
          </p>
          <p className="text-[#7aaa90] mt-1 text-xs md:text-sm">
            지금 구독하면 이 중에서 골라 담아요 · 이번 시즌 {allDays.length}회 배송
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
          <Link href="/subscribe" className="inline-block px-8 py-3 bg-[#1D9E75] text-white rounded-full font-semibold hover:bg-[#167A5B] hover:shadow-lg hover:shadow-[#1D9E75]/30 hover:-translate-y-0.5 transition-all duration-300">
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
  // 화·목이 아닌 날에 나가거나 관리자가 대체 요일을 지정한 날은 "휴일 대체 배송"으로 안내한다
  const isSubstitute = day.substituteWeekday != null || !REGULAR_WEEKDAYS.includes(dateObj.getUTCDay());
  const substituteLabel = isSubstitute
    ? `휴일 대체 배송${day.substituteWeekday != null ? ` · ${WEEKDAY_LABELS[day.substituteWeekday]}요일분` : ""}`
    : null;

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
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-white font-bold">{dayLabel}</span>
          {substituteLabel && (
            <span className="px-2 py-0.5 rounded-full bg-[#EF9F27] text-white text-[10px] font-bold whitespace-nowrap">
              {substituteLabel}
            </span>
          )}
        </span>
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
                {group.items.map((item, idx) => <MenuItemRow key={idx} item={item} deliveryDate={day.date} />)}
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

function MenuItemRow({ item, deliveryDate }: { item: Product; deliveryDate: string }) {
  const addItem = useCart((s) => s.addItem);
  const updateQuantity = useCart((s) => s.updateQuantity);
  const inCart = useCart((s) =>
    s.items.find((i) => i.productId === item.id && (i.deliveryDate ?? "") === deliveryDate),
  );
  const quantity = inCart?.quantity ?? 0;

  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };

  const handleAddToCart = (e: React.MouseEvent) => {
    stop(e);
    addItem({
      productId: item.id,
      name: item.name,
      // 단건 주문: singlePrice 우선, 없으면 구독가(price) 사용
      price: item.singlePrice ?? item.price,
      imageUrl: item.imageUrl,
      quantity: 1,
      deliveryDate,
      isOption: item.category?.isOption ?? false,
    });
  };

  const handleDec = (e: React.MouseEvent) => {
    stop(e);
    updateQuantity(item.id, quantity - 1, deliveryDate);
  };
  const handleInc = (e: React.MouseEvent) => {
    stop(e);
    updateQuantity(item.id, quantity + 1, deliveryDate);
  };

  const NameAndPrice = (
    <>
      <div className="min-w-0 flex-1">
        {productBadge(item) && <span className="text-[9px] font-bold text-[#EF9F27] tracking-wider">{productBadge(item)}</span>}
        <p className="text-[#0A1A0F] font-semibold text-sm leading-tight truncate">{item.name}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {item.originalPrice && item.originalPrice > item.price && (
          <span className="text-gray-400 text-[10px] line-through">{item.originalPrice.toLocaleString()}원</span>
        )}
        <span className="text-[#1D9E75] text-xs font-bold">{item.price.toLocaleString()}원</span>
      </div>
    </>
  );

  return (
    <div className="flex gap-3 items-center hover:bg-[#f0faf4] rounded-xl p-1.5 -m-1.5 transition-colors">
      {/* 이미지: 상품 상세로만 이동 */}
      <Link
        href={`/products/${item.id}`}
        className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#e8f5ee] to-[#d4edda] flex items-center justify-center shrink-0 overflow-hidden hover:shadow-md transition-shadow"
        aria-label={`${item.name} 상세보기`}
      >
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt={item.name} width={48} height={48} className="w-full h-full object-cover rounded-xl" />
        ) : (
          <span className="material-symbols-outlined text-[#1D9E75] text-xl">lunch_dining</span>
        )}
      </Link>

      {quantity === 0 ? (
        // 담기 전: 한 개의 큰 버튼 (텍스트 + 가격 + amber 장바구니 아이콘)
        <button
          type="button"
          onClick={handleAddToCart}
          className="flex flex-1 min-w-0 items-center gap-3 group/add hover:bg-[#fff6e5] rounded-lg px-2 -mx-2 py-1 transition-colors"
          title={`${item.name} 장바구니 담기`}
        >
          {NameAndPrice}
          <span className="shrink-0 w-9 h-9 rounded-lg bg-brand-amber text-white flex items-center justify-center shadow-md shadow-[#EF9F27]/30 group-hover/add:scale-110 transition-transform">
            <span className="material-symbols-outlined text-lg">add_shopping_cart</span>
          </span>
        </button>
      ) : (
        // 담은 후: 텍스트는 표시만, 우측에 amber 스테퍼
        <>
          <div className="flex flex-1 min-w-0 items-center gap-3 px-2 -mx-2">{NameAndPrice}</div>
          <div className="shrink-0 flex items-center gap-1 bg-brand-amber rounded-lg px-1.5 py-1 shadow-md shadow-[#EF9F27]/30">
            <button
              type="button"
              onClick={handleDec}
              className="w-7 h-7 rounded-md bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition"
              title="수량 감소"
            >
              <span className="material-symbols-outlined text-base">remove</span>
            </button>
            <span className="text-white text-sm font-bold min-w-[16px] text-center">{quantity}</span>
            <button
              type="button"
              onClick={handleInc}
              className="w-7 h-7 rounded-md bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition"
              title="수량 증가"
            >
              <span className="material-symbols-outlined text-base">add</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
