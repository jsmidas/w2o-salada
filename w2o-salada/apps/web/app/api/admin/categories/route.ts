import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../lib/auth-guard";

// GET: 카테고리 목록 (상품 수 포함)
export async function GET() {
  const { error } = await requireAdmin("products");
  if (error) return error;

  try {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { products: true } } },
    });
    return NextResponse.json(categories);
  } catch (err) {
    console.error("GET /api/admin/categories error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// POST: 카테고리 추가
export async function POST(request: Request) {
  const { error } = await requireAdmin("products");
  if (error) return error;

  try {
    const { name, slug, sortOrder, icon, color, isActive, isOption } = await request.json();
    const category = await prisma.category.create({
      data: {
        name,
        slug,
        sortOrder: sortOrder ?? 0,
        icon: icon ?? null,
        color: color ?? null,
        isActive: isActive ?? true,
        isOption: isOption ?? false,
      },
    });
    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/categories error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
