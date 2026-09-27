import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { auth } from "../../../auth";

// GET: 리뷰 목록 (공개, productId 필터 가능)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = parseInt(searchParams.get("offset") || "0");

  const where: Record<string, unknown> = { isVisible: true };
  if (productId) where.productId = productId;

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, imageUrl: true, category: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.review.count({ where }),
  ]);

  return NextResponse.json({ reviews, total });
}

// POST: 리뷰 작성 (로그인 필수)
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json();
  const { productId, orderId, rating, content, images } = body;

  if (!productId || !rating || !content) {
    return NextResponse.json({ error: "상품, 별점, 내용은 필수입니다." }, { status: 400 });
  }

  if (rating < 1 || rating > 5) {
    return NextResponse.json({ error: "별점은 1~5 사이여야 합니다." }, { status: 400 });
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "사용자 정보를 찾을 수 없습니다." }, { status: 401 });
  }

  if (!Number.isInteger(rating)) {
    return NextResponse.json({ error: "별점은 정수여야 합니다." }, { status: 400 });
  }
  const text = String(content).trim();
  if (text.length < 5 || text.length > 1000) {
    return NextResponse.json({ error: "리뷰는 5자 이상 1000자 이하로 적어주세요." }, { status: 400 });
  }

  // 받아본 상품만 — 이 사용자의 배송 완료 주문에 그 상품이 있어야 한다
  const delivered = await prisma.order.findFirst({
    where: {
      userId,
      status: "DELIVERED",
      ...(orderId ? { id: String(orderId) } : {}),
      items: { some: { productId } },
    },
    select: { id: true },
  });
  if (!delivered) {
    return NextResponse.json({ error: "배송받은 상품에만 리뷰를 남길 수 있습니다." }, { status: 403 });
  }

  // 이미지는 우리 스토리지 URL 만 (외부 링크 삽입 방지), 최대 5장
  const storageBase = process.env.NEXT_PUBLIC_SUPABASE_URL ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/` : null;
  const safeImages = Array.isArray(images)
    ? images.filter((u: unknown): u is string => typeof u === "string" && !!storageBase && u.startsWith(storageBase)).slice(0, 5)
    : [];

  // 동일 상품에 중복 리뷰 방지
  const existing = await prisma.review.findFirst({
    where: { userId, productId },
  });
  if (existing) {
    return NextResponse.json({ error: "이미 이 상품에 리뷰를 작성하셨습니다." }, { status: 409 });
  }

  const review = await prisma.review.create({
    data: {
      userId,
      productId,
      orderId: delivered.id,
      rating,
      content: text,
      images: safeImages.length > 0 ? JSON.stringify(safeImages) : null,
    },
    include: {
      user: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, imageUrl: true } },
    },
  });

  return NextResponse.json(review, { status: 201 });
}
