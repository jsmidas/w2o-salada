import { NextResponse } from "next/server";
import { prisma } from "@repo/db";

// 상품 목록은 이미지·가격 변경이 잦으므로 항상 fresh 반환
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
    return NextResponse.json(products);
  } catch (err) {
    console.error("GET /api/products error:", err);
    // DB 장애 시에도 프론트가 깨지지 않도록 빈 배열 반환
    return NextResponse.json([]);
  }
}
