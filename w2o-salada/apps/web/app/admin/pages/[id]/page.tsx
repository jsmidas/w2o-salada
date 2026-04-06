"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

/* ── Types ────────────────────────────────────────────── */

type Product = {
  id: string;
  name: string;
  categoryId: string;
  category?: { name: string; slug: string };
  price: number;
  imageUrl: string | null;
  isActive: boolean;
};

type KeyPoint = { icon: string; title: string; description: string };
type SpecItem = { label: string; value: string };
type NutritionItem = { label: string; value: string };

interface PageForm {
  hero_images: string[];
  subtitle: string;
  feature_title: string;
  feature_description: string;
  feature_images: string[];
  key_points: KeyPoint[];
  specs: SpecItem[];
  detail_description: string;
  detail_images: string[];
  nutrition: NutritionItem[];
  gallery_images: string[];
  is_published: boolean;
  section_order: string[];
}

/* ── Constants ────────────────────────────────────────── */

const MOCK_PRODUCTS: Product[] = [
  { id: "1", name: "시저 샐러드", categoryId: "salad", category: { name: "샐러드", slug: "salad" }, price: 8900, imageUrl: null, isActive: true },
  { id: "2", name: "콥 샐러드", categoryId: "salad", category: { name: "샐러드", slug: "salad" }, price: 9500, imageUrl: null, isActive: true },
  { id: "3", name: "그릴드 치킨 볼", categoryId: "bowl", category: { name: "그레인볼", slug: "bowl" }, price: 10900, imageUrl: null, isActive: true },
  { id: "4", name: "연어 포케 볼", categoryId: "bowl", category: { name: "그레인볼", slug: "bowl" }, price: 12900, imageUrl: null, isActive: true },
  { id: "5", name: "프로틴 박스", categoryId: "protein", category: { name: "프로틴", slug: "protein" }, price: 11500, imageUrl: null, isActive: true },
  { id: "6", name: "디톡스 주스", categoryId: "juice", category: { name: "주스/음료", slug: "juice" }, price: 5900, imageUrl: null, isActive: true },
];

const DEFAULT_SECTION_ORDER = [
  "hero",
  "feature",
  "keypoints",
  "specs",
  "detail",
  "nutrition",
  "gallery",
];

const SECTION_LABELS: Record<string, string> = {
  hero: "히어로",
  feature: "특장점",
  keypoints: "키포인트",
  specs: "제품 스펙",
  detail: "상세 설명",
  nutrition: "영양 정보",
  gallery: "갤러리",
};

const SECTION_ICONS: Record<string, string> = {
  hero: "panorama",
  feature: "star",
  keypoints: "lightbulb",
  specs: "list_alt",
  detail: "description",
  nutrition: "restaurant",
  gallery: "photo_library",
};

const ICON_OPTIONS = [
  "eco",
  "local_fire_department",
  "thermostat",
  "spa",
  "star",
  "bolt",
  "water_drop",
  "inventory_2",
  "check_circle",
  "workspace_premium",
  "favorite",
  "wb_sunny",
  "nutrition",
  "fitness_center",
  "timer",
  "shield",
  "recycling",
  "local_dining",
];

const DEFAULT_NUTRITION: NutritionItem[] = [
  { label: "칼로리", value: "" },
  { label: "단백질", value: "" },
  { label: "탄수화물", value: "" },
  { label: "지방", value: "" },
  { label: "식이섬유", value: "" },
  { label: "나트륨", value: "" },
];

const emptyKeyPoint: KeyPoint = { icon: "eco", title: "", description: "" };
const emptySpec: SpecItem = { label: "", value: "" };
const emptyNutrition: NutritionItem = { label: "", value: "" };

function makeDefaultForm(): PageForm {
  return {
    hero_images: [],
    subtitle: "",
    feature_title: "",
    feature_description: "",
    feature_images: [],
    key_points: [{ ...emptyKeyPoint }],
    specs: [{ ...emptySpec }],
    detail_description: "",
    detail_images: [],
    nutrition: DEFAULT_NUTRITION.map((n) => ({ ...n })),
    gallery_images: [],
    is_published: false,
    section_order: [...DEFAULT_SECTION_ORDER],
  };
}

