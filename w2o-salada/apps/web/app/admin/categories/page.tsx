"use client";

import { useState, useEffect } from "react";

type Category = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  _count?: { products: number };
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", sortOrder: 0 });
  const [adding, setAdding] = useState(false);

  const fetchCategories = () => {
    fetch("/api/admin/categories")
      .then((r) => r.json())
      .then((data) => { setCategories(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleSave = async () => {
    const url = editId ? `/api/admin/categories/${editId}` : "/api/admin/categories";
    const method = editId ? "PATCH" : "POST";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setEditId(null);
    setAdding(false);
    setForm({ name: "", slug: "", sortOrder: 0 });
    fetchCategories();
  };

  const handleEdit = (cat: Category) => {
    setEditId(cat.id);
    setForm({ name: cat.name, slug: cat.slug, sortOrder: cat.sortOrder });
    setAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 카테고리를 삭제하시겠습니까? (연결된 상품이 있으면 삭제 불가)")) return;
    const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "삭제 실패");
      return;
    }
    fetchCategories();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">카테고리 관리</h2>
        <button
          type="button"
          onClick={() => { setAdding(true); setEditId(null); setForm({ name: "", slug: "", sortOrder: categories.length + 1 }); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1D9E75] text-white rounded-lg hover:bg-[#5DCAA5] transition text-sm font-medium"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          카테고리 추가
        </button>
      </div>

      {/* 추가/수정 폼 */}
      {adding && (
        <div className="bg-white rounded-xl p-5 shadow-sm border mb-6">
          <h3 className="font-bold text-gray-700 mb-4">{editId ? "카테고리 수정" : "카테고리 추가"}</h3>
          <div className="flex gap-4 items-end flex-wrap">
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">이름</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value, slug: editId ? form.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-") })}
                placeholder="샐러드"
                className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#1D9E75] w-48"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">슬러그</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="salad"
                className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#1D9E75] w-36"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">순서</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#1D9E75] w-20"
              />
            </div>
            <button type="button" onClick={handleSave} className="px-5 py-2 bg-[#1D9E75] text-white text-sm font-medium rounded-lg hover:bg-[#178a64]">
              {editId ? "수정" : "추가"}
            </button>
            <button type="button" onClick={() => { setAdding(false); setEditId(null); }} className="px-5 py-2 border text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50">
              취소
            </button>
          </div>
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-center px-5 py-3 text-sm font-medium text-gray-500 w-16">순서</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">이름</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">슬러그</th>
              <th className="text-center px-5 py-3 text-sm font-medium text-gray-500">상품 수</th>
              <th className="text-center px-5 py-3 text-sm font-medium text-gray-500">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">로딩 중...</td></tr>
            ) : categories.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">카테고리가 없습니다.</td></tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-4 text-center text-sm text-gray-500">{cat.sortOrder}</td>
                  <td className="px-5 py-4 font-medium text-gray-800">{cat.name}</td>
                  <td className="px-5 py-4 text-sm text-gray-500 font-mono">{cat.slug}</td>
                  <td className="px-5 py-4 text-center text-sm text-gray-600">{cat._count?.products ?? "-"}</td>
                  <td className="px-5 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button type="button" onClick={() => handleEdit(cat)} className="p-1.5 rounded-lg hover:bg-gray-100" title="수정">
                        <span className="material-symbols-outlined text-lg text-gray-400">edit</span>
                      </button>
                      <button type="button" onClick={() => handleDelete(cat.id)} className="p-1.5 rounded-lg hover:bg-red-50" title="삭제">
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
