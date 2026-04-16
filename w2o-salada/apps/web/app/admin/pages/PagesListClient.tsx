"use client";

import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "../../lib/fetcher";

type ProductWithPage = {
  id: string;
  name: string;
  imageUrl: string | null;
  isActive: boolean;
  page: {
    productId: string;
    isPublished: boolean;
    updatedAt: string;
  } | null;
};

export default function PagesListClient({
  initialProducts,
}: {
  initialProducts: ProductWithPage[];
}) {
  const { data } = useSWR<ProductWithPage[]>("/api/admin/pages", fetcher, {
    fallbackData: initialProducts,
    revalidateOnFocus: false,
  });
  const products = Array.isArray(data) ? data : [];

  const withPage = products.filter((p) => p.page);
  const withoutPage = products.filter((p) => !p.page);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">상세페이지</h1>
          <p className="text-sm text-gray-400 mt-1">
            상품별 상세페이지를 관리하세요 — {withPage.length}개 생성됨 / 전체 {products.length}개 상품
          </p>
        </div>
      </div>

      {/* 생성된 상세페이지 */}
      {withPage.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-bold text-gray-700 mb-4">생성된 페이지</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {withPage.map((p) => (
              <Link
                key={p.id}
                href={`/admin/pages/${p.id}`}
                className="bg-white rounded-xl border overflow-hidden hover:shadow-md transition group"
              >
                <div className="h-32 bg-gray-100 flex items-center justify-center overflow-hidden">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-4xl text-gray-300">image</span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-gray-800 group-hover:text-[#1D9E75] transition">{p.name}</h3>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.page?.isPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {p.page?.isPublished ? "공개" : "비공개"}
                    </span>
                    <span className="text-xs text-gray-400">
                      {p.page?.updatedAt ? new Date(p.page.updatedAt).toLocaleDateString("ko-KR") : ""}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 미생성 */}
      {withoutPage.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-700 mb-4">상세페이지 미생성</h2>
          <div className="bg-white rounded-xl border overflow-hidden">
            {withoutPage.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-4 border-b last:border-0 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-gray-300">image</span>
                    )}
                  </div>
                  <span className="font-medium text-gray-800">{p.name}</span>
                </div>
                <Link
                  href={`/admin/pages/${p.id}`}
                  className="px-4 py-1.5 bg-[#1D9E75] text-white text-sm rounded-lg hover:bg-[#178a64] transition"
                >
                  페이지 만들기
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
