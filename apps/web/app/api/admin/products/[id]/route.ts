import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../../lib/auth-guard";
import { intOrNull } from "../../../../lib/validate";

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
    // 숫자 항목 검증 (0원 상품·문자열 가격 방지)
    const numField = (key: string, min: number, allowNull: boolean) => {
      if (!(key in body)) return null;
      const v = intOrNull(body[key], { min });
      if (v === "invalid" || (v === null && !allowNull)) return `${key} 값이 올바르지 않습니다.`;
      data[key] = v;
      return null;
    };
    for (const [k, min, nullable] of [["price", 1, false], ["originalPrice", 0, true], ["singlePrice", 0, true], ["nextPrice", 1, true], ["dailyLimit", 1, true], ["kcal", 0, true], ["stock", 0, false]] as const) {
      const err = numField(k, min, nullable);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }
    if ("name" in body) {
      const name = String(body.name ?? "").trim();
      if (!name) return NextResponse.json({ error: "상품명을 입력하세요." }, { status: 400 });
      data.name = name.slice(0, 100);
    }
    if ("categoryId" in body) {
      const c = await prisma.category.findUnique({ where: { id: String(body.categoryId) }, select: { id: true } });
      if (!c) return NextResponse.json({ error: "카테고리가 없습니다." }, { status: 400 });
      data.categoryId = c.id;
    }
    if ("description" in body) data.description = body.description ?? null;
    if ("tags" in body) data.tags = body.tags ?? null;
    if ("imageUrl" in body) data.imageUrl = body.imageUrl ?? null;
    if ("isActive" in body) data.isActive = body.isActive;
    if ("availableDays" in body) data.availableDays = body.availableDays ?? null;
    if ("nextPriceEffectiveFrom" in body) {
      data.nextPriceEffectiveFrom = body.nextPriceEffectiveFrom
        ? new Date(body.nextPriceEffectiveFrom)
        : null;
    }

    const product = await prisma.product.update({ where: { id }, data });

    // 이미지/가격/이름 등 변경 즉시 공개 페이지에 반영
    revalidatePath("/");
    revalidatePath("/menu");
    revalidatePath(`/products/${id}`);

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
    // 주문·구독·식단에 쓰인 상품은 지우면 FK 오류(500)가 났다 → 참조가 있으면 판매 중지(소프트 삭제)
    const [orderRefs, subRefs, selRefs, menuRefs] = await Promise.all([
      prisma.orderItem.count({ where: { productId: id } }),
      prisma.subscriptionItem.count({ where: { productId: id } }),
      prisma.subscriptionSelection.count({ where: { productId: id } }),
      prisma.menuAssignment.count({ where: { productId: id } }),
    ]);
    const refs = orderRefs + subRefs + selRefs + menuRefs;
    if (refs > 0) {
      await prisma.product.update({ where: { id }, data: { isActive: false } });
      revalidatePath("/");
      revalidatePath("/menu");
      return NextResponse.json({ message: `주문·구독·식단 기록 ${refs}건이 참조하고 있어 삭제 대신 판매 중지 처리했습니다.`, softDeleted: true });
    }
    await prisma.$transaction([
      prisma.productPage.deleteMany({ where: { productId: id } }),
      prisma.product.delete({ where: { id } }),
    ]);

    revalidatePath("/");
    revalidatePath("/menu");

    return NextResponse.json({ message: "삭제 완료" });
  } catch (err) {
    console.error("DELETE /api/admin/products/[id] error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
