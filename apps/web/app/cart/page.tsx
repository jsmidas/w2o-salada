"use client";

import Link from "next/link";
import useSWR from "swr";
import { useCart } from "../store/cart";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function CartPage() {
  const { items, removeItem, updateQuantity, clearCart, totalPrice, baseTotalPrice } = useCart();
  const { data: settings } = useSWR<{
    minOrderAmount: string;
    deliveryFee: string;
    freeShippingMin: string;
  }>("/api/settings/public", fetcher, { revalidateOnFocus: false });
  const minOrderAmount = settings ? Number(settings.minOrderAmount) : 11000;
  const baseDeliveryFee = settings ? Number(settings.deliveryFee) : 0;
  const freeShippingMin = settings ? Number(settings.freeShippingMin) : 11000;

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center">
        <span className="material-symbols-outlined text-6xl text-white/10 mb-4">shopping_cart</span>
        <p className="text-gray-400 mb-6">장바구니가 비어있습니다.</p>
        <Link
          href="/#weekly-menu"
          className="px-6 py-3 bg-brand-green text-white rounded-full font-semibold hover:bg-brand-mint transition"
        >
          메뉴 보러 가기
        </Link>
      </div>
    );
  }

  // 최소 주문액은 "1회 배송" 기준 — 배송일마다 본품 합계를 따로 본다. 결제는 한 번에.
  // 키 "" = 배송일 미지정(상품 상세에서 담음) → 가장 빠른 배송일로 간다
  const dateKeys = Array.from(new Set(items.map((i) => i.deliveryDate ?? ""))).sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
  const perDate = dateKeys.map((k) => {
    const lines = items.filter((i) => (i.deliveryDate ?? "") === k);
    const total = lines.reduce((s, i) => s + i.price * i.quantity, 0);
    const base = lines.filter((i) => !i.isOption).reduce((s, i) => s + i.price * i.quantity, 0);
    return { key: k, total, base, shortfall: Math.max(0, minOrderAmount - base), fee: total >= freeShippingMin ? 0 : baseDeliveryFee };
  });
  const deliveryFee = perDate.reduce((s, d) => s + d.fee, 0);
  const finalTotal = totalPrice() + deliveryFee;
  const dateLabelOf = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" }) : "가장 빠른 배송일";

  // 본품 합계 기반 최소 주문액 검증 (배송일별)
  const baseTotal = baseTotalPrice();
  const shortDates = perDate.filter((d) => d.shortfall > 0);
  const shortfall = shortDates.reduce((s, d) => s + d.shortfall, 0);
  const canOrder = shortDates.length === 0;

  return (
    <div className="min-h-screen bg-brand-dark">
      {/* 헤더 */}
      <header className="sticky top-0 z-50 bg-brand-deep/95 backdrop-blur border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5">
            <span className="text-lg font-black text-brand-green">W2O</span>
            <span className="text-xs text-white/50 tracking-widest">SALADA</span>
          </Link>
          <h1 className="text-white font-bold">장바구니</h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* 상품 목록 */}
        <div className="space-y-4 mb-8">
          {items.map((item) => {
            const dateLabel = item.deliveryDate
              ? new Date(item.deliveryDate).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })
              : null;
            return (
            <div
              key={`${item.productId}::${item.deliveryDate ?? ""}`}
              className="bg-white/5 rounded-xl p-4 border border-white/10 flex gap-4"
            >
              {/* 이미지 */}
              <div className="w-20 h-20 bg-white/5 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-white/10 text-3xl">lunch_dining</span>
                )}
              </div>

              {/* 정보 */}
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-white font-bold">{item.name}</h3>
                    {dateLabel && (
                      <span className="inline-block mt-0.5 px-2 py-0.5 bg-brand-amber/15 text-brand-amber text-[10px] font-bold rounded">
                        {dateLabel} 배송
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeItem(item.productId, item.deliveryDate)}
                    className="text-gray-500 hover:text-red-400 transition"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
                <p className="text-brand-amber font-bold mt-1">
                  {item.price.toLocaleString()}원
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity - 1, item.deliveryDate)}
                    className="w-7 h-7 rounded border border-white/20 text-white text-sm flex items-center justify-center hover:bg-white/10"
                  >
                    -
                  </button>
                  <span className="text-white font-bold">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity + 1, item.deliveryDate)}
                    className="w-7 h-7 rounded border border-white/20 text-white text-sm flex items-center justify-center hover:bg-white/10"
                  >
                    +
                  </button>
                  <span className="text-gray-400 text-sm ml-auto">
                    {(item.price * item.quantity).toLocaleString()}원
                  </span>
                </div>
              </div>
            </div>
            );
          })}
        </div>

        {/* 비우기 */}
        <div className="flex justify-end mb-8">
          <button
            onClick={clearCart}
            className="text-gray-500 text-sm hover:text-gray-300 transition"
          >
            장바구니 비우기
          </button>
        </div>

        {/* 결제 요약 */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h3 className="text-white font-bold mb-4">결제 요약</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">본품 금액 (샐러드·간편식·반찬)</span>
              <span className="text-white">{baseTotal.toLocaleString()}원</span>
            </div>
            {totalPrice() !== baseTotal && (
              <div className="flex justify-between">
                <span className="text-gray-400">옵션 (음료·유산균 등)</span>
                <span className="text-white">{(totalPrice() - baseTotal).toLocaleString()}원</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">배송비</span>
              <span className={deliveryFee === 0 ? "text-brand-green" : "text-white"}>
                {deliveryFee === 0 ? "무료" : `${deliveryFee.toLocaleString()}원`}
              </span>
            </div>
            {deliveryFee > 0 && (
              <p className="text-xs text-gray-500">
                배송일별 상품 금액이 {freeShippingMin.toLocaleString()}원 이상이면 그 배송은 무료배송!
              </p>
            )}
            <div className="pt-3 border-t border-white/10 flex justify-between">
              <span className="text-white font-bold">총 결제 금액</span>
              <span className="text-brand-amber text-xl font-black">
                {finalTotal.toLocaleString()}원
              </span>
            </div>
          </div>

          {/* 최소 주문액 안내 */}
          {!canOrder && (
            <div className="mt-5 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
              <p className="text-red-300 text-sm font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-base">info</span>
                최소 주문액 미달
              </p>
              <p className="text-red-200/80 text-xs mt-1 leading-relaxed">
                배송일마다 본품(샐러드·간편식·반찬)이 <b>{minOrderAmount.toLocaleString()}원</b> 이상이어야 주문 가능합니다.
                {shortDates.map((d) => (
                  <span key={d.key || "__none"} className="block">
                    {dateLabelOf(d.key)} 배송분: <b className="text-red-100">{d.shortfall.toLocaleString()}원</b> 더 담아주세요.
                  </span>
                ))}
                <span className="text-red-300/60">(음료·유산균 등 옵션 상품은 최소액 계산에서 제외됩니다)</span>
              </p>
            </div>
          )}
          {canOrder && baseTotal > 0 && (
            <p className="mt-4 text-xs text-brand-green/80 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              최소 주문액 {minOrderAmount.toLocaleString()}원 충족
            </p>
          )}

          {canOrder ? (
            <Link
              href="/checkout"
              className="block w-full mt-6 py-3.5 bg-brand-amber text-white rounded-xl font-bold text-lg hover:opacity-90 transition text-center"
            >
              주문하기
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="block w-full mt-6 py-3.5 bg-white/10 text-white/40 rounded-xl font-bold text-lg cursor-not-allowed text-center"
            >
              주문하기 (본품 {shortfall.toLocaleString()}원 부족)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
