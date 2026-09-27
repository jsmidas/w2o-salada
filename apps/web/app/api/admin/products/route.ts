import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../lib/auth-guard";
import { intOrNull, cleanText } from "../../../lib/validate";

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
    // 가격은 0 이상 정수만 — "" 가 Number("")=0 으로 들어와 0원 본품이 등록되던 구멍
    const name = cleanText(body.name, 100);
    const price = intOrNull(body.price, { min: 1 });
    const originalPrice = intOrNull(body.originalPrice, { min: 0 });
    const singlePrice = intOrNull(body.singlePrice, { min: 0 });
    const nextPrice = intOrNull(body.nextPrice, { min: 1 });
    const dailyLimit = intOrNull(body.dailyLimit, { min: 1 });
    const kcal = intOrNull(body.kcal, { min: 0 });
    if (!name) return NextResponse.json({ error: "상품명을 입력하세요." }, { status: 400 });
    if (price === null || price === "invalid") return NextResponse.json({ error: "판매가는 1원 이상 정수여야 합니다." }, { status: 400 });
    if ([originalPrice, singlePrice, nextPrice, dailyLimit, kcal].includes("invalid")) return NextResponse.json({ error: "숫자 항목이 올바르지 않습니다." }, { status: 400 });
    const category = body.categoryId ? await prisma.category.findUnique({ where: { id: String(body.categoryId) }, select: { id: true } }) : null;
    if (!category) return NextResponse.json({ error: "카테고리를 선택하세요." }, { status: 400 });

    const product = await prisma.product.create({
      data: {
        name,
        categoryId: category.id,
        originalPrice: originalPrice as number | null,
        singlePrice: singlePrice as number | null,
        price,
        kcal: kcal as number | null,
        description: cleanText(body.description, 2000),
        tags: body.tags ?? null,
        imageUrl: cleanText(body.imageUrl, 500),
        isActive: body.isActive ?? true,
        dailyLimit: dailyLimit as number | null,
        availableDays: body.availableDays ?? null,
        nextPrice: nextPrice as number | null,
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
