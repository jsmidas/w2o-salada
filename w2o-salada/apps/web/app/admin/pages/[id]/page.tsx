"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ProductPageView from "../../../components/ProductPageView";
import { prepareUpload, FileTooLargeError } from "../../../lib/compress-image";

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


interface PageForm {
  hero_images: string[];
  subtitle: string;
  feature_title: string;
  feature_description: string;
  feature_images: string[];
  keypoint_images: string[];
  specs_images: string[];
  detail_description: string;
  detail_images: string[];
  nutrition_images: string[];
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
];

// 이미지 업로드를 받는 섹션들 (드래그 중 시각 강조용) — 현재는 전 섹션 이미지 허용
const IMAGE_SECTIONS = new Set([
  "hero",
  "feature",
  "keypoints",
  "specs",
  "detail",
  "nutrition",
  "gallery",
]);

const SECTION_LABELS: Record<string, string> = {
  hero: "히어로",
  feature: "제품 소개",
  keypoints: "특장점",
  specs: "배송 시스템",
  detail: "구독 안내",
  nutrition: "기타 안내",
  gallery: "갤러리",
};

const SECTION_ICONS: Record<string, string> = {
  hero: "panorama",
  feature: "description",
  keypoints: "star",
  specs: "local_shipping",
  detail: "autorenew",
  nutrition: "info",
  gallery: "photo_library",
};

