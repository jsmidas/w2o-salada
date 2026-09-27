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

export default function ReviewsSection() {
  const [dbReviews, setDbReviews] = useState<Review[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    fetch("/api/reviews?limit=10")
      .then((r) => r.json())
      .then((data) => { if (data.reviews?.length > 0) setDbReviews(data.reviews); })
      .catch(() => {});
  }, []);

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

  if (displayReviews.length === 0) {
    return (
      <section id="reviews" className="py-20 bg-brand-deep">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <span className="text-brand-green text-xs tracking-[0.3em] uppercase font-medium">REVIEWS</span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mt-3">고객님의 이야기</h2>
          <p className="text-gray-400 mt-6">아직 후기가 없습니다. 첫 배송을 받으신 뒤 첫 번째 이야기를 남겨주세요.</p>
          <Link href="/reviews" className="inline-block mt-6 text-sm text-brand-green hover:underline">후기 남기기 →</Link>
        </div>
      </section>
    );
  }

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
