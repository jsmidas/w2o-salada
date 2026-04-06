import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../lib/auth-guard";

// GET: 특정 월의 식단 배정 조회
export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));

  const schedules = await prisma.menuSchedule.findMany({
    where: { year, month },
    include: { product: { include: { category: true } } },
    orderBy: [{ week: "asc" }, { day: "asc" }, { slot: "asc" }],
  });

  return NextResponse.json(schedules);
}

// POST: 식단 배정 저장 (해당 월 전체를 덮어쓰기)
export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const { year, month, entries } = body as {
    year: number;
    month: number;
    entries: { week: number; day: string; slot: number; productId: string }[];
  };

  if (!year || !month || !entries) {
    return NextResponse.json({ error: "year, month, entries 필수" }, { status: 400 });
  }

  // 해당 월 기존 데이터 삭제 후 재생성
  await prisma.menuSchedule.deleteMany({ where: { year, month } });

  if (entries.length > 0) {
    await prisma.menuSchedule.createMany({
      data: entries.map((e) => ({
        year,
        month,
        week: e.week,
        day: e.day,
        slot: e.slot,
        productId: e.productId,
      })),
    });
  }

  const saved = await prisma.menuSchedule.findMany({
    where: { year, month },
    include: { product: { include: { category: true } } },
    orderBy: [{ week: "asc" }, { day: "asc" }, { slot: "asc" }],
  });

  return NextResponse.json(saved);
}
