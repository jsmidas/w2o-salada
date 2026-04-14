"use client";

import { useState, useEffect } from "react";

type Product = {
  id?: string;
  name: string;
  categoryId: string;
  originalPrice: number | null;
  singlePrice: number | null;
  price: number;
  kcal: number | null;
  description: string;
  tags: string | null;
  imageUrl: string | null;
  isActive: boolean;
  dailyLimit: number | null;
  availableDays: string | null;
  nextPrice?: number | null;
  nextPriceEffectiveFrom?: string | null;
};

type Category = {
  id: string;
  name: string;
  slug: string;
};

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

export default function ProductModal({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!product?.id;
  const [categories, setCategories] = useState<Category[]>([]);

  const initialDays = product?.availableDays
    ? product.availableDays.split(",")
    : [...DAYS]; // 기본: 매일

  const [form, setForm] = useState({
    name: product?.name ?? "",
    categoryId: product?.categoryId ?? "",
    originalPrice: product?.originalPrice ?? 0,
    singlePrice: product?.singlePrice ?? 0,
    price: product?.price ?? 0,
    kcal: product?.kcal ?? 0,
    description: product?.description ?? "",
    tags: product?.tags ?? "",
    imageUrl: product?.imageUrl ?? "",
    isActive: product?.isActive ?? true,
    dailyLimit: product?.dailyLimit ?? 0,
    nextPrice: product?.nextPrice ?? 0,
    nextPriceEffectiveFrom: product?.nextPriceEffectiveFrom
      ? product.nextPriceEffectiveFrom.slice(0, 10)
      : "",
  });
  const [selectedDays, setSelectedDays] = useState<string[]>(initialDays);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/categories").then((r) => r.json()).then(setCategories);
  }, []);

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const selectAllDays = () => setSelectedDays([...DAYS]);
  const clearAllDays = () => setSelectedDays([]);

  // 할인율 계산
  const discountRate = form.originalPrice > 0 && form.price > 0
    ? Math.round((1 - form.price / form.originalPrice) * 100)
    : 0;
  const singleDiscountRate = form.originalPrice > 0 && form.singlePrice > 0
    ? Math.round((1 - form.singlePrice / form.originalPrice) * 100)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const url = isEdit ? `/api/admin/products/${product!.id}` : "/api/admin/products";
    const method = isEdit ? "PATCH" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        originalPrice: form.originalPrice || null,
        singlePrice: form.singlePrice || null,
        kcal: form.kcal || null,
        tags: form.tags || null,
        imageUrl: form.imageUrl || null,
        dailyLimit: form.dailyLimit || null,
        availableDays: selectedDays.length === 7 ? null : selectedDays.join(","),
        nextPrice: form.nextPrice && form.nextPriceEffectiveFrom ? form.nextPrice : null,
        nextPriceEffectiveFrom:
          form.nextPrice && form.nextPriceEffectiveFrom ? form.nextPriceEffectiveFrom : null,
      }),
    });

    setSaving(false);
    onSaved();
  };

  const inputClass = "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#1D9E75]";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-bold">{isEdit ? "상품 수정" : "상품 등록"}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 상품명 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">상품명 *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={inputClass} />
          </div>

          {/* 카테고리 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">카테고리 *</label>
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required className={inputClass}>
              <option value="">선택하세요</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* 정가 + 단건가 + 구독가 3-티어 */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">정가 (원)</label>
              <input type="number" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: Number(e.target.value) })} className={inputClass} />
              <p className="text-[10px] text-gray-400 mt-1">소비자가</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                단건가 (원)
                {singleDiscountRate > 0 && (
                  <span className="ml-1 text-[10px] text-orange-500 font-bold">−{singleDiscountRate}%</span>
                )}
              </label>
              <input type="number" value={form.singlePrice} onChange={(e) => setForm({ ...form, singlePrice: Number(e.target.value) })} className={inputClass} placeholder="미입력 시 구독가 사용" />
              <p className="text-[10px] text-gray-400 mt-1">1회 주문가</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                구독가 (원) *
                {discountRate > 0 && (
                  <span className="ml-1 text-[10px] text-red-500 font-bold">−{discountRate}%</span>
                )}
              </label>
              <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} required className={inputClass} />
              <p className="text-[10px] text-gray-400 mt-1">정기구독가</p>
            </div>
          </div>

          {/* 가격 변경 예약 */}
          <div className="border border-amber-200 bg-amber-50/40 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-amber-800 flex items-center gap-1">
                <span className="material-symbols-outlined text-base">schedule</span>
                가격 변경 예약 (선택)
              </label>
              {form.nextPrice > 0 && form.nextPriceEffectiveFrom && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, nextPrice: 0, nextPriceEffectiveFrom: "" })}
                  className="text-xs text-amber-700 hover:underline"
                >
                  예약 취소
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-amber-700 mb-1 block">새 구독가 (원)</label>
                <input
                  type="number"
                  aria-label="예약 인상가"
                  title="예약 인상가"
                  value={form.nextPrice}
                  onChange={(e) => setForm({ ...form, nextPrice: Number(e.target.value) })}
                  className={inputClass}
                  placeholder="예: 6500"
                />
              </div>
              <div>
                <label className="text-[11px] text-amber-700 mb-1 block">적용일 (KST 자정)</label>
                <input
                  type="date"
                  aria-label="예약 적용일"
                  title="예약 적용일"
                  value={form.nextPriceEffectiveFrom}
                  onChange={(e) => setForm({ ...form, nextPriceEffectiveFrom: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
            <p className="text-[10px] text-amber-700 mt-2 leading-relaxed">
              적용일 이후 첫 결제부터 새 가격이 자동 적용됩니다.<br />
              기존 구독은 결제 시점에 잠긴 가격으로 만료까지 유지됩니다.
            </p>
          </div>

          {/* 칼로리 + 일일제한 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">칼로리 (kcal)</label>
              <input type="number" value={form.kcal} onChange={(e) => setForm({ ...form, kcal: Number(e.target.value) })} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">일일 제한 수량</label>
              <input type="number" value={form.dailyLimit} onChange={(e) => setForm({ ...form, dailyLimit: Number(e.target.value) })} placeholder="0 = 무제한" className={inputClass} />
            </div>
          </div>

          {/* 배송 가능 요일 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">배송 가능 요일</label>
              <div className="flex gap-2">
                <button type="button" onClick={selectAllDays} className="text-xs text-[#1D9E75] hover:underline">전체</button>
                <button type="button" onClick={clearAllDays} className="text-xs text-gray-400 hover:underline">해제</button>
              </div>
            </div>
            <div className="flex gap-2">
              {DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`w-10 h-10 rounded-lg text-sm font-medium transition ${
                    selectedDays.includes(day)
                      ? "bg-[#1D9E75] text-white"
                      : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
            {selectedDays.length === 0 && (
              <p className="text-xs text-red-400 mt-1">최소 1개 이상 선택해 주세요</p>
            )}
          </div>

          {/* 태그 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">태그</label>
            <input type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="BEST, NEW, SALE 등" className={inputClass} />
          </div>

          {/* 이미지 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">상품 이미지</label>
            {form.imageUrl && (
              <div className="mb-2 relative inline-block">
                <img src={form.imageUrl} alt="미리보기" className="w-32 h-32 object-cover rounded-lg border" />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, imageUrl: "" })}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fd = new FormData();
                fd.append("file", file);
                fd.append("folder", "products");
                const res = await fetch("/api/upload", { method: "POST", body: fd });
                const data = await res.json();
                if (data.url) setForm({ ...form, imageUrl: data.url });
              }}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#1D9E75]/10 file:text-[#1D9E75] hover:file:bg-[#1D9E75]/20"
            />
            <p className="text-xs text-gray-400 mt-1">또는 URL 직접 입력:</p>
            <input type="text" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." className={`${inputClass} mt-1`} />
          </div>

          {/* 설명 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">설명</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className={`${inputClass} resize-none`} />
          </div>

          {/* 판매 상태 */}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
            <label htmlFor="isActive" className="text-sm text-gray-600">판매중</label>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
              취소
            </button>
            <button type="submit" disabled={saving || selectedDays.length === 0} className="flex-1 py-2.5 bg-[#1D9E75] text-white rounded-lg text-sm font-medium hover:bg-[#5DCAA5] disabled:opacity-50">
              {saving ? "저장 중..." : isEdit ? "수정" : "등록"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
