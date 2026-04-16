import { NextResponse } from "next/server";

// GET: 카테고리별 판매가 min/max/avg (슬롯 설정 화면용)
export async function GET() {
  try {
    const { prisma } = await import("@repo/db");
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true, name: true, slug: true, icon: true, color: true,
        sortOrder: true, isOption: true,
        products: {
          where: { isActive: true },
          select: { price: true },
        },
      },
    });

    const result = categories.map((c) => {
      const prices = c.products.map((p) => p.price);
      const min = prices.length ? Math.min(...prices) : 0;
      const max = prices.length ? Math.max(...prices) : 0;
      const avg = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        icon: c.icon,
        color: c.color,
        sortOrder: c.sortOrder,
        isOption: c.isOption,
        priceMin: min,
        priceMax: max,
        priceAvg: avg,
        productCount: prices.length,
      };
    });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (err) {
    console.error("GET /api/categories/price-range error:", err);
    return NextResponse.json([]);
  }
}
