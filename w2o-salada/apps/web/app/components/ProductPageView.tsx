// 상세페이지 렌더러 (admin preview와 공개 상품 상세 페이지가 공유)
//
// 입력: 파싱된 ProductPageData + 상품명
// 출력: 섹션 순서대로 렌더링된 JSX
//
// 섹션 라벨 (2026-04 리네이밍):
//   hero       → 히어로 (대표 이미지)
//   feature    → 제품 소개 (제목+설명+이미지)
//   keypoints  → 특장점 (아이콘+제목+설명 카드)
//   specs      → 배송 시스템 (항목:값)
//   detail     → 구독 안내 (설명+이미지)
//   nutrition  → 기타 안내 (항목:값)
//   gallery    → 갤러리 (기본 흐름에선 빠지지만 기존 데이터 호환)
//
// 이미지 정책: 업로드한 이미지는 원본 비율 그대로 단일 컬럼 스택.
// object-cover나 aspect-ratio 고정을 쓰지 않음.

export type ProductPageData = {
  heroImages: string[];
  subtitle: string;
  featureTitle: string;
  featureDescription: string;
  featureImages: string[];
  // 특장점 섹션 (구 keyPoints {icon,title,description}[]) — 이미지 URL 배열
  keypointImages: string[];
  // 배송 시스템 섹션 (구 specs {label,value}[]) — 이미지 URL 배열
  specsImages: string[];
  detailDescription: string;
  detailImages: string[];
  // 기타 안내 섹션 (구 nutrition) — 이미지 URL 배열
  nutritionImages: string[];
  galleryImages: string[];
  sectionOrder: string[];
};

/**
 * DB row(JSON string들) → ProductPageData 파싱.
 * 빈 값/파싱 실패엔 기본값 반환.
 */
export function parseProductPage(row: {
  heroImages?: string | null;
  subtitle?: string | null;
  featureTitle?: string | null;
  featureDescription?: string | null;
  featureImages?: string | null;
  keyPoints?: string | null;
  specs?: string | null;
  detailDescription?: string | null;
  detailImages?: string | null;
  nutrition?: string | null;
  galleryImages?: string | null;
  sectionOrder?: string | null;
}): ProductPageData {
  const safeParse = <T,>(v: string | null | undefined, fallback: T): T => {
    if (!v) return fallback;
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  };

  // keyPoints/specs/nutrition 필드는 과거엔 객체 배열이었으나 지금은 이미지 URL 배열.
  // 과거 데이터는 필터링으로 버려짐 (문자열만 통과).
  const toImageArray = (raw: unknown): string[] =>
    Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];

  return {
    heroImages: safeParse<string[]>(row.heroImages, []),
    subtitle: row.subtitle || "",
    featureTitle: row.featureTitle || "",
    featureDescription: row.featureDescription || "",
    featureImages: safeParse<string[]>(row.featureImages, []),
    keypointImages: toImageArray(safeParse<unknown[]>(row.keyPoints, [])),
    specsImages: toImageArray(safeParse<unknown[]>(row.specs, [])),
    detailDescription: row.detailDescription || "",
    detailImages: safeParse<string[]>(row.detailImages, []),
    nutritionImages: toImageArray(safeParse<unknown[]>(row.nutrition, [])),
    galleryImages: safeParse<string[]>(row.galleryImages, []),
    sectionOrder: safeParse<string[]>(row.sectionOrder, [
      "hero",
      "feature",
      "keypoints",
      "specs",
      "detail",
      "nutrition",
    ]),
  };
}

