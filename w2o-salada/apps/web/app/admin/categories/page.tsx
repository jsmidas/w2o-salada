"use client";

import { useState, useEffect } from "react";

type Category = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  icon: string | null;
  color: string | null;
  isActive: boolean;
  _count?: { products: number };
};

const ICON_PRESETS = [
  "eco", "lunch_dining", "restaurant", "rice_bowl", "ramen_dining",
  "set_meal", "soup_kitchen", "local_cafe", "bakery_dining", "icecream",
];

const COLOR_PRESETS = ["#1D9E75", "#EF9F27", "#E45858", "#5B8DEF", "#9B59B6", "#0A1A0F"];

type FormState = {
  name: string;
  slug: string;
  sortOrder: number;
  icon: string;
  color: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  name: "",
  slug: "",
  sortOrder: 0,
  icon: "lunch_dining",
  color: "#1D9E75",
  isActive: true,
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
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
    setForm(emptyForm);
    fetchCategories();
  };

  const handleEdit = (cat: Category) => {
    setEditId(cat.id);
    setForm({
      name: cat.name,
      slug: cat.slug,
      sortOrder: cat.sortOrder,
      icon: cat.icon ?? "lunch_dining",
      color: cat.color ?? "#1D9E75",
      isActive: cat.isActive,
    });
    setAdding(true);
  };

  const handleToggleActive = async (cat: Category) => {
    await fetch(`/api/admin/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !cat.isActive }),
    });
    fetchCategories();
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
          onClick={() => {
            setAdding(true);
            setEditId(null);
            setForm({ ...emptyForm, sortOrder: categories.length + 1 });
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1D9E75] text-white rounded-lg hover:bg-[#5DCAA5] transition text-sm font-medium"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          카테고리 추가
        </button>
      </div>

      {/* 추가/수정 폼 */}
      {adding && (
        <div className="bg-white rounded-xl p-5 shadow-sm border mb-6 space-y-5">
          <h3 className="font-bold text-gray-700">{editId ? "카테고리 수정" : "카테고리 추가"}</h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">이름</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value, slug: editId ? form.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-") })}
                placeholder="샐러드"
                className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#1D9E75] w-full"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">슬러그</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="salad"
                className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#1D9E75] w-full"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">순서</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#1D9E75] w-full"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-700">공개 (탭에 노출)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-600 block mb-2">아이콘</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {ICON_PRESETS.map((ic) => (
                <button
                  type="button"
                  key={ic}
                  onClick={() => setForm({ ...form, icon: ic })}
                  className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center transition ${
                    form.icon === ic ? "border-[#1D9E75] bg-[#1D9E75]/10" : "border-gray-200 hover:border-gray-300"
                  }`}
                  title={ic}
                >
                  <span className="material-symbols-outlined text-xl" style={{ color: form.icon === ic ? form.color : "#6b7280" }}>{ic}</span>
                </button>
              ))}
            </div>
            <input
              type="text"
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              placeholder="material-symbols 이름 직접 입력"
              className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#1D9E75] w-full md:w-64 font-mono"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-600 block mb-2">색상</label>
            <div className="flex flex-wrap gap-2 items-center">
              {COLOR_PRESETS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-10 h-10 rounded-lg border-2 transition ${
                    form.color === c ? "border-gray-800 scale-110" : "border-gray-200"
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-10 h-10 rounded-lg cursor-pointer border border-gray-200"
              />
              <input
                type="text"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                placeholder="#1D9E75"
                className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#1D9E75] w-32 font-mono"
              />
            </div>
          </div>

          {/* 미리보기 */}
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-2">미리보기</label>
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white font-bold text-sm shadow-md"
              style={{ backgroundColor: form.color }}
            >
              {form.icon && <span className="material-symbols-outlined text-lg">{form.icon}</span>}
              {form.name || "카테고리명"}
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <button type="button" onClick={handleSave} className="px-5 py-2 bg-[#1D9E75] text-white text-sm font-medium rounded-lg hover:bg-[#178a64]">
              {editId ? "수정" : "추가"}
            </button>
            <button type="button" onClick={() => { setAdding(false); setEditId(null); setForm(emptyForm); }} className="px-5 py-2 border text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50">
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
              <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">카테고리</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">슬러그</th>
              <th className="text-center px-5 py-3 text-sm font-medium text-gray-500">상품 수</th>
              <th className="text-center px-5 py-3 text-sm font-medium text-gray-500">공개</th>
              <th className="text-center px-5 py-3 text-sm font-medium text-gray-500">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">로딩 중...</td></tr>
            ) : categories.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">카테고리가 없습니다.</td></tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-4 text-center text-sm text-gray-500">{cat.sortOrder}</td>
                  <td className="px-5 py-4">
                    <div
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-white font-bold text-xs"
                      style={{ backgroundColor: cat.color ?? "#1D9E75" }}
                    >
                      {cat.icon && <span className="material-symbols-outlined text-sm">{cat.icon}</span>}
                      {cat.name}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500 font-mono">{cat.slug}</td>
                  <td className="px-5 py-4 text-center text-sm text-gray-600">{cat._count?.products ?? "-"}</td>
                  <td className="px-5 py-4 text-center">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(cat)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                        cat.isActive ? "bg-[#1D9E75]" : "bg-gray-300"
                      }`}
                      title={cat.isActive ? "공개 중" : "숨김"}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${cat.isActive ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </td>
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
