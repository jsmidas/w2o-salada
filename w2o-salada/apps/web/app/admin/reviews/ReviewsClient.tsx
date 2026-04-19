"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "../../lib/fetcher";

type Review = {
  id: string;
  rating: number;
  content: string;
  images: string | null;
  isVisible: boolean;
  createdAt: string;
  user: { id: string; name: string; email: string };
  product: { id: string; name: string };
};

export default function ReviewsClient({ initialReviews }: { initialReviews: Review[] }) {
  const { data, mutate } = useSWR<Review[]>("/api/admin/reviews", fetcher, {
    fallbackData: initialReviews,
    revalidateOnFocus: false,
  });
  const reviews = Array.isArray(data) ? data : [];
  const [filter, setFilter] = useState<"all" | "visible" | "hidden">("all");

  const filtered = reviews.filter((r) => {
    if (filter === "visible") return r.isVisible;
    if (filter === "hidden") return !r.isVisible;
    return true;
  });

  const toggleVisibility = async (id: string, isVisible: boolean) => {
    await fetch("/api/admin/reviews", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isVisible }),
    });
    mutate();
  };

  const deleteReview = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await fetch(`/api/admin/reviews?id=${id}`, { method: "DELETE" });
    mutate();
  };

  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "-";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">리뷰 관리</h2>
          <p className="text-gray-500 text-sm mt-1">총 {reviews.length}개 · 평균 {avgRating}점</p>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-4">
        {[
          { key: "all", label: "전체" },
          { key: "visible", label: "공개" },
          { key: "hidden", label: "숨김" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as typeof filter)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === f.key ? "bg-[#1D9E75] text-white" : "bg-white text-gray-600 border hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">상품</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">작성자</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">별점</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">내용</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">상태</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">날짜</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">리뷰가 없습니다</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{r.product.name}</td>
                  <td className="px-4 py-3">
                    <p className="text-gray-800">{r.user.name}</p>
                    <p className="text-xs text-gray-400">{r.user.email}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s} className={`material-symbols-outlined text-xs ${s <= r.rating ? "text-[#EF9F27]" : "text-gray-200"}`}>star</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{r.content}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.isVisible ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {r.isVisible ? "공개" : "숨김"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400 text-xs" suppressHydrationWarning>
                    {new Date(r.createdAt).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => toggleVisibility(r.id, !r.isVisible)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                        title={r.isVisible ? "숨기기" : "공개하기"}
                      >
                        <span className="material-symbols-outlined text-lg text-gray-400">
                          {r.isVisible ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                      <button
                        onClick={() => deleteReview(r.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 transition"
                        title="삭제"
                      >
                        <span className="material-symbols-outlined text-lg text-red-400">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
