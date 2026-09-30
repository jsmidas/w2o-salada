"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { productBadge } from "../lib/product-badge";

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

type Category = {
  id: string;
  name: string;
  slug: string;
};

export default function MenuPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filter, setFilter] = useState("all");

  // 헤더 드롭다운에서 넘어온 ?category=<slug> 를 초기 필터로 적용
  useEffect(() => {
    const cat = new URLSearchParams(window.location.search).get("category");
    if (cat) setFilter(cat);
  }, []);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setProducts([]));
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]));
  }, []);

  const filtered =
    filter === "all"
      ? products
      : products.filter((p) => p.category.slug === filter);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f7fdf9] to-[#edf7f0]">
      {/* 헤더 */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#1D9E75]/10">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5">
            <span className="text-lg font-black text-brand-green">W2O</span>
            <span className="text-xs text-gray-400 tracking-widest">SALADA</span>
          </Link>
          <Link
            href="/#subscribe"
            className="px-5 py-2 bg-brand-green text-white text-sm font-semibold rounded-full hover:bg-[#167A5B] transition"
          >
            구독 신청
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* 타이틀 */}
        <div className="text-center mb-12">
          <span className="text-[#1D9E75] text-xs tracking-[0.3em] uppercase font-medium">
            OUR MENU
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-[#0A1A0F] mt-3">
            우리 집 식탁 메뉴
          </h1>
          <p className="text-[#4a7a5e] mt-3 text-sm md:text-base max-w-xl mx-auto">
            매주 화·목, 셰프가 차리는 한 끼 — 샐러드·간편식·반찬까지.
            구독 시 매 배송일마다 원하는 조합을 자유롭게 선택할 수 있습니다.
          </p>
        </div>

        {/* 카테고리 필터 */}
        <div className="flex justify-center gap-3 mb-10 flex-wrap">
          <button
            onClick={() => setFilter("all")}
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition ${
              filter === "all"
                ? "bg-[#1D9E75] text-white shadow-md shadow-[#1D9E75]/20"
                : "bg-white text-[#4a7a5e] border border-[#1D9E75]/20 hover:bg-[#1D9E75]/10"
            }`}
          >
            전체
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilter(c.slug)}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition ${
                filter === c.slug
                  ? "bg-[#1D9E75] text-white shadow-md shadow-[#1D9E75]/20"
                  : "bg-white text-[#4a7a5e] border border-[#1D9E75]/20 hover:bg-[#1D9E75]/10"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* 상품 그리드 */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-[#7aaa90]">
            <span className="material-symbols-outlined text-5xl mb-4 block">restaurant_menu</span>
            <p className="text-lg font-medium">메뉴를 준비 중입니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((item) => (
              <Link
                key={item.id}
                href={`/products/${item.id}`}
                className="bg-white rounded-2xl overflow-hidden border border-[#1D9E75]/10 shadow-sm hover:shadow-xl hover:shadow-[#1D9E75]/10 hover:-translate-y-1 transition-all duration-300 group block"
              >
                {/* 이미지 */}
                <div className="h-52 bg-gradient-to-br from-[#e8f5ee] to-[#d4edda] flex items-center justify-center relative overflow-hidden">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-[#1D9E75]/30 text-6xl">
                      lunch_dining
                    </span>
                  )}
                  {/* 호버 오버레이 */}
                  <div className="absolute inset-0 bg-[#0A1A0F]/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <span className="px-5 py-2.5 bg-white text-[#0A1A0F] rounded-full text-sm font-semibold shadow-lg">
                      자세히 보기
                    </span>
                  </div>
                  {/* 카테고리 배지 */}
                  <span className="absolute top-3 left-3 px-3 py-1 bg-white/90 backdrop-blur-sm text-[#1D9E75] text-xs font-semibold rounded-full">
                    {item.category.name}
                  </span>
                  {productBadge(item) && (
                    <span className="absolute top-3 right-3 px-3 py-1 bg-[#EF9F27] text-white text-xs font-bold rounded-full">
                      {productBadge(item)}
                    </span>
                  )}
                </div>

                {/* 정보 */}
                <div className="p-5">
                  <h3 className="text-[#0A1A0F] font-bold text-lg">{item.name}</h3>
                  <p className="text-[#4a7a5e] text-sm mt-1.5 leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-[#7aaa90] text-sm">
                      {item.kcal ? `${item.kcal} kcal` : ""}
                    </span>
                    <div className="flex items-center gap-2">
                      {item.originalPrice && item.originalPrice > item.price && (
                        <span className="text-gray-400 text-sm line-through">
                          {item.originalPrice.toLocaleString()}원
                        </span>
                      )}
                      <span className="text-[#1D9E75] font-bold text-lg">
                        {item.price.toLocaleString()}원
                      </span>
                      {item.originalPrice && item.originalPrice > item.price && (
                        <span className="px-1.5 py-0.5 bg-red-50 text-red-500 text-xs font-bold rounded">
                          {Math.round((1 - item.price / item.originalPrice) * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* 배송 안내 */}
        <div className="mt-16 bg-white rounded-2xl border border-[#1D9E75]/10 p-8 md:p-10">
          <h2 className="text-xl font-bold text-[#0A1A0F] mb-6 text-center">이렇게 배송됩니다</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#1D9E75] to-[#5DCAA5] flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-white text-2xl">restaurant_menu</span>
              </div>
              <h3 className="font-bold text-[#0A1A0F] mb-1">자유로운 조합</h3>
              <p className="text-[#4a7a5e] text-sm">
                배송일의 메뉴 중 샐러드+샐러드,<br />
                샐러드+간편식 등 자유롭게 선택
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#1D9E75] to-[#5DCAA5] flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-white text-2xl">calendar_month</span>
              </div>
              <h3 className="font-bold text-[#0A1A0F] mb-1">미리 선택</h3>
              <p className="text-[#4a7a5e] text-sm">
                구독자는 1주~1개월 전에<br />
                배송일별 메뉴를 미리 선택
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#1D9E75] to-[#5DCAA5] flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-white text-2xl">dark_mode</span>
              </div>
              <h3 className="font-bold text-[#0A1A0F] mb-1">새벽 배송</h3>
              <p className="text-[#4a7a5e] text-sm">
                밤사이 신선하게 준비,<br />
                아침 6시 전 문 앞 도착
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