function makeDefaultForm(): PageForm {
  return {
    hero_images: [],
    subtitle: "",
    feature_title: "",
    feature_description: "",
    feature_images: [],
    keypoint_images: [],
    specs_images: [],
    detail_description: "",
    detail_images: [],
    nutrition_images: [],
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

/* ── Image list editor (drag & drop) ──────────────────── */

function ImageListEditor({
  label,
  images,
  onChange,
}: {
  label: string;
  images: string[];
  onChange: (next: string[]) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      const failures: string[] = [];
      for (const original of list) {
        let file: File;
        try {
          file = await prepareUpload(original);
        } catch (err) {
          if (err instanceof FileTooLargeError) {
            failures.push(`${original.name} (용량 초과 — 4.5MB 미만 권장)`);
            continue;
          }
          failures.push(`${original.name} (압축 실패)`);
          continue;
        }
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", "pages");
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (res.ok) {
          const data = await res.json();
          if (data.url) uploaded.push(data.url);
        } else if (res.status === 413) {
          failures.push(`${original.name} (용량 초과)`);
        } else {
          failures.push(`${original.name} (오류 ${res.status})`);
        }
      }
      if (uploaded.length) onChange([...images, ...uploaded]);
      if (failures.length) {
        alert(`일부 이미지 업로드 실패:\n${failures.join("\n")}`);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      e.dataTransfer.dropEffect = "copy";
      if (!dragOver) setDragOver(true);
    }
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files.length) void uploadFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <label className="block text-sm text-gray-400 mb-2">{label}</label>

      {images.filter(Boolean).length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {images.map((url, idx) => {
            if (!url) return null;
            return (
              <div
                key={idx}
                className="relative rounded-lg overflow-hidden border border-white/10 aspect-video bg-[#0f1420] group"
              >
                <img
                  src={url}
                  alt={`${label} ${idx + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => onChange(images.filter((_, i) => i !== idx))}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/70 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="삭제"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`w-full py-6 px-4 rounded-xl border border-dashed text-sm transition-colors flex flex-col items-center justify-center gap-1 ${
          uploading
            ? "opacity-60 cursor-wait border-white/10 text-gray-500"
            : dragOver
            ? "border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75] cursor-copy"
            : "border-white/10 text-gray-500 hover:border-[#1D9E75] hover:text-[#1D9E75] cursor-pointer"
        }`}
      >
        <span className="material-symbols-outlined text-2xl">
          {uploading ? "progress_activity" : "cloud_upload"}
        </span>
        <span>
          {uploading
            ? "업로드 중..."
            : dragOver
            ? "여기에 놓으세요"
            : "이미지를 드래그하거나 클릭하여 업로드"}
        </span>
        <span className="text-xs text-gray-500">JPG · PNG · WebP · 여러 장 동시 업로드 가능</span>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        aria-label={`${label} 파일 선택`}
        title={`${label} 파일 선택`}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />
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
  // 문서 전체에서 파일이 드래그 중인지 — 이미지 섹션 강조용
  const [fileDragging, setFileDragging] = useState(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    const hasFile = (e: DragEvent) =>
      e.dataTransfer ? Array.from(e.dataTransfer.types).includes("Files") : false;

    const onEnter = (e: DragEvent) => {
      if (!hasFile(e)) return;
      dragCounterRef.current += 1;
      if (dragCounterRef.current === 1) setFileDragging(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFile(e)) return;
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) setFileDragging(false);
    };
    // 브라우저 기본 동작(파일을 새 탭에서 열기) 차단.
    // 유효 드롭 존(ImageListEditor)은 stopPropagation으로 여기까지 안 옴.
    const onDragOver = (e: DragEvent) => {
      if (hasFile(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (hasFile(e)) e.preventDefault();
      dragCounterRef.current = 0;
      setFileDragging(false);
    };
    const reset = () => {
      dragCounterRef.current = 0;
      setFileDragging(false);
    };

    document.addEventListener("dragenter", onEnter);
    document.addEventListener("dragleave", onLeave);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    document.addEventListener("dragend", reset);
    return () => {
      document.removeEventListener("dragenter", onEnter);
      document.removeEventListener("dragleave", onLeave);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
      document.removeEventListener("dragend", reset);
    };
  }, []);

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
            keypoint_images: (() => {
              const raw = parse(data.keyPoints);
              return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
            })(),
            specs_images: (() => {
              const raw = parse(data.specs);
              return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
            })(),
            detail_description: data.detailDescription || "",
            detail_images: parse(data.detailImages) || [],
            nutrition_images: (() => {
              const raw = parse(data.nutrition);
              return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
            })(),
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
            keypoint_images: (() => {
              const raw = parse(data.keyPoints);
              return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
            })(),
            specs_images: (() => {
              const raw = parse(data.specs);
              return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
            })(),
            detail_description: data.detailDescription || "",
            detail_images: parse(data.detailImages) || [],
            nutrition_images: (() => {
              const raw = parse(data.nutrition);
              return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
            })(),
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
        keyPoints: JSON.stringify(form.keypoint_images.filter(Boolean)),
        specs: JSON.stringify(form.specs_images.filter(Boolean)),
        detailDescription: form.detail_description,
        detailImages: JSON.stringify(form.detail_images.filter(Boolean)),
        nutrition: JSON.stringify(form.nutrition_images.filter(Boolean)),
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
  /* ── Image arrays ── */
  type ImageField =
    | "gallery_images"
    | "detail_images"
    | "hero_images"
    | "feature_images"
    | "keypoint_images"
    | "specs_images"
    | "nutrition_images";

  const setImages = (field: ImageField, next: string[]) => {
    setForm((prev) => ({ ...prev, [field]: next }));
  };

  // 섹션 ID → 이미지 필드명 매핑
  const SECTION_FIELD: Record<string, ImageField> = {
    hero: "hero_images",
    feature: "feature_images",
    keypoints: "keypoint_images",
    specs: "specs_images",
    detail: "detail_images",
    nutrition: "nutrition_images",
    gallery: "gallery_images",
  };

  // 섹션 전체 드롭 처리 — 안쪽 드롭존에 정확히 안 맞아도 OK
  const handleSectionDrop = async (sectionId: string, files: FileList) => {
    const field = SECTION_FIELD[sectionId];
    if (!field) return;
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    const uploaded: string[] = [];
    const failures: string[] = [];
    for (const original of images) {
      let file: File;
      try {
        file = await prepareUpload(original);
      } catch (err) {
        if (err instanceof FileTooLargeError) {
          failures.push(`${original.name} (용량 초과 — 4.5MB 미만 권장)`);
          continue;
        }
        failures.push(`${original.name} (압축 실패)`);
        continue;
      }
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "pages");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        if (data.url) uploaded.push(data.url);
      } else if (res.status === 413) {
        failures.push(`${original.name} (용량 초과)`);
      } else {
        failures.push(`${original.name} (오류 ${res.status})`);
      }
    }
    if (uploaded.length) {
      setForm((prev) => ({
        ...prev,
        [field]: [...(prev[field] as string[]), ...uploaded],
      }));
      // 해당 섹션 펼쳐서 업로드된 이미지 바로 보이게
      setActiveSection(sectionId);
    }
    if (failures.length) {
      alert(`일부 이미지 업로드 실패:\n${failures.join("\n")}`);
    }
  };

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

  /* ── Section content renderers ── */
  function renderHero() {
    return (
      <div className="px-6 pb-6 space-y-4">
        <ImageListEditor
          label="히어로 이미지"
          images={form.hero_images}
          onChange={(next) => setImages("hero_images", next)}
        />
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
        <ImageListEditor
          label="특장점 이미지"
          images={form.feature_images}
          onChange={(next) => setImages("feature_images", next)}
        />
      </div>
    );
  }

  function renderKeyPoints() {
    return (
      <div className="px-6 pb-6 space-y-4">
        <ImageListEditor
          label="특장점 이미지"
          images={form.keypoint_images}
          onChange={(next) => setImages("keypoint_images", next)}
        />
      </div>
    );
  }

  function renderSpecs() {
    return (
      <div className="px-6 pb-6 space-y-4">
        <ImageListEditor
          label="배송 시스템 이미지"
          images={form.specs_images}
          onChange={(next) => setImages("specs_images", next)}
        />
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
        <ImageListEditor
          label="상세 이미지"
          images={form.detail_images}
          onChange={(next) => setImages("detail_images", next)}
        />
      </div>
    );
  }

  function renderNutrition() {
    return (
      <div className="px-6 pb-6 space-y-4">
        <ImageListEditor
          label="기타 안내 이미지"
          images={form.nutrition_images}
          onChange={(next) => setImages("nutrition_images", next)}
        />
      </div>
    );
  }

  function renderGallery() {
    return (
      <div className="px-6 pb-6 space-y-4">
        <ImageListEditor
          label="갤러리 이미지"
          images={form.gallery_images}
          onChange={(next) => setImages("gallery_images", next)}
        />
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
        return `${form.keypoint_images.filter(Boolean).length}장`;
      case "specs":
        return `${form.specs_images.filter(Boolean).length}장`;
      case "nutrition":
        return `${form.nutrition_images.filter(Boolean).length}장`;
      case "gallery":
        return `${form.gallery_images.filter(Boolean).length}장`;
      default:
        return undefined;
    }
  }

  /* ── Preview panel ── */
  function PreviewPanel() {
    // 공개 페이지와 동일한 렌더러 사용 → preview와 실제 결과 1:1 매칭 보장
    const viewData = {
      heroImages: form.hero_images,
      subtitle: form.subtitle,
      featureTitle: form.feature_title,
      featureDescription: form.feature_description,
      featureImages: form.feature_images,
      keypointImages: form.keypoint_images,
      specsImages: form.specs_images,
      detailDescription: form.detail_description,
      detailImages: form.detail_images,
      nutritionImages: form.nutrition_images,
      galleryImages: form.gallery_images,
      sectionOrder: form.section_order,
    };
    return (
      <div className="w-1/2 min-w-0 sticky top-0 max-h-screen overflow-y-auto">
        <div className="bg-white rounded-2xl overflow-hidden shadow-lg">
          {/* Preview header */}
          <div className="bg-[#0A1A0F] px-6 py-4 flex items-center justify-between">
            <span className="text-sm text-[#5DCAA5] font-medium">미리보기</span>
            <span className="text-xs text-gray-500">모바일 뷰</span>
          </div>

          <div className="max-w-md mx-auto">
            <ProductPageView data={viewData} productName={product?.name ?? ""} />
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
            const acceptsImage = IMAGE_SECTIONS.has(sectionId);
            const wrapperClass =
              fileDragging && acceptsImage
                ? "rounded-2xl border-2 border-[#1D9E75] bg-[#1a1f2e] mb-4 overflow-hidden shadow-lg shadow-[#1D9E75]/20"
                : "rounded-2xl border border-white/10 bg-[#1a1f2e] mb-4 overflow-hidden";
            return (
              <div
                key={sectionId}
                className={wrapperClass}
                onDragOver={acceptsImage ? (e) => { e.preventDefault(); } : undefined}
                onDrop={acceptsImage ? (e) => {
                  if (e.dataTransfer.files.length) {
                    e.preventDefault();
                    e.stopPropagation();
                    void handleSectionDrop(sectionId, e.dataTransfer.files);
                  }
                } : undefined}
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
