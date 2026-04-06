import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../lib/auth-guard";

// GET: 특정 날짜의 식단 배정 조회
export async function GET(request: Request) {
  const { error } = await requireAdmin();
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
  const { error } = await requireAdmin();
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

  // 기존 배정 삭제 후 새로 생성
  await prisma.menuAssignment.deleteMany({
    where: { deliveryCalendarId: calendar.id },
  });

  if (productIds.length > 0) {
    await prisma.menuAssignment.createMany({
      data: productIds.map((p) => ({
        deliveryCalendarId: calendar.id,
        productId: p.id,
        sortOrder: p.sortOrder,
      })),
    });
  }

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
