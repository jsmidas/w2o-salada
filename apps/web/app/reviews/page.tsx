"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

type Review = {
  id: string;
  rating: number;
  content: string;
  images: string | null;
  createdAt: string;
  user: { name: string };
  product: { id: string; name: string; imageUrl: string | null; category: { name: string } };
};

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reviews?limit=50")
      .then((r) => r.json())
      .then((data) => { setReviews(data.reviews || []); setTotal(data.total || 0); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // 평균 별점
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "0";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f7fdf9] to-[#edf7f0]">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5">
            <span className="text-lg font-black text-[#1D9E75]">W2O</span>
            <span className="text-xs text-gray-400 tracking-widest">SALADA</span>
          </Link>
          <Link href="/" className="text-gray-400 text-sm hover:text-gray-600 transition">홈으로</Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-[#0A1A0F]">고객 리뷰</h1>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <span key={s} className={`material-symbols-outlined text-lg ${s <= Math.round(Number(avgRating)) ? "text-[#EF9F27]" : "text-gray-200"}`}>star</span>
              ))}
            </div>
            <span className="text-xl font-bold text-[#0A1A0F]">{avgRating}</span>
            <span className="text-gray-400 text-sm">({total}개 리뷰)</span>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-gray-400 py-12">로딩 중...</p>
        ) : reviews.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <span className="material-symbols-outlined text-4xl mb-2 block">rate_review</span>
            <p>아직 리뷰가 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviews.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl border border-[#1D9E75]/10 p-5 hover:shadow-md transition">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 shrink-0 overflow-hidden flex items-center justify-center">
                    {r.product.imageUrl ? (
                      <Image src={r.product.imageUrl} alt={r.product.name} width={40} height={40} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <span className="material-symbols-outlined text-gray-300">eco</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/products/${r.product.id}`} className="text-sm font-medium text-gray-800 hover:text-[#1D9E75] truncate block">
                      {r.product.name}
                    </Link>
                    <p className="text-[10px] text-gray-400">{r.product.category.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span key={s} className={`material-symbols-outlined text-sm ${s <= r.rating ? "text-[#EF9F27]" : "text-gray-200"}`}>star</span>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">{r.user.name}</span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString("ko-KR")}</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{r.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
