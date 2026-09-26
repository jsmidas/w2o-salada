import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../lib/auth-guard";

// GET: 해당 월 배송일 조회
export async function GET(request: Request) {
  const { error } = await requireAdmin("orders");
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

// POST: 배송일 저장
//  - 기본: body.dates에 담긴 날짜만 반영한다 (단일 날짜 토글용)
//  - replaceMonth=true: 달 전체를 덮어쓴다. dates에 없는 날짜는 비활성화
export async function POST(request: Request) {
  const { error } = await requireAdmin("orders");
  if (error) return error;

  const body = await request.json();
  const { year, month, dates, replaceMonth } = body as {
    year: number;
    month: number;
    dates: { date: string; isActive: boolean; memo?: string }[];
    replaceMonth?: boolean;
  };

  if (!year || !month || !dates) {
    return NextResponse.json({ error: "year, month, dates 필수" }, { status: 400 });
  }

  // 각 날짜에 대해 upsert (트랜잭션으로 일괄 처리)
  await prisma.$transaction(
    dates.map((d) => {
      const dateObj = new Date(d.date);
      return prisma.deliveryCalendar.upsert({
        where: { date: dateObj },
        update: { isActive: d.isActive, memo: d.memo || null },
        create: { date: dateObj, isActive: d.isActive, memo: d.memo || null },
      });
    })
  );

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  // 달 전체를 덮어쓰는 호출(화/목 일괄 지정)에서만 나머지 날짜를 비활성화한다.
  // 예전에는 "activeDates.length === 0이면 달 전체 비활성화"였는데,
  // 단일 날짜 토글로 배송일 하나를 끄면 그 달 전체가 꺼지는 버그가 있었다.
  if (replaceMonth) {
    const touched = dates.map((d) => new Date(d.date));
    await prisma.deliveryCalendar.updateMany({
      where: {
        date: { gte: startDate, lte: endDate },
        NOT: { date: { in: touched } },
      },
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
