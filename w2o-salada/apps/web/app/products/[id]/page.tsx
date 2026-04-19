"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "../../store/cart";
import ProductPageView, {
  parseProductPage,
  type ProductPageData,
} from "../../components/ProductPageView";

type Product = {
  id: string;
  name: string;
  description: string | null;
  originalPrice: number | null;
  price: number;
  kcal: number | null;
  tags: string | null;
  imageUrl: string | null;
  availableDays: string | null;
  category: { name: string; slug: string; isOption?: boolean };
};

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [productPage, setProductPage] = useState<ProductPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    // 병렬로 기본 상품 정보 + 상세페이지 데이터 둘 다 fetch
    Promise.all([
      fetch(`/api/products/${id}`).then((r) => r.json()),
      fetch(`/api/product-pages/${id}`).then((r) => (r.ok ? r.json() : null)),
    ]).then(([productData, pageData]) => {
      setProduct(productData);
      if (pageData && pageData.isPublished) {
        setProductPage(parseProductPage(pageData));
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f7fdf9] to-[#edf7f0] flex items-center justify-center">
        <p className="text-[#7aaa90]">로딩 중...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f7fdf9] to-[#edf7f0] flex items-center justify-center">
        <p className="text-[#7aaa90]">상품을 찾을 수 없습니다.</p>
      </div>
    );
  }

  // 히어로 이미지 우선순위: ProductPage.heroImages[0] > product.imageUrl > placeholder
  const heroImage = productPage?.heroImages.filter(Boolean)[0] ?? product.imageUrl ?? null;
  // ProductPage 하단 섹션은 hero 제외 (위에서 이미 full-width로 보여줌)
  const belowSections = productPage
    ? {
        ...productPage,
        sectionOrder: productPage.sectionOrder.filter((s) => s !== "hero"),
      }
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f7fdf9] to-[#edf7f0]">
      {/* 헤더 */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#1D9E75]/10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5">
            <span className="text-lg font-black text-brand-green">W2O</span>
            <span className="text-xs text-gray-400 tracking-widest">SALADA</span>
          </Link>
          <Link
            href="/#subscribe"
            className="px-5 py-2 bg-brand-green text-white text-sm font-semibold rounded-full hover:bg-[#167A5B] transition"
          >
            구독 신청
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* 뒤로가기 */}
        <Link
          href="/menu"
          className="text-[#7aaa90] text-sm hover:text-[#1D9E75] mb-6 inline-flex items-center gap-1 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          메뉴 목록으로
        </Link>

        {/* 히어로 이미지 — 풀사이즈 */}
        <div className="mt-6 rounded-2xl overflow-hidden border border-[#1D9E75]/10 shadow-sm bg-white">
          {heroImage ? (
            <img
              src={heroImage}
              alt={product.name}
              className="w-full aspect-video object-cover"
            />
          ) : (
            <div className="aspect-video flex flex-col items-center justify-center">
              <span className="material-symbols-outlined text-7xl text-[#1D9E75]/15">lunch_dining</span>
              <p className="text-[#7aaa90] text-sm mt-2">이미지 준비중</p>
            </div>
          )}
        </div>

        {/* 상품 핵심 정보 + CTA */}
        <div className="mt-8 max-w-2xl">
          {/* 카테고리 + 태그 */}
          <div className="flex items-center gap-2 mb-3">
            <span className="px-3 py-1 bg-[#1D9E75]/10 text-[#1D9E75] text-sm font-medium rounded-full">
              {product.category.name}
            </span>
            {product.tags && (
              <span className="px-3 py-1 bg-[#EF9F27]/15 text-[#EF9F27] text-xs font-bold rounded-full">
                {product.tags}
              </span>
            )}
          </div>

          {/* 이름 */}
          <h1 className="text-3xl font-bold text-[#0A1A0F] mb-2">{product.name}</h1>

          {/* 서브타이틀 (상세페이지에서 설정) */}
          {productPage?.subtitle && (
            <p className="text-[#4a7a5e] text-lg mb-4">{productPage.subtitle}</p>
          )}

          {/* 설명 */}
          {product.description && (
            <p className="text-[#4a7a5e] leading-relaxed mb-6">{product.description}</p>
          )}

          {/* 칼로리 */}
          {product.kcal && (
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-[#EF9F27] text-lg">local_fire_department</span>
              <span className="text-[#4a7a5e] text-sm">{product.kcal} kcal</span>
            </div>
          )}

          {/* 가격 */}
          <div className="bg-white rounded-xl p-5 border border-[#1D9E75]/10 mb-6">
            {/* 구독가 */}
            <div className="mb-4">
              <p className="text-[#1D9E75] text-xs font-semibold tracking-wider mb-1">구독가</p>
              <div className="flex items-center gap-3">
                {product.originalPrice && product.originalPrice > product.price && (
                  <span className="text-gray-400 text-lg line-through">
                    {product.originalPrice.toLocaleString()}원
                  </span>
                )}
                <span className="text-3xl font-black text-[#0A1A0F]">
                  {product.price.toLocaleString()}
                  <span className="text-base font-normal text-[#7aaa90] ml-1">원</span>
                </span>
                {product.originalPrice && product.originalPrice > product.price && (
                  <span className="px-2.5 py-1 bg-red-50 text-red-500 text-sm font-bold rounded-lg">
                    {Math.round((1 - product.price / product.originalPrice) * 100)}% OFF
                  </span>
                )}
              </div>
            </div>
            {/* 맛보기가 */}
            <div className="pt-3 border-t border-[#1D9E75]/10 flex items-center justify-between">
              <p className="text-[#7aaa90] text-sm">맛보기 (1회)</p>
              <div className="flex items-center gap-2">
                {product.originalPrice && product.originalPrice > product.price && (
                  <span className="text-gray-400 text-sm line-through">{product.originalPrice.toLocaleString()}원</span>
                )}
                <span className="text-[#4a7a5e] font-bold text-lg">6,900원</span>
              </div>
            </div>
          </div>

          {/* CTA 버튼 */}
          <div className="flex gap-3">
            <Link
              href="/subscribe"
              className="flex-1 py-3.5 bg-[#1D9E75] text-white rounded-xl font-semibold hover:bg-[#167A5B] transition text-center flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-xl">autorenew</span>
              구독으로 만나기
            </Link>
            <button
              type="button"
              onClick={() => {
                addItem({
                  productId: product.id,
                  name: product.name,
                  price: product.price, // 상시 할인가 모델: 판매가(price)로 장바구니에 담음
                  imageUrl: product.imageUrl,
                  quantity: 1,
                  isOption: product.category?.isOption ?? false,
                });
                setAdded(true);
                setTimeout(() => setAdded(false), 2000);
              }}
              className="flex-1 py-3.5 border border-[#EF9F27] text-[#EF9F27] rounded-xl font-semibold hover:bg-[#EF9F27]/10 transition text-center flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-xl">{added ? "check_circle" : "local_dining"}</span>
              {added ? "담았습니다!" : "맛보기 담기"}
            </button>
          </div>
          {added && (
            <button
              type="button"
              onClick={() => router.push("/cart")}
              className="w-full mt-3 py-3 bg-[#EF9F27] text-white rounded-xl font-semibold hover:opacity-90 transition flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-xl">shopping_cart</span>
              장바구니로 이동
            </button>
          )}

          {/* 배송 안내 */}
          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="material-symbols-outlined text-[#1D9E75]">local_shipping</span>
              <span className="text-[#4a7a5e]">PM 11시 이전 주문 시 <span className="text-[#0A1A0F] font-medium">내일 새벽 배송</span></span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="material-symbols-outlined text-[#1D9E75]">restaurant_menu</span>
              <span className="text-[#4a7a5e]">배송일 메뉴 중 <span className="text-[#0A1A0F] font-medium">자유 조합 선택</span></span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="material-symbols-outlined text-[#1D9E75]">savings</span>
              <span className="text-[#4a7a5e]">구독 시 개당 <span className="text-[#1D9E75] font-medium">1,000원 할인</span></span>
            </div>
            {product.availableDays && (
              <div className="flex items-center gap-3 text-sm">
                <span className="material-symbols-outlined text-[#1D9E75]">calendar_month</span>
                <span className="text-[#4a7a5e]">배송 가능: <span className="text-[#0A1A0F] font-medium">{product.availableDays}</span></span>
              </div>
            )}
          </div>
        </div>

        {/* 상세페이지 추가 섹션 — 히어로는 위에서 이미 풀사이즈 노출 */}
        {belowSections && (
          <section className="mt-12 bg-white rounded-2xl overflow-hidden shadow-sm border border-[#1D9E75]/10">
            <ProductPageView
              data={belowSections}
              productName={product.name}
              showHeroTitle={false}
            />
          </section>
        )}
      </div>
    </div>
  );
}
