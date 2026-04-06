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

const dayLabels = ["화", "목"];

export default function WeeklyMenuSection() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setProducts([]));
  }, []);

  // 상품을 2개씩 묶어서 요일별 식단으로 표시 (데모용)
  const weeklyMenu = dayLabels.map((day, i) => {
    const startIdx = (i * 2) % Math.max(products.length, 1);
    const items = products.length >= 2
      ? [products[startIdx % products.length], products[(startIdx + 1) % products.length]]
      : [];
    return { day, items };
  });

  return (
    <section id="weekly-menu" className="py-20 bg-gradient-to-b from-[#f7fdf9] to-[#edf7f0]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="text-[#1D9E75] text-xs tracking-[0.3em] uppercase font-medium">
            WEEKLY MENU
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0A1A0F] mt-3">
            이번 주 식단표
          </h2>
          <p className="text-[#4a7a5e] mt-3 text-sm md:text-base">
            이런 메뉴가 새벽에 배송됩니다
          </p>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-16 text-[#7aaa90]">
            <span className="material-symbols-outlined text-5xl mb-4 block">restaurant_menu</span>
            <p className="text-lg font-medium">식단표를 준비 중입니다</p>
            <p className="text-sm mt-2">곧 이번 주 메뉴가 공개됩니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {weeklyMenu.map(({ day, items }) => (
              <div
                key={day}
                className="bg-white rounded-2xl border border-[#1D9E75]/10 overflow-hidden hover:shadow-lg hover:shadow-[#1D9E75]/10 hover:-translate-y-1 transition-all duration-300"
              >
                {/* 요일 헤더 */}
                <div className="bg-gradient-to-r from-[#1D9E75] to-[#5DCAA5] px-4 py-2.5 text-center">
                  <span className="text-white font-bold text-lg">{day}요일</span>
                </div>

                {/* 메뉴 2종 */}
                <div className="p-4 space-y-3">
                  {items.map((item, idx) => item && (
                    <Link key={idx} href={`/products/${item.id}`} className="flex gap-3 items-start group/item hover:bg-[#f0faf4] rounded-xl p-1.5 -m-1.5 transition-colors">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#e8f5ee] to-[#d4edda] flex items-center justify-center shrink-0 overflow-hidden group-hover/item:shadow-md transition-shadow">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          <span className="material-symbols-outlined text-[#1D9E75] text-2xl">lunch_dining</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        {item.tags && (
                          <span className="text-[10px] font-bold text-[#EF9F27] tracking-wider">{item.tags}</span>
                        )}
                        <p className="text-[#0A1A0F] font-semibold text-sm leading-tight truncate group-hover/item:text-[#1D9E75] transition-colors">{item.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {item.originalPrice && item.originalPrice > item.price && (
                            <span className="text-gray-400 text-[10px] line-through">{item.originalPrice.toLocaleString()}원</span>
                          )}
                          <span className="text-[#1D9E75] text-xs font-bold">{item.price.toLocaleString()}원</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-[#7aaa90] text-xs mt-6">
          * 식단은 재료 수급에 따라 변경될 수 있습니다
        </p>
      </div>
    </section>
  );
}
