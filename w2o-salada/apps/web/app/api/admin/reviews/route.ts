import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../lib/auth-guard";

// GET: 전체 리뷰 (관리자)
export async function GET() {
  const { error } = await requireAdmin("customers");
  if (error) return error;

  const reviews = await prisma.review.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      product: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(reviews);
}

// PATCH: 리뷰 숨김/표시 토글
export async function PATCH(request: Request) {
  const { error } = await requireAdmin("customers");
  if (error) return error;

  const { id, isVisible } = await request.json();
  if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });

  const review = await prisma.review.update({
    where: { id },
    data: { isVisible },
  });

  return NextResponse.json(review);
}

// DELETE: 리뷰 삭제
export async function DELETE(request: Request) {
  const { error } = await requireAdmin("customers");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });

  await prisma.review.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
