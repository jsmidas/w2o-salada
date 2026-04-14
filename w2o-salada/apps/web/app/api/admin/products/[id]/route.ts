import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../../lib/auth-guard";

// PATCH: 상품 수정
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin("products");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();

    // 부분 업데이트: body에 명시된 필드만 갱신 (가격만 수정 등 단일 필드 PATCH 지원)
    const data: Record<string, unknown> = {};
    if ("name" in body) data.name = body.name;
    if ("categoryId" in body) data.categoryId = body.categoryId;
    if ("originalPrice" in body) data.originalPrice = body.originalPrice ?? null;
    if ("singlePrice" in body) data.singlePrice = body.singlePrice ?? null;
    if ("price" in body) data.price = body.price;
    if ("kcal" in body) data.kcal = body.kcal ?? null;
    if ("description" in body) data.description = body.description ?? null;
    if ("tags" in body) data.tags = body.tags ?? null;
    if ("imageUrl" in body) data.imageUrl = body.imageUrl ?? null;
    if ("isActive" in body) data.isActive = body.isActive;
    if ("dailyLimit" in body) data.dailyLimit = body.dailyLimit ?? null;
    if ("availableDays" in body) data.availableDays = body.availableDays ?? null;
    if ("nextPrice" in body) data.nextPrice = body.nextPrice ?? null;
    if ("nextPriceEffectiveFrom" in body) {
      data.nextPriceEffectiveFrom = body.nextPriceEffectiveFrom
        ? new Date(body.nextPriceEffectiveFrom)
        : null;
    }

    const product = await prisma.product.update({ where: { id }, data });
    return NextResponse.json(product);
  } catch (err) {
    console.error("PATCH /api/admin/products/[id] error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// DELETE: 상품 삭제
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin("products");
  if (error) return error;

  try {
    const { id } = await params;
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ message: "삭제 완료" });
  } catch (err) {
    console.error("DELETE /api/admin/products/[id] error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
