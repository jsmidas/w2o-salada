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
  availableDays: string | null;
  category: { name: string; slug: string };
};

type Category = {
  id: string;
  name: string;
  slug: string;
};

const gradients: Record<string, string> = {
  salad: "from-[#e8f5ee] to-[#d4edda]",
  bowl: "from-[#e8f0fe] to-[#d6e4f0]",
  protein: "from-[#fff8e1] to-[#ffecb3]",
  juice: "from-[#fce4ec] to-[#f8bbd0]",
};

const floatingEmojis: Record<string, string[]> = {
  salad: ["🥬", "🥒", "🫒", "🥗", "🌿", "🍃"],
  bowl: ["🍚", "🥑", "🥜", "🫘", "🌾", "🥣"],
  protein: ["🍗", "🥩", "🥚", "🧀", "💪", "🔥"],
  juice: ["🍎", "🍋", "🥝", "🍊", "🫐", "🍇"],
};

const emojiPool = ["🥬","🍎","🥑","🍋","🥕","🍇","🥦","🍊","🌿","🍓","🥝","🫐","🌽","🍃","🥭","🫑","🍅","🍌","🥒","🍑","🫒","🍈","🥗","🧅"];

// 소수(prime) 기반으로 위치를 흩뿌려서 패턴 없이 자연스럽게
function scatter(i: number, prime: number, max: number) {
  return ((i * prime + 7) * 13.7) % max;
}

const bgItems = Array.from({ length: 50 }, (_, i) => ({
  emoji: emojiPool[i % emojiPool.length],
  left: scatter(i, 37, 100),
  top: scatter(i, 53, 100),
  size: 28 + scatter(i, 17, 36),
  floatDur: 10 + scatter(i, 11, 10),
  swayDur: 6 + scatter(i, 23, 8),
  driftDur: 12 + scatter(i, 19, 10),
  delay: scatter(i, 7, 8),
  type: i % 5, // 0=drift, 1,2=float+sway, 3,4=float only
}));

function BackgroundFruits() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {bgItems.map((item, i) => {
        const anim = item.type === 0
          ? `driftRight ${item.driftDur}s linear ${item.delay}s infinite`
          : item.type <= 2
            ? `floatUp ${item.floatDur}s ease-in-out ${item.delay}s infinite, sway ${item.swayDur}s ease-in-out ${item.delay + 0.5}s infinite`
            : `floatUp ${item.floatDur}s ease-in-out ${item.delay}s infinite`;
        return (
          <span
            key={i}
            className="absolute select-none"
            style={{
              left: item.type === 0 ? "-50px" : `${item.left}%`,
              top: `${item.top}%`,
              fontSize: item.size,
              animation: anim,
            }}
          >
            {item.emoji}
          </span>
        );
      })}
    </div>
  );
}

export default function MenuSection() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filter, setFilter] = useState("all");

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

  const filtered = filter === "all"
    ? products
    : products.filter((p) => p.category.slug === filter);

  return (
    <section id="menu" className="py-20 bg-gradient-to-b from-[#f7fdf9] to-[#edf7f0] relative">
      <BackgroundFruits />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-12">
          <span className="text-[#1D9E75] text-xs tracking-[0.3em] uppercase font-medium">
            OUR MENU
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0A1A0F] mt-3">
            오늘의 신선함을<br />선택하세요
          </h2>
        </div>

        {/* 필터 */}
        <div className="flex justify-center gap-3 mb-10 flex-wrap">
          <button
            onClick={() => setFilter("all")}
            className={`px-5 py-2 rounded-full text-sm font-medium transition ${
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
              className={`px-5 py-2 rounded-full text-sm font-medium transition ${
                filter === c.slug
                  ? "bg-[#1D9E75] text-white shadow-md shadow-[#1D9E75]/20"
                  : "bg-white text-[#4a7a5e] border border-[#1D9E75]/20 hover:bg-[#1D9E75]/10"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* 메뉴 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item) => (
            <Link
              key={item.id}
              href={`/products/${item.id}`}
              className="bg-white rounded-2xl overflow-hidden border border-[#1D9E75]/10 shadow-sm hover:shadow-xl hover:shadow-[#1D9E75]/10 hover:-translate-y-1 transition-all duration-300 group block"
            >
              {/* 이미지 영역 + 떠다니는 이모지 */}
              <div
                className={`h-48 bg-gradient-to-br ${gradients[item.category.slug] ?? "from-gray-100 to-gray-200"} flex items-center justify-center relative overflow-hidden`}
              >
                {item.imageUrl && (
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-[#0A1A0F]/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <span className="px-5 py-2.5 bg-white text-[#0A1A0F] rounded-full text-sm font-semibold shadow-lg">
                    자세히 보기
                  </span>
                </div>
              </div>
              <div className="p-5">
                {item.tags && (
                  <span className="text-xs font-bold text-[#EF9F27] tracking-wider">
                    {item.tags}
                  </span>
                )}
                <h3 className="text-[#0A1A0F] font-bold text-lg mt-1">{item.name}</h3>
                <p className="text-[#4a7a5e] text-sm mt-1 leading-relaxed line-clamp-2">
                  {item.description}
                </p>
                <div className="flex justify-between items-center mt-4">
                  <span className="text-[#7aaa90] text-sm">
                    {item.kcal ? `${item.kcal} kcal` : ""}
                  </span>
                  <span className="flex items-center gap-2">
                    {item.originalPrice && item.originalPrice > item.price && (
                      <span className="text-gray-500 text-sm line-through">
                        {item.originalPrice.toLocaleString()}원
                      </span>
                    )}
                    <span className="text-[#1D9E75] font-bold text-lg">
                      {item.price.toLocaleString()}원
                    </span>
                    {item.originalPrice && item.originalPrice > item.price && (
                      <span className="text-red-400 text-xs font-bold">
                        {Math.round((1 - item.price / item.originalPrice) * 100)}%
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
