"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCart } from "../store/cart";

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  isOption?: boolean;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  originalPrice: number | null;
  singlePrice: number | null;
  price: number;
  imageUrl: string | null;
  tags: string | null;
  category: Category;
};

type CalendarDay = {
  id: string;
  date: string;
  isActive: boolean;
  menuAssignments: { productId: string; sortOrder: number; product: Product }[];
};

type DayGroup = { date: string; items: Product[] };

const TASTE_DELIVERIES = 2;

export default function TrialPage() {
  const [days, setDays] = useState<DayGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [minAmount, setMinAmount] = useState(11000);

  const updateQuantity = useCart((s) => s.updateQuantity);
  const items = useCart((s) => s.items);
  const clearCart = useCart((s) => s.clearCart);

  // 다음 2회차 배송일 + 메뉴 로드
  useEffect(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const nextMonth = curMonth === 12 ? 1 : curMonth + 1;
    const nextYear = curMonth === 12 ? curYear + 1 : curYear;

    const cutoff = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();

    Promise.all([
      fetch(`/api/delivery-calendar?year=${curYear}&month=${curMonth}`).then((r) => r.json()),
      fetch(`/api/delivery-calendar?year=${nextYear}&month=${nextMonth}`).then((r) => r.json()),
      fetch("/api/settings/public").then((r) => r.json()),
    ])
      .then(([cur, next, setJson]) => {
        const all: CalendarDay[] = [
          ...(Array.isArray(cur) ? cur : []),
          ...(Array.isArray(next) ? next : []),
        ];
        const upcoming = all
          .filter((d) => d.isActive && d.menuAssignments.length > 0)
          .map((d) => ({
            date: new Date(d.date).toISOString().split("T")[0]!,
            items: d.menuAssignments.map((m) => m.product),
          }))
          .filter((d) => d.date >= cutoff)
          .slice(0, TASTE_DELIVERIES);
        setDays(upcoming);
        setMinAmount(Number(setJson?.minOrderAmount ?? 11000));
      })
      .finally(() => setLoading(false));
  }, []);

  // 이 페이지에서 담은 라인(=이 2회차 배송에 속한 라인)만 집계
  const trialDateSet = useMemo(() => new Set(days.map((d) => d.date)), [days]);
  const trialLines = items.filter((i) => i.deliveryDate && trialDateSet.has(i.deliveryDate));
  const trialBaseTotal = trialLines
    .filter((i) => !i.isOption)
    .reduce((sum, i) => sum + i.price * i.quantity, 0);
  const trialCount = trialLines.reduce((sum, i) => sum + i.quantity, 0);
  const meetsMin = trialBaseTotal >= minAmount;

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-dark flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-brand-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-dark pb-40 lg:pb-0">
      {/* 상단 헤더 */}
      <header className="sticky top-0 z-40 bg-brand-deep/95 backdrop-blur border-b border-white/5">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="text-white/70 hover:text-white">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="text-white font-bold text-sm">구독 맛보기</h1>
          <div className="w-6" />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-5 pt-6 lg:grid lg:grid-cols-[1fr_380px] lg:gap-6 lg:items-start">
        {/* ── 좌측: 메뉴 선택 ── */}
        <div className="min-w-0">
          {/* 인트로 */}
          <div className="flex items-start gap-3 mb-6 p-4 rounded-2xl bg-white/5 border border-white/10">
            <span className="material-symbols-outlined text-brand-green text-2xl shrink-0">shopping_bag</span>
            <div>
              <h2 className="text-white text-lg font-black mb-0.5">다음 {TASTE_DELIVERIES}회차에서 골라보세요</h2>
              <p className="text-white/60 text-xs leading-relaxed">
                원하는 메뉴를 담으면 다음 배송에 맞춰 한 끼 체험할 수 있어요. 정기구독 없이 한 번만 결제하세요.
              </p>
            </div>
          </div>

          {days.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <span className="material-symbols-outlined text-5xl mb-3 block text-white/10">hourglass_empty</span>
              <p>현재 예정된 배송 메뉴가 없어요.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {days.map((day) => (
                <DayCard key={day.date} day={day} />
              ))}
            </div>
          )}

          <p className="text-gray-500 text-[11px] text-center mt-6 lg:text-left">
            이미지를 누르면 상품 상세로 이동하고, 메뉴 영역을 누르면 장바구니에 담깁니다
          </p>
        </div>

        {/* ── 우측: 결제 패널 (데스크탑만) ── */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#1D9E75] to-[#5DCAA5] px-5 py-3 flex items-center justify-between">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-base">receipt_long</span>
                실시간 결제
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-white/80 text-xs">{trialCount}개 선택</span>
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("장바구니를 모두 비울까요?")) clearCart();
                    }}
                    className="text-white/70 hover:text-white text-[10px] underline"
                    title="장바구니 전체 비우기"
                  >
                    비우기
                  </button>
                )}
              </div>
            </div>

            {/* 선택 목록 */}
            <div className="p-4 max-h-[50vh] overflow-y-auto">
              {trialLines.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <span className="material-symbols-outlined text-4xl mb-2 block text-white/10">shopping_bag</span>
                  <p className="text-xs">왼쪽에서 메뉴를 담아보세요</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {trialLines.map((line) => {
                    const dateLabel = line.deliveryDate
                      ? new Date(line.deliveryDate).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" })
                      : "";
                    return (
                      <li key={`${line.productId}::${line.deliveryDate ?? ""}`} className="bg-white/5 rounded-lg p-2.5">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-xs font-semibold truncate">{line.name}</p>
                            <p className="text-[#5DCAA5] text-[10px] font-bold mt-0.5">{dateLabel} 배송</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateQuantity(line.productId, 0, line.deliveryDate)}
                            className="shrink-0 w-5 h-5 text-gray-500 hover:text-red-400 transition flex items-center justify-center"
                            title="제거"
                          >
                            <span className="material-symbols-outlined text-base">close</span>
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <div className="flex items-center gap-1 bg-[#1D9E75] rounded px-1 py-0.5">
                            <button
                              type="button"
                              onClick={() => updateQuantity(line.productId, line.quantity - 1, line.deliveryDate)}
                              className="w-5 h-5 text-white hover:bg-white/20 rounded flex items-center justify-center"
                              title="-"
                            >
                              <span className="material-symbols-outlined text-sm">remove</span>
                            </button>
                            <span className="text-white text-xs font-bold min-w-[14px] text-center">{line.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(line.productId, line.quantity + 1, line.deliveryDate)}
                              className="w-5 h-5 text-white hover:bg-white/20 rounded flex items-center justify-center"
                              title="+"
                            >
                              <span className="material-symbols-outlined text-sm">add</span>
                            </button>
                          </div>
                          <span className="text-white text-xs font-bold">{(line.price * line.quantity).toLocaleString()}원</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* 합계 + 게이지 + CTA */}
            <div className="border-t border-white/10 p-4 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">본품 합계</span>
                <span className={meetsMin ? "text-white font-bold" : "text-red-400 font-bold"}>
                  {trialBaseTotal.toLocaleString()}원
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${meetsMin ? "bg-brand-green" : "bg-red-400"}`}
                  style={{ width: `${Math.min(100, (trialBaseTotal / minAmount) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-gray-500">
                <span>최소 {minAmount.toLocaleString()}원</span>
                <span>{meetsMin ? "✓ 충족" : `${(minAmount - trialBaseTotal).toLocaleString()}원 부족`}</span>
              </div>
              <Link
                href="/checkout"
                aria-disabled={!meetsMin}
                className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm transition mt-2 ${
                  meetsMin
                    ? "bg-brand-amber text-white hover:opacity-90 shadow-lg shadow-[#EF9F27]/30"
                    : "bg-white/10 text-gray-500 cursor-not-allowed pointer-events-none"
                }`}
              >
                <span className="material-symbols-outlined text-lg">shopping_cart_checkout</span>
                {meetsMin ? "바로 결제하기" : "메뉴를 더 담아주세요"}
              </Link>
              {items.length > trialLines.length && (
                <p className="text-[10px] text-gray-500 text-center">
                  다른 페이지 라인 {items.length - trialLines.length}개가 장바구니에 함께 있습니다
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ── Sticky 하단 바 (모바일 전용) ── */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-brand-deep/95 backdrop-blur border-t border-white/10 z-50">
        <div className="max-w-2xl mx-auto px-5 py-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">
              본품 합계 {trialCount > 0 && <span className="text-white/60">· {trialCount}개</span>}
            </span>
            <span className={meetsMin ? "text-white font-bold" : "text-red-400 font-bold"}>
              {trialBaseTotal.toLocaleString()}원{" "}
              {meetsMin ? "✓ 최소 충족" : `· ${(minAmount - trialBaseTotal).toLocaleString()}원 부족`}
            </span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full transition-all ${meetsMin ? "bg-brand-green" : "bg-red-400"}`}
              style={{ width: `${Math.min(100, (trialBaseTotal / minAmount) * 100)}%` }}
            />
          </div>
          <Link
            href="/checkout"
            aria-disabled={!meetsMin}
            className={`flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-base transition ${
              meetsMin
                ? "bg-brand-amber text-white hover:opacity-90 shadow-lg shadow-[#EF9F27]/20"
                : "bg-white/10 text-gray-500 cursor-not-allowed pointer-events-none"
            }`}
          >
            <span className="material-symbols-outlined text-xl">shopping_cart_checkout</span>
            {meetsMin ? "바로 결제하기" : "메뉴를 더 담아주세요"}
          </Link>
        </div>
      </div>
    </div>
  );
}

function DayCard({ day }: { day: DayGroup }) {
  const dateLabel = new Date(day.date).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  // 카테고리별 그룹
  const groupedMap = new Map<string, { category: Category; items: Product[] }>();
  for (const item of day.items) {
    if (!item.category) continue;
    const key = item.category.id;
    if (!groupedMap.has(key)) groupedMap.set(key, { category: item.category, items: [] });
    groupedMap.get(key)!.items.push(item);
  }
  const grouped = Array.from(groupedMap.values());

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-[#1D9E75] to-[#5DCAA5] px-5 py-2.5">
        <span className="text-white font-bold">{dateLabel}</span>
      </div>
      <div className="p-4 space-y-3">
        {grouped.map((g, gIdx) => (
          <div key={`${day.date}-${g.category.id ?? gIdx}`} className={gIdx > 0 ? "pt-3 border-t border-white/10" : ""}>
            <p className="text-[10px] font-bold tracking-wider mb-2 flex items-center gap-1" style={{ color: g.category.color ?? "#5DCAA5" }}>
              <span className="material-symbols-outlined text-sm">{g.category.icon ?? "restaurant"}</span>
              {g.category.name}
            </p>
            <div className="space-y-2">
              {g.items.map((item, iIdx) => (
                <TrialItemRow key={`${day.date}-${item.id}-${iIdx}`} item={item} deliveryDate={day.date} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrialItemRow({ item, deliveryDate }: { item: Product; deliveryDate: string }) {
  const addItem = useCart((s) => s.addItem);
  const updateQuantity = useCart((s) => s.updateQuantity);
  const inCart = useCart((s) =>
    s.items.find((i) => i.productId === item.id && (i.deliveryDate ?? "") === deliveryDate),
  );
  const quantity = inCart?.quantity ?? 0;

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleAdd = (e: React.MouseEvent) => {
    stop(e);
    addItem({
      productId: item.id,
      name: item.name,
      // 단건 주문 (맛보기): singlePrice 우선, 없으면 구독가(price)
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
        {item.tags && <span className="text-[9px] font-bold text-[#5DCAA5] tracking-wider">{item.tags}</span>}
        <p className="text-white font-semibold text-sm leading-tight truncate">{item.name}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {item.originalPrice && item.originalPrice > item.price && (
          <span className="text-gray-500 text-[10px] line-through">{item.originalPrice.toLocaleString()}원</span>
        )}
        <span className="text-white text-xs font-bold">{item.price.toLocaleString()}원</span>
      </div>
    </>
  );

  return (
    <div className="flex gap-3 items-center hover:bg-white/5 rounded-xl p-1.5 -m-1.5 transition-colors">
      <Link
        href={`/products/${item.id}`}
        className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0 overflow-hidden hover:shadow-md transition-shadow"
        aria-label={`${item.name} 상세보기`}
      >
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover rounded-xl" width={48} height={48} decoding="async" />
        ) : (
          <span className="material-symbols-outlined text-white/30 text-xl">lunch_dining</span>
        )}
      </Link>

      {quantity === 0 ? (
        <button
          type="button"
          onClick={handleAdd}
          className="flex flex-1 min-w-0 items-center gap-3 group/add hover:bg-[#1D9E75]/10 rounded-lg px-2 -mx-2 py-1 transition-colors"
          title={`${item.name} 장바구니 담기`}
        >
          {NameAndPrice}
          <span className="shrink-0 w-9 h-9 rounded-lg bg-[#1D9E75] text-white flex items-center justify-center group-hover/add:bg-[#5DCAA5] transition-colors">
            <span className="material-symbols-outlined text-lg">add_shopping_cart</span>
          </span>
        </button>
      ) : (
        <>
          <div className="flex flex-1 min-w-0 items-center gap-3 px-2 -mx-2">{NameAndPrice}</div>
          <div className="shrink-0 flex items-center gap-1 bg-[#1D9E75] rounded-lg px-1.5 py-1">
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
