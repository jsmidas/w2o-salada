import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../lib/auth-guard";

// GET: 상품 목록
export async function GET() {
  const { error } = await requireAdmin("products");
  if (error) return error;

  try {
    const products = await prisma.product.findMany({
      include: { category: true },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(products);
  } catch (err) {
    console.error("GET /api/admin/products error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// POST: 상품 등록
export async function POST(request: Request) {
  const { error } = await requireAdmin("products");
  if (error) return error;

  try {
    const body = await request.json();
    const product = await prisma.product.create({
      data: {
        name: body.name,
        categoryId: body.categoryId,
        originalPrice: body.originalPrice ?? null,
        singlePrice: body.singlePrice ?? null,
        price: body.price,
        kcal: body.kcal ?? null,
        description: body.description ?? null,
        tags: body.tags ?? null,
        imageUrl: body.imageUrl ?? null,
        isActive: body.isActive ?? true,
        dailyLimit: body.dailyLimit ?? null,
        availableDays: body.availableDays ?? null,
        nextPrice: body.nextPrice ?? null,
        nextPriceEffectiveFrom: body.nextPriceEffectiveFrom
          ? new Date(body.nextPriceEffectiveFrom)
          : null,
      },
    });
    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/products error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
