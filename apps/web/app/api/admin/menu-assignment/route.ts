import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../lib/auth-guard";

// GET: 특정 날짜의 식단 배정 조회
export async function GET(request: Request) {
  const { error } = await requireAdmin("orders");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date");

  if (!dateStr) {
    return NextResponse.json({ error: "date 파라미터 필수" }, { status: 400 });
  }

  const calendar = await prisma.deliveryCalendar.findUnique({
    where: { date: new Date(dateStr) },
    include: {
      menuAssignments: {
        include: { product: { include: { category: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return NextResponse.json(calendar);
}

// POST: 특정 날짜의 식단 배정 저장
export async function POST(request: Request) {
  const { error } = await requireAdmin("orders");
  if (error) return error;

  const body = await request.json();
  const { date, productIds } = body as {
    date: string;
    productIds: { id: string; sortOrder: number }[];
  };

  if (!date || !productIds) {
    return NextResponse.json({ error: "date, productIds 필수" }, { status: 400 });
  }

  // 배송일이 없으면 생성
  const calendar = await prisma.deliveryCalendar.upsert({
    where: { date: new Date(date) },
    update: {},
    create: { date: new Date(date), isActive: true },
  });

  // 상품 존재 확인 — 지워진 상품 id 가 섞이면 삭제만 되고 생성이 실패해 그날 메뉴가 통째로 비었다
  const ids = Array.from(new Set(productIds.map((p) => p.id)));
  if (ids.length > 0) {
    const found = await prisma.product.count({ where: { id: { in: ids } } });
    if (found !== ids.length) return NextResponse.json({ error: "존재하지 않는 상품이 포함돼 있습니다. 화면을 새로고침한 뒤 다시 저장하세요." }, { status: 400 });
  }

  // 기존 배정 삭제 + 새로 생성을 한 트랜잭션으로
  await prisma.$transaction([
    prisma.menuAssignment.deleteMany({ where: { deliveryCalendarId: calendar.id } }),
    ...(ids.length > 0
      ? [prisma.menuAssignment.createMany({
          data: ids.map((id) => ({ deliveryCalendarId: calendar.id, productId: id, sortOrder: productIds.find((p) => p.id === id)?.sortOrder ?? 0 })),
          skipDuplicates: true,
        })]
      : []),
  ]);

  const result = await prisma.deliveryCalendar.findUnique({
    where: { id: calendar.id },
    include: {
      menuAssignments: {
        include: { product: { include: { category: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return NextResponse.json(result);
}
