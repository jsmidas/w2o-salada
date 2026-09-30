"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Review = {
  id: string;
  rating: number;
  content: string;
  user: { name: string };
  product: { name: string };
  createdAt: string;
};

// initialReviews 를 넘기면 서버에서 조회한 목록을 그대로 쓰고 클라이언트 fetch 를 하지 않는다
export default function ReviewsSection({ initialReviews }: { initialReviews?: Review[] }) {
  const [dbReviews, setDbReviews] = useState<Review[]>(initialReviews ?? []);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (initialReviews) return;
    fetch("/api/reviews?limit=10")
      .then((r) => r.json())
      .then((data) => { if (data.reviews?.length > 0) setDbReviews(data.reviews); })
      .catch(() => {});
  }, [initialReviews]);

  // 실제 고객 후기만 보여준다 — 가상의 이름·후기를 실명처럼 내걸면 표시광고법 문제가 된다
  const displayReviews = dbReviews.map((r) => ({
    stars: r.rating,
    text: r.content,
    name: r.user.name,
    sub: r.product.name,
  }));

  useEffect(() => {
    if (displayReviews.length < 2) return;
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % displayReviews.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [displayReviews.length]);

  // 공개 후기가 없으면 섹션 전체를 숨긴다 — 빈 후기 칸은 출시 초기에 신뢰를 깎는다
  if (displayReviews.length === 0) return null;

  return (
    <section id="reviews" className="py-20 bg-brand-deep">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="text-brand-green text-xs tracking-[0.3em] uppercase font-medium">
            REVIEWS
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mt-3">
            고객님의 이야기
          </h2>
        </div>

        {/* 리뷰 카드 */}
        <div className="relative overflow-hidden">
          <div
            className="flex transition-transform duration-500"
            style={{ transform: `translateX(-${current * 100}%)` }}
          >
            {displayReviews.map((r, i) => (
              <div key={i} className="w-full flex-shrink-0 px-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                  <div className="flex justify-center gap-0.5 mb-4">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span key={s} className={`material-symbols-outlined text-xl ${s <= r.stars ? "text-brand-amber" : "text-white/20"}`}>star</span>
                    ))}
                  </div>
                  <p className="text-gray-300 text-lg leading-relaxed mb-6">
                    &ldquo;{r.text}&rdquo;
                  </p>
                  <p className="text-white font-bold">{r.name}</p>
                  <p className="text-gray-500 text-sm mt-1">{r.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 도트 인디케이터 */}
        <div className="flex justify-center gap-2 mt-6">
          {displayReviews.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2.5 h-2.5 rounded-full transition ${
                i === current ? "bg-brand-green" : "bg-white/20"
              }`}
            />
          ))}
        </div>

        {/* 전체 리뷰 보기 링크 */}
        <div className="text-center mt-8">
          <Link href="/reviews" className="text-sm text-brand-green hover:underline">
            전체 리뷰 보기 →
          </Link>
        </div>
      </div>
    </section>
  );
}
