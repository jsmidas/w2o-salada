import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../lib/auth-guard";

// GET: 모든 상품의 상세페이지 상태
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const products = await prisma.product.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        isActive: true,
      },
    });

    const pages = await prisma.productPage.findMany({
      select: {
        productId: true,
        isPublished: true,
        updatedAt: true,
      },
    });

    const pageMap = new Map(pages.map((p) => [p.productId, p]));

    const result = products.map((product) => ({
      ...product,
      page: pageMap.get(product.id) ?? null,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/admin/pages error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