export default function ProductPageView({
  data,
  productName,
  showHeroTitle = true,
}: {
  data: ProductPageData;
  productName: string;
  /** 히어로 섹션에 상품명·서브타이틀 블록을 표시할지 (공개 페이지는 이미 상단에 이름 있으므로 false 가능) */
  showHeroTitle?: boolean;
}) {
  const heroImages = data.heroImages.filter(Boolean);
  const featureImages = data.featureImages.filter(Boolean);
  const keypointImages = data.keypointImages.filter(Boolean);
  const specsImages = data.specsImages.filter(Boolean);
  const detailImages = data.detailImages.filter(Boolean);
  const nutritionImages = data.nutritionImages.filter(Boolean);
  const filledGallery = data.galleryImages.filter(Boolean);

  return (
    <>
      {data.sectionOrder.map((sectionId) => {
        switch (sectionId) {
          case "hero":
            return (
              <div key="hero">
                {heroImages.length > 0 ? (
                  <div className="bg-gray-100 space-y-0">
                    {heroImages.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`${productName} ${i + 1}`}
                        className="w-full h-auto block"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="aspect-video bg-gray-100 flex items-center justify-center text-gray-300">
                    <span className="material-symbols-outlined text-5xl">panorama</span>
                  </div>
                )}
                {showHeroTitle && (productName || data.subtitle) && (
                  <div className="px-5 py-4">
                    <h2 className="text-xl font-bold text-gray-900">{productName}</h2>
                    {data.subtitle && (
                      <p className="text-sm text-gray-500 mt-1">{data.subtitle}</p>
                    )}
                  </div>
                )}
              </div>
            );

          case "feature":
            if (!data.featureTitle && !data.featureDescription && featureImages.length === 0) {
              return null;
            }
            return (
              <div key="feature" className="px-5 py-6 border-t border-gray-100">
                <div className="text-[11px] font-bold tracking-[0.2em] text-[#1D9E75] uppercase mb-2">
                  제품 소개
                </div>
                {data.featureTitle && (
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{data.featureTitle}</h3>
                )}
                {data.featureDescription && (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {data.featureDescription}
                  </p>
                )}
                {featureImages.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {featureImages.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt=""
                        className="rounded-lg w-full h-auto block"
                      />
                    ))}
                  </div>
                )}
              </div>
            );

          case "keypoints":
            if (keypointImages.length === 0) return null;
            return (
              <div key="keypoints" className="px-5 py-6 border-t border-gray-100">
                <div className="text-[11px] font-bold tracking-[0.2em] text-[#1D9E75] uppercase mb-3">
                  특장점
                </div>
                <div className="space-y-3">
                  {keypointImages.map((url, i) => (
                    <img key={i} src={url} alt="" className="rounded-lg w-full h-auto block" />
                  ))}
                </div>
              </div>
            );

          case "specs":
            if (specsImages.length === 0) return null;
            return (
              <div key="specs" className="px-5 py-6 border-t border-gray-100">
                <div className="text-[11px] font-bold tracking-[0.2em] text-[#1D9E75] uppercase mb-3">
                  배송 시스템
                </div>
                <div className="space-y-3">
                  {specsImages.map((url, i) => (
                    <img key={i} src={url} alt="" className="rounded-lg w-full h-auto block" />
                  ))}
                </div>
              </div>
            );

          case "detail":
            if (!data.detailDescription && detailImages.length === 0) return null;
            return (
              <div key="detail" className="px-5 py-6 border-t border-gray-100">
                <div className="text-[11px] font-bold tracking-[0.2em] text-[#1D9E75] uppercase mb-3">
                  구독 안내
                </div>
                {data.detailDescription && (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap mb-4">
                    {data.detailDescription}
                  </p>
                )}
                <div className="space-y-3">
                  {detailImages.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt=""
                      className="rounded-lg w-full h-auto block"
                    />
                  ))}
                </div>
              </div>
            );

          case "nutrition":
            if (nutritionImages.length === 0) return null;
            return (
              <div key="nutrition" className="px-5 py-6 border-t border-gray-100">
                <div className="text-[11px] font-bold tracking-[0.2em] text-[#1D9E75] uppercase mb-3">
                  기타 안내
                </div>
                <div className="space-y-3">
                  {nutritionImages.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt=""
                      className="rounded-lg w-full h-auto block"
                    />
                  ))}
                </div>
              </div>
            );

          case "gallery":
            if (filledGallery.length === 0) return null;
            return (
              <div key="gallery" className="px-5 py-6 border-t border-gray-100">
                <div className="text-[11px] font-bold tracking-[0.2em] text-[#1D9E75] uppercase mb-3">
                  갤러리
                </div>
                <div className="space-y-3">
                  {filledGallery.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt=""
                      className="rounded-lg w-full h-auto block"
                    />
                  ))}
                </div>
              </div>
            );

          default:
            return null;
        }
      })}
    </>
  );
}