/* ── Toast component ──────────────────────────────────── */

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1D9E75] text-white shadow-lg animate-[slideUp_0.3s_ease]">
      <span className="material-symbols-outlined text-lg">check_circle</span>
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

/* ── Main Editor ──────────────────────────────────────── */

export default function PageEditorPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>("hero");
  const [showPreview, setShowPreview] = useState(false);
  const [form, setForm] = useState<PageForm>(makeDefaultForm);

  // 이전 페이지 불러오기
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyPages, setCopyPages] = useState<{ id: string; name: string; imageUrl: string | null }[]>([]);
  const [copyLoading, setCopyLoading] = useState(false);

  const openCopyModal = async () => {
    setShowCopyModal(true);
    setCopyLoading(true);
    try {
      const res = await fetch("/api/admin/pages");
      if (res.ok) {
        const data = await res.json();
        // 상세페이지가 있는 상품만 (현재 상품 제외)
        setCopyPages(
          data.filter((p: { id: string; page: unknown }) => p.page && p.id !== id)
            .map((p: { id: string; name: string; imageUrl: string | null }) => ({ id: p.id, name: p.name, imageUrl: p.imageUrl }))
        );
      }
    } catch { /* ignore */ }
    setCopyLoading(false);
  };

  const loadFromPage = async (sourceId: string) => {
    try {
      const res = await fetch(`/api/admin/pages/${sourceId}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          const parse = (v: string | null) => { try { return v ? JSON.parse(v) : null; } catch { return null; } };
          setForm({
            hero_images: parse(data.heroImages) || [],
            subtitle: data.subtitle || "",
            feature_title: data.featureTitle || "",
            feature_description: data.featureDescription || "",
            feature_images: parse(data.featureImages) || [],
            key_points: parse(data.keyPoints) || [{ ...emptyKeyPoint }],
            specs: parse(data.specs) || [{ ...emptySpec }],
            detail_description: data.detailDescription || "",
            detail_images: parse(data.detailImages) || [],
            nutrition: parse(data.nutrition) || DEFAULT_NUTRITION.map((n) => ({ ...n })),
            gallery_images: parse(data.galleryImages) || [],
            is_published: false, // 복사 시 비공개로
            section_order: parse(data.sectionOrder) || [...DEFAULT_SECTION_ORDER],
          });
          setToast("이전 페이지를 불러왔습니다. 수정 후 저장하세요.");
        }
      }
    } catch { /* ignore */ }
    setShowCopyModal(false);
  };

  /* ── Load data ── */
  const fetchProduct = useCallback(async () => {
    setLoading(true);
    let prods: Product[] = [];
    try {
      const res = await fetch("/api/admin/products");
      if (res.ok) prods = await res.json();
    } catch {
      // ignore
    }
    const found = prods.find((p: Product) => p.id === id);
    if (!found) {
      router.push("/admin/pages");
      return;
    }
    setProduct(found);

    // Load from DB API
    try {
      const pageRes = await fetch(`/api/admin/pages/${id}`);
      if (pageRes.ok) {
        const data = await pageRes.json();
        if (data) {
          const parse = (v: string | null) => { try { return v ? JSON.parse(v) : null; } catch { return null; } };
          setForm({
            hero_images: parse(data.heroImages) || [],
            subtitle: data.subtitle || "",
            feature_title: data.featureTitle || "",
            feature_description: data.featureDescription || "",
            feature_images: parse(data.featureImages) || [],
            key_points: parse(data.keyPoints) || [{ ...emptyKeyPoint }],
            specs: parse(data.specs) || [{ ...emptySpec }],
            detail_description: data.detailDescription || "",
            detail_images: parse(data.detailImages) || [],
            nutrition: parse(data.nutrition) || DEFAULT_NUTRITION.map((n) => ({ ...n })),
            gallery_images: parse(data.galleryImages) || [],
            is_published: data.isPublished || false,
            section_order: parse(data.sectionOrder) || [...DEFAULT_SECTION_ORDER],
          });
        }
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  /* ── Save to DB ── */
  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        heroImages: JSON.stringify(form.hero_images.filter(Boolean)),
        subtitle: form.subtitle,
        featureTitle: form.feature_title,
        featureDescription: form.feature_description,
        featureImages: JSON.stringify(form.feature_images.filter(Boolean)),
        keyPoints: JSON.stringify(form.key_points.filter((kp) => kp.title)),
        specs: JSON.stringify(form.specs.filter((s) => s.label)),
        detailDescription: form.detail_description,
        detailImages: JSON.stringify(form.detail_images.filter(Boolean)),
        nutrition: JSON.stringify(form.nutrition.filter((n) => n.label)),
        galleryImages: JSON.stringify(form.gallery_images.filter(Boolean)),
        sectionOrder: JSON.stringify(form.section_order),
        isPublished: form.is_published,
      };
      const res = await fetch(`/api/admin/pages/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setToast("저장되었습니다!");
      } else {
        setToast("저장에 실패했습니다.");
      }
    } catch {
      setToast("저장에 실패했습니다.");
    }
    setSaving(false);
  }

  /* ── Section toggle ── */
  function toggleSection(section: string) {
    setActiveSection((prev) => (prev === section ? null : section));
  }

  /* ── Section reorder ── */
  function moveSectionUp(idx: number) {
    if (idx === 0) return;
    setForm((prev) => {
      const order = [...prev.section_order];
      const tmp = order[idx - 1]!;
      order[idx - 1] = order[idx]!;
      order[idx] = tmp;
      return { ...prev, section_order: order };
    });
  }
  function moveSectionDown(idx: number) {
    setForm((prev) => {
      if (idx >= prev.section_order.length - 1) return prev;
      const order = [...prev.section_order];
      const tmp = order[idx]!;
      order[idx] = order[idx + 1]!;
      order[idx + 1] = tmp;
      return { ...prev, section_order: order };
    });
  }

  /* ── Key Points ── */
  function addKeyPoint() {
    setForm((prev) => ({ ...prev, key_points: [...prev.key_points, { ...emptyKeyPoint }] }));
  }
  function removeKeyPoint(idx: number) {
    setForm((prev) => ({ ...prev, key_points: prev.key_points.filter((_, i) => i !== idx) }));
  }
  function updateKeyPoint(idx: number, field: keyof KeyPoint, value: string) {
    setForm((prev) => ({
      ...prev,
      key_points: prev.key_points.map((kp, i) => (i === idx ? { ...kp, [field]: value } : kp)),
    }));
  }

  /* ── Specs ── */
  function addSpec() {
    setForm((prev) => ({ ...prev, specs: [...prev.specs, { ...emptySpec }] }));
  }
  function removeSpec(idx: number) {
    setForm((prev) => ({ ...prev, specs: prev.specs.filter((_, i) => i !== idx) }));
  }
  function updateSpec(idx: number, field: keyof SpecItem, value: string) {
    setForm((prev) => ({
      ...prev,
      specs: prev.specs.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    }));
  }

  /* ── Nutrition ── */
  function addNutrition() {
    setForm((prev) => ({ ...prev, nutrition: [...prev.nutrition, { ...emptyNutrition }] }));
  }
  function removeNutrition(idx: number) {
    setForm((prev) => ({ ...prev, nutrition: prev.nutrition.filter((_, i) => i !== idx) }));
  }
  function updateNutrition(idx: number, field: keyof NutritionItem, value: string) {
    setForm((prev) => ({
      ...prev,
      nutrition: prev.nutrition.map((n, i) => (i === idx ? { ...n, [field]: value } : n)),
    }));
  }

  /* ── Image arrays ── */
  function addImageUrl(field: "gallery_images" | "detail_images" | "hero_images" | "feature_images") {
    setForm((prev) => ({ ...prev, [field]: [...(prev[field] as string[]), ""] }));
  }
  function removeImageUrl(field: "gallery_images" | "detail_images" | "hero_images" | "feature_images", idx: number) {
    setForm((prev) => ({
      ...prev,
      [field]: (prev[field] as string[]).filter((_: string, i: number) => i !== idx),
    }));
  }
  function updateImageUrl(
    field: "gallery_images" | "detail_images" | "hero_images" | "feature_images",
    idx: number,
    value: string
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: (prev[field] as string[]).map((v: string, i: number) => (i === idx ? value : v)),
    }));
  }

  /* ── Shared UI ── */
  const inputClass =
    "w-full px-4 py-2.5 rounded-xl border border-white/10 bg-[#0f1420] text-white placeholder:text-gray-500 focus:outline-none focus:border-[#1D9E75] transition-colors text-sm";
  const inputSmClass =
    "w-full px-3 py-2 rounded-lg border border-white/10 bg-[#0f1420] text-white placeholder:text-gray-500 focus:outline-none focus:border-[#1D9E75] transition-colors text-sm";

  if (loading) {
    return <div className="text-center py-20 text-gray-400">로딩 중...</div>;
  }

  /* ── Section header ── */
  function SectionHeader({
    sectionId,
    title,
    badge,
    idx,
    totalSections,
  }: {
    sectionId: string;
    title: string;
    badge?: string;
    idx: number;
    totalSections: number;
  }) {
    return (
      <div className="flex items-center">
        {/* Reorder buttons */}
        <div className="flex flex-col px-2 py-2 gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              moveSectionUp(idx);
            }}
            disabled={idx === 0}
            className="p-0.5 rounded text-gray-500 hover:text-white disabled:opacity-20 disabled:hover:text-gray-500 transition-colors"
            aria-label="위로 이동"
          >
            <span className="material-symbols-outlined text-base">keyboard_arrow_up</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              moveSectionDown(idx);
            }}
            disabled={idx === totalSections - 1}
            className="p-0.5 rounded text-gray-500 hover:text-white disabled:opacity-20 disabled:hover:text-gray-500 transition-colors"
            aria-label="아래로 이동"
          >
            <span className="material-symbols-outlined text-base">keyboard_arrow_down</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => toggleSection(sectionId)}
          className="flex-1 flex items-center justify-between px-4 py-4 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-lg text-[#1D9E75]">
              {SECTION_ICONS[sectionId] || "article"}
            </span>
            <h3 className="text-base font-semibold text-white">{title}</h3>
            {badge && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#1D9E75]/10 text-[#1D9E75]">
                {badge}
              </span>
            )}
          </div>
          <span className="material-symbols-outlined text-lg text-gray-500">
            {activeSection === sectionId ? "expand_less" : "expand_more"}
          </span>
        </button>
      </div>
    );
  }

  /* ── Image list editor ── */
  function ImageListEditor({
    field,
    label,
  }: {
    field: "hero_images" | "feature_images" | "detail_images" | "gallery_images";
    label: string;
  }) {
    const images = form[field] as string[];
    return (
      <div>
        <label className="block text-sm text-gray-400 mb-2">{label}</label>
        {images.map((url, idx) => (
          <div key={idx} className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-base text-gray-500 shrink-0">image</span>
            <input
              type="url"
              value={url}
              onChange={(e) => updateImageUrl(field, idx, e.target.value)}
              placeholder="이미지 URL"
              className={inputSmClass + " flex-1"}
              style={{ width: "auto" }}
            />
            <button
              type="button"
              onClick={() => removeImageUrl(field, idx)}
              className="p-1 text-gray-500 hover:text-red-400 transition-colors"
              aria-label="삭제"
            >
              <span className="material-symbols-outlined text-base">delete</span>
            </button>
          </div>
        ))}
        {/* Preview thumbnails */}
        {images.filter(Boolean).length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {images.filter(Boolean).map((url, idx) => (
              <div key={idx} className="rounded-lg overflow-hidden border border-white/10 aspect-video bg-[#0f1420]">
                <img
                  src={url}
                  alt={`${label} ${idx + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => addImageUrl(field)}
          className="w-full py-2 rounded-xl border border-dashed border-white/10 text-gray-500 text-sm hover:border-[#1D9E75] hover:text-[#1D9E75] transition-colors flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-base">add</span>
          이미지 URL 추가
        </button>
      </div>
    );
  }

  /* ── Section content renderers ── */
  function renderHero() {
    return (
      <div className="px-6 pb-6 space-y-4">
        <ImageListEditor field="hero_images" label="히어로 이미지" />
        <div>
          <label className="block text-sm text-gray-400 mb-1">서브타이틀</label>
          <input
            type="text"
            value={form.subtitle}
            onChange={(e) => setForm((prev) => ({ ...prev, subtitle: e.target.value }))}
            placeholder="제품의 한줄 소개"
            className={inputClass}
          />
        </div>
      </div>
    );
  }

  function renderFeature() {
    return (
      <div className="px-6 pb-6 space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">특장점 제목</label>
          <input
            type="text"
            value={form.feature_title}
            onChange={(e) => setForm((prev) => ({ ...prev, feature_title: e.target.value }))}
            placeholder="예: 신선한 유기농 채소로 만든 프리미엄 샐러드"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">특장점 설명</label>
          <textarea
            value={form.feature_description}
            onChange={(e) => setForm((prev) => ({ ...prev, feature_description: e.target.value }))}
            placeholder="제품의 핵심 특장점을 설명해주세요"
            rows={5}
            className={inputClass + " resize-y min-h-[120px]"}
          />
        </div>
        <ImageListEditor field="feature_images" label="특장점 이미지" />
      </div>
    );
  }

  function renderKeyPoints() {
    return (
      <div className="px-6 pb-6 space-y-4">
        {form.key_points.map((kp, idx) => (
          <div
            key={idx}
            className="p-4 rounded-xl border border-white/10 bg-[#0f1420] space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">포인트 {idx + 1}</span>
              {form.key_points.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeKeyPoint(idx)}
                  className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">아이콘</label>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-xl text-[#1D9E75]">{kp.icon}</span>
                  <select
                    value={kp.icon}
                    onChange={(e) => updateKeyPoint(idx, "icon", e.target.value)}
                    className={inputSmClass}
                  >
                    {ICON_OPTIONS.map((icon) => (
                      <option key={icon} value={icon}>
                        {icon}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">제목</label>
                <input
                  type="text"
                  value={kp.title}
                  onChange={(e) => updateKeyPoint(idx, "title", e.target.value)}
                  placeholder="예: 유기농 인증"
                  className={inputSmClass}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">설명</label>
              <input
                type="text"
                value={kp.description}
                onChange={(e) => updateKeyPoint(idx, "description", e.target.value)}
                placeholder="간단한 설명"
                className={inputSmClass}
              />
            </div>
          </div>
        ))}
        {form.key_points.length < 8 && (
          <button
            type="button"
            onClick={addKeyPoint}
            className="w-full py-2.5 rounded-xl border border-dashed border-white/10 text-gray-500 text-sm hover:border-[#1D9E75] hover:text-[#1D9E75] transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-base">add</span>
            키포인트 추가
          </button>
        )}
      </div>
    );
  }

  function renderSpecs() {
    return (
      <div className="px-6 pb-6 space-y-3">
        {form.specs.map((spec, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <input
              type="text"
              value={spec.label}
              onChange={(e) => updateSpec(idx, "label", e.target.value)}
              placeholder="항목명 (예: 중량)"
              className={inputSmClass + " flex-1"}
              style={{ width: "auto" }}
            />
            <input
              type="text"
              value={spec.value}
              onChange={(e) => updateSpec(idx, "value", e.target.value)}
              placeholder="값 (예: 350g)"
              className={inputSmClass + " flex-1"}
              style={{ width: "auto" }}
            />
            {form.specs.length > 1 && (
              <button
                type="button"
                onClick={() => removeSpec(idx)}
                className="p-1 text-gray-500 hover:text-red-400 transition-colors"
              >
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addSpec}
          className="w-full py-2.5 rounded-xl border border-dashed border-white/10 text-gray-500 text-sm hover:border-[#1D9E75] hover:text-[#1D9E75] transition-colors flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-base">add</span>
          스펙 추가
        </button>
      </div>
    );
  }

  function renderDetail() {
    return (
      <div className="px-6 pb-6 space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">상세 설명</label>
          <textarea
            value={form.detail_description}
            onChange={(e) => setForm((prev) => ({ ...prev, detail_description: e.target.value }))}
            placeholder="제품에 대한 상세 설명을 작성해주세요"
            rows={8}
            className={inputClass + " resize-y min-h-[200px]"}
          />
        </div>
        <ImageListEditor field="detail_images" label="상세 이미지" />
      </div>
    );
  }

  function renderNutrition() {
    return (
      <div className="px-6 pb-6 space-y-3">
        <p className="text-xs text-gray-500 mb-2">
          영양 성분 정보를 입력하세요. 단위를 포함해서 값을 입력해주세요 (예: 320kcal, 25g).
        </p>
        {form.nutrition.map((item, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <input
              type="text"
              value={item.label}
              onChange={(e) => updateNutrition(idx, "label", e.target.value)}
              placeholder="항목 (예: 칼로리)"
              className={inputSmClass + " flex-1"}
              style={{ width: "auto" }}
            />
            <input
              type="text"
              value={item.value}
              onChange={(e) => updateNutrition(idx, "value", e.target.value)}
              placeholder="값 (예: 320kcal)"
              className={inputSmClass + " flex-1"}
              style={{ width: "auto" }}
            />
            {form.nutrition.length > 1 && (
              <button
                type="button"
                onClick={() => removeNutrition(idx)}
                className="p-1 text-gray-500 hover:text-red-400 transition-colors"
              >
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addNutrition}
          className="w-full py-2.5 rounded-xl border border-dashed border-white/10 text-gray-500 text-sm hover:border-[#1D9E75] hover:text-[#1D9E75] transition-colors flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-base">add</span>
          영양 항목 추가
        </button>
      </div>
    );
  }

  function renderGallery() {
    return (
      <div className="px-6 pb-6 space-y-4">
        <ImageListEditor field="gallery_images" label="갤러리 이미지" />
      </div>
    );
  }

  const sectionRenderers: Record<string, () => React.ReactNode> = {
    hero: renderHero,
    feature: renderFeature,
    keypoints: renderKeyPoints,
    specs: renderSpecs,
    detail: renderDetail,
    nutrition: renderNutrition,
    gallery: renderGallery,
  };

  function getSectionBadge(sectionId: string): string | undefined {
    switch (sectionId) {
      case "hero":
        return `${form.hero_images.filter(Boolean).length}장`;
      case "keypoints":
        return `${form.key_points.length}개`;
      case "specs":
        return `${form.specs.length}개`;
      case "nutrition":
        return `${form.nutrition.length}개`;
      case "gallery":
        return `${form.gallery_images.filter(Boolean).length}장`;
      default:
        return undefined;
    }
  }

  /* ── Preview panel ── */
  function PreviewPanel() {
    return (
      <div className="w-1/2 min-w-0 sticky top-0 max-h-screen overflow-y-auto">
        <div className="bg-white rounded-2xl overflow-hidden shadow-lg">
          {/* Preview header */}
          <div className="bg-[#0A1A0F] px-6 py-4 flex items-center justify-between">
            <span className="text-sm text-[#5DCAA5] font-medium">미리보기</span>
            <span className="text-xs text-gray-500">모바일 뷰</span>
          </div>

          <div className="max-w-md mx-auto">
            {form.section_order.map((sectionId) => {
              switch (sectionId) {
                case "hero":
                  return (
                    <div key="hero">
                      {form.hero_images.filter(Boolean).length > 0 ? (
                        <div className="aspect-video bg-gray-100 relative overflow-hidden">
                          <img
                            src={form.hero_images.filter(Boolean)[0]}
                            alt="Hero"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                      ) : (
                        <div className="aspect-video bg-gray-100 flex items-center justify-center text-gray-300">
                          <span className="material-symbols-outlined text-5xl">panorama</span>
                        </div>
                      )}
                      {(product?.name || form.subtitle) && (
                        <div className="px-5 py-4">
                          <h2 className="text-xl font-bold text-gray-900">{product?.name}</h2>
                          {form.subtitle && (
                            <p className="text-sm text-gray-500 mt-1">{form.subtitle}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );

                case "feature":
                  if (!form.feature_title && !form.feature_description) return null;
                  return (
                    <div key="feature" className="px-5 py-4 border-t border-gray-100">
                      {form.feature_title && (
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{form.feature_title}</h3>
                      )}
                      {form.feature_description && (
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{form.feature_description}</p>
                      )}
                      {form.feature_images.filter(Boolean).length > 0 && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {form.feature_images.filter(Boolean).map((url, i) => (
                            <img key={i} src={url} alt="" className="rounded-lg w-full aspect-square object-cover" />
                          ))}
                        </div>
                      )}
                    </div>
                  );

                case "keypoints": {
                  const filledKps = form.key_points.filter((kp) => kp.title);
                  if (filledKps.length === 0) return null;
                  return (
                    <div key="keypoints" className="px-5 py-4 border-t border-gray-100">
                      <div className="grid grid-cols-2 gap-3">
                        {filledKps.map((kp, i) => (
                          <div key={i} className="bg-[#f0faf5] rounded-xl p-3 text-center">
                            <span className="material-symbols-outlined text-2xl text-[#1D9E75]">{kp.icon}</span>
                            <div className="text-sm font-semibold text-gray-900 mt-1">{kp.title}</div>
                            {kp.description && (
                              <div className="text-xs text-gray-500 mt-0.5">{kp.description}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                case "specs": {
                  const filledSpecs = form.specs.filter((s) => s.label);
                  if (filledSpecs.length === 0) return null;
                  return (
                    <div key="specs" className="px-5 py-4 border-t border-gray-100">
                      <h4 className="text-sm font-bold text-gray-900 mb-2">제품 스펙</h4>
                      <div className="space-y-1.5">
                        {filledSpecs.map((s, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-500">{s.label}</span>
                            <span className="text-gray-900 font-medium">{s.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                case "detail":
                  if (!form.detail_description && form.detail_images.filter(Boolean).length === 0) return null;
                  return (
                    <div key="detail" className="px-5 py-4 border-t border-gray-100">
                      {form.detail_description && (
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{form.detail_description}</p>
                      )}
                      {form.detail_images.filter(Boolean).map((url, i) => (
                        <img key={i} src={url} alt="" className="rounded-lg w-full mt-3" />
                      ))}
                    </div>
                  );

                case "nutrition": {
                  const filledNutrition = form.nutrition.filter((n) => n.label && n.value);
                  if (filledNutrition.length === 0) return null;
                  return (
                    <div key="nutrition" className="px-5 py-4 border-t border-gray-100">
                      <h4 className="text-sm font-bold text-gray-900 mb-2">영양 정보</h4>
                      <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                        {filledNutrition.map((n, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-500">{n.label}</span>
                            <span className="text-gray-900 font-medium">{n.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                case "gallery": {
                  const filledGallery = form.gallery_images.filter(Boolean);
                  if (filledGallery.length === 0) return null;
                  return (
                    <div key="gallery" className="px-5 py-4 border-t border-gray-100">
                      <h4 className="text-sm font-bold text-gray-900 mb-2">갤러리</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {filledGallery.map((url, i) => (
                          <img key={i} src={url} alt="" className="rounded-lg w-full aspect-square object-cover" />
                        ))}
                      </div>
                    </div>
                  );
                }

                default:
                  return null;
              }
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ── Main render ── */
  return (
    <>
      <div className={`flex gap-6 ${showPreview ? "max-w-full" : "max-w-4xl mx-auto"}`}>
        <div className={showPreview ? "w-1/2 min-w-0" : "w-full"}>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link
                href="/admin/pages"
                className="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-xl">arrow_back</span>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white">상세페이지 편집</h1>
                <p className="text-sm text-gray-400 mt-1">{product?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={openCopyModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:bg-white/5 text-sm transition-colors"
              >
                <span className="material-symbols-outlined text-base">content_copy</span>
                불러오기
              </button>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-colors ${
                  showPreview
                    ? "border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75]"
                    : "border-white/10 text-gray-400 hover:bg-white/5"
                }`}
              >
                <span className="material-symbols-outlined text-base">visibility</span>
                {showPreview ? "미리보기 닫기" : "미리보기"}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1D9E75] text-white font-semibold text-sm hover:bg-[#178a65] transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">save</span>
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>

          {/* Publish toggle */}
          <div className="flex items-center gap-3 mb-6 px-6 py-4 rounded-2xl border border-white/10 bg-[#1a1f2e]">
            <input
              type="checkbox"
              id="is_published"
              checked={form.is_published}
              onChange={(e) => setForm((prev) => ({ ...prev, is_published: e.target.checked }))}
              className="accent-[#1D9E75] w-4 h-4"
            />
            <label htmlFor="is_published" className="text-sm text-gray-400">
              상세페이지 공개
            </label>
            <span
              className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                form.is_published
                  ? "bg-emerald-400/10 text-emerald-400"
                  : "bg-red-400/10 text-red-400"
              }`}
            >
              {form.is_published ? "공개" : "비공개"}
            </span>
          </div>

          {/* Sections */}
          {form.section_order.map((sectionId, idx) => {
            const num = idx + 1;
            const renderer = sectionRenderers[sectionId];
            if (!renderer) return null;
            return (
              <div
                key={sectionId}
                className="rounded-2xl border border-white/10 bg-[#1a1f2e] mb-4 overflow-hidden"
              >
                <SectionHeader
                  sectionId={sectionId}
                  title={`${num}. ${SECTION_LABELS[sectionId] || sectionId}`}
                  badge={getSectionBadge(sectionId)}
                  idx={idx}
                  totalSections={form.section_order.length}
                />
                {activeSection === sectionId && renderer()}
              </div>
            );
          })}
        </div>

        {/* Preview panel */}
        {showPreview && <PreviewPanel />}
      </div>

      {/* 이전 페이지 불러오기 모달 */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCopyModal(false)}>
          <div className="bg-[#1a1f2e] rounded-2xl w-full max-w-md max-h-[70vh] overflow-hidden border border-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white">이전 페이지 불러오기</h3>
                <p className="text-xs text-gray-400 mt-0.5">선택한 페이지의 내용을 복사합니다</p>
              </div>
              <button onClick={() => setShowCopyModal(false)} className="text-gray-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[55vh] p-3">
              {copyLoading ? (
                <p className="text-center text-gray-400 py-8">불러오는 중...</p>
              ) : copyPages.length === 0 ? (
                <p className="text-center text-gray-400 py-8">복사할 수 있는 페이지가 없습니다</p>
              ) : (
                copyPages.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => loadFromPage(p.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left hover:bg-white/5 transition"
                  >
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <span className="material-symbols-outlined text-gray-500">article</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{p.name}</p>
                      <p className="text-xs text-gray-500">클릭하여 불러오기</p>
                    </div>
                    <span className="material-symbols-outlined text-gray-500 text-lg">content_copy</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Slide-up animation */}
      <style jsx global>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}
