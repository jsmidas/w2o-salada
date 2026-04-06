import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../lib/auth-guard";

// GET: 해당 월 배송일 조회
export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const calendars = await prisma.deliveryCalendar.findMany({
    where: { date: { gte: startDate, lte: endDate } },
    include: {
      menuAssignments: {
        include: { product: { include: { category: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(calendars);
}

// POST: 배송일 일괄 저장 (해당 월)
export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const { year, month, dates } = body as {
    year: number;
    month: number;
    dates: { date: string; isActive: boolean; memo?: string }[];
  };

  if (!year || !month || !dates) {
    return NextResponse.json({ error: "year, month, dates 필수" }, { status: 400 });
  }

  // 각 날짜에 대해 upsert
  for (const d of dates) {
    const dateObj = new Date(d.date);
    await prisma.deliveryCalendar.upsert({
      where: { date: dateObj },
      update: { isActive: d.isActive, memo: d.memo || null },
      create: { date: dateObj, isActive: d.isActive, memo: d.memo || null },
    });
  }

  // 이 월에서 dates에 포함되지 않은 기존 배송일은 비활성화
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  const activeDates = dates.filter((d) => d.isActive).map((d) => new Date(d.date));

  if (activeDates.length === 0) {
    await prisma.deliveryCalendar.updateMany({
      where: { date: { gte: startDate, lte: endDate } },
      data: { isActive: false },
    });
  }

  // 결과 반환
  const result = await prisma.deliveryCalendar.findMany({
    where: { date: { gte: startDate, lte: endDate } },
    include: {
      menuAssignments: {
        include: { product: { include: { category: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(result);
}
