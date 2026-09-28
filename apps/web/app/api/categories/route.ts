import { NextResponse } from "next/server";
import { prisma } from "@repo/db";

// /api/products 와 같은 이유로 CDN 30초 캐시
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(categories, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
  } catch (err) {
    console.error("GET /api/categories error:", err);
    return NextResponse.json([]);
  }
}
