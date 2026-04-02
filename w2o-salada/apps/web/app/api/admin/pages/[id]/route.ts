import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../../lib/auth-guard";

// GET: 상세페이지 데이터 조회
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params; // productId
    const page = await prisma.productPage.findUnique({
      where: { productId: id },
    });
    return NextResponse.json(page);
  } catch (err) {
    console.error("GET /api/admin/pages/[id] error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// PUT: 상세페이지 저장 (upsert)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params; // productId
    const body = await request.json();

    const page = await prisma.productPage.upsert({
      where: { productId: id },
      update: {
        heroImages: body.heroImages ?? null,
        subtitle: body.subtitle ?? null,
        featureTitle: body.featureTitle ?? null,
        featureDescription: body.featureDescription ?? null,
        featureImages: body.featureImages ?? null,
        keyPoints: body.keyPoints ?? null,
        specs: body.specs ?? null,
        detailDescription: body.detailDescription ?? null,
        detailImages: body.detailImages ?? null,
        nutrition: body.nutrition ?? null,
        galleryImages: body.galleryImages ?? null,
        sectionOrder: body.sectionOrder ?? null,
        isPublished: body.isPublished ?? false,
      },
      create: {
        productId: id,
        heroImages: body.heroImages ?? null,
        subtitle: body.subtitle ?? null,
        featureTitle: body.featureTitle ?? null,
        featureDescription: body.featureDescription ?? null,
        featureImages: body.featureImages ?? null,
        keyPoints: body.keyPoints ?? null,
        specs: body.specs ?? null,
        detailDescription: body.detailDescription ?? null,
        detailImages: body.detailImages ?? null,
        nutrition: body.nutrition ?? null,
        galleryImages: body.galleryImages ?? null,
        sectionOrder: body.sectionOrder ?? null,
        isPublished: body.isPublished ?? false,
      },
    });

    return NextResponse.json(page);
  } catch (err) {
    console.error("PUT /api/admin/pages/[id] error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
