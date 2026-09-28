import { NextResponse } from "next/server";
import { prisma } from "@repo/db";

// 정적 프리렌더는 막되(force-dynamic), CDN 에서 30초 캐시 + 60초 stale-while-revalidate.
// 메뉴 페이지가 방문마다 이 API 를 부르므로 캐시가 없으면 동시 접속 수만큼 DB 조회가 난다.
// 30초 지연은 안전하다 — 주문 API 가 금액을 DB 가격으로 다시 계산한다(/api/orders, /api/subscribe).
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  try {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(category && category !== "all"
          ? { category: { slug: category } }
          : {}),
      },
      // 예약 인상가·일일 제한·재고 같은 내부 계획은 내려보내지 않는다
      select: {
        id: true, name: true, description: true, originalPrice: true, singlePrice: true, price: true, kcal: true, tags: true, imageUrl: true,
        sortOrder: true, isActive: true, categoryId: true, availableDays: true, createdAt: true,
        category: { select: { id: true, name: true, slug: true, icon: true, color: true, isOption: true, sortOrder: true, isActive: true } },
      },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(products, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
  } catch (err) {
    console.error("GET /api/products error:", err);
    // DB 장애 시에도 프론트가 깨지지 않도록 빈 배열 반환
    return NextResponse.json([]);
  }
}
