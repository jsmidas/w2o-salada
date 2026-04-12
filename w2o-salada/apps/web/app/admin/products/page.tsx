"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import { fetcher } from "../../lib/fetcher";

const ProductModal = dynamic(() => import("./ProductModal"), { ssr: false });

type Product = {
  id: string;
  name: string;
  categoryId: string;
  category?: { name: string; slug: string };
  originalPrice: number | null;
  price: number;
  kcal: number | null;
  description: string;
  isActive: boolean;
  tags: string | null;
  imageUrl: string | null;
  sortOrder: number;
  dailyLimit: number | null;
  availableDays: string | null;
};

const categoryLabels: Record<string, string> = {
  salad: "샐러드",
  simple: "간편식",
  etc: "기타",
};

export default function ProductsPage() {
  const { data, isLoading: loading, mutate } = useSWR<Product[]>("/api/admin/products", fetcher, { revalidateOnFocus: false });
  const products = Array.isArray(data) ? data : [];
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === "all" || p.category?.slug === categoryFilter;
    return matchSearch && matchCategory;
  });

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    mutate();
  };

  const handleEdit = (product: Product) => {
    setEditProduct(product);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditProduct(null);
    setModalOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">상품 관리</h2>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-[#1D9E75] text-white rounded-lg hover:bg-[#5DCAA5] transition text-sm font-medium"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          상품 등록
        </button>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-xl p-4 shadow-sm border mb-4 flex gap-4 items-center">
        <input
          type="text"
          placeholder="상품명 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 border rounded-lg text-sm flex-1 max-w-xs focus:outline-none focus:border-[#1D9E75]"
        />
        <div className="flex gap-2">
          {[{ key: "all", label: "전체" }, ...Object.entries(categoryLabels).map(([key, label]) => ({ key, label }))].map((c) => (
            <button
              key={c.key}
              onClick={() => setCategoryFilter(c.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                categoryFilter === c.key
                  ? "bg-[#1D9E75] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">상품명</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">카테고리</th>
              <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">정가/판매가</th>
              <th className="text-center px-5 py-3 text-sm font-medium text-gray-500">배송요일</th>
              <th className="text-center px-5 py-3 text-sm font-medium text-gray-500">상태</th>
              <th className="text-center px-5 py-3 text-sm font-medium text-gray-500">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">로딩 중...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">등록된 상품이 없습니다.</td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <span className="material-symbols-outlined text-gray-300">image</span>
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-800">{p.name}</p>
                        {p.tags && (
                          <span className="text-xs text-[#EF9F27] font-bold">{p.tags}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">
                    {p.category?.name ?? "-"}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {p.originalPrice && p.originalPrice > p.price ? (
                      <>
                        <span className="text-xs text-gray-400 line-through">{p.originalPrice.toLocaleString()}원</span>
                        <br />
                        <span className="text-sm text-red-500 font-bold">{p.price.toLocaleString()}원</span>
                      </>
                    ) : (
                      <span className="text-sm text-gray-800 font-medium">{p.price.toLocaleString()}원</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-center text-xs text-gray-500">
                    {p.availableDays ? p.availableDays : "매일"}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      p.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {p.isActive ? "판매중" : "미판매"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleEdit(p)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                        title="수정"
                      >
                        <span className="material-symbols-outlined text-lg text-gray-400">edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
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

      {/* 모달 */}
      {modalOpen && (
        <ProductModal
          product={editProduct}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); mutate(); }}
        />
      )}
    </div>
  );
}
