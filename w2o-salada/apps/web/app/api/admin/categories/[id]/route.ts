import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../../lib/auth-guard";

// PATCH: 카테고리 수정
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin("products");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, slug, sortOrder, icon, color, isActive, isOption } = body;
    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(icon !== undefined && { icon }),
        ...(color !== undefined && { color }),
        ...(isActive !== undefined && { isActive }),
        ...(isOption !== undefined && { isOption }),
      },
    });
    return NextResponse.json(category);
  } catch (err) {
    console.error("PATCH /api/admin/categories/[id] error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// DELETE: 카테고리 삭제
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin("products");
  if (error) return error;

  try {
    const { id } = await params;
    // 연결된 상품이 있는지 확인
    const productCount = await prisma.product.count({ where: { categoryId: id } });
    if (productCount > 0) {
      return NextResponse.json(
        { error: `이 카테고리에 ${productCount}개의 상품이 있어 삭제할 수 없습니다.` },
        { status: 400 }
      );
    }
    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ message: "삭제 완료" });
  } catch (err) {
    console.error("DELETE /api/admin/categories/[id] error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
