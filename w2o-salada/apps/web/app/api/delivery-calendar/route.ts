import { NextResponse } from "next/server";

// GET: 해당 월 배송일 + 메뉴 조회 (공개)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
  const months = parseInt(searchParams.get("months") || "1"); // 여러 달 한번에 조회

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month - 1 + months, 0, 23, 59, 59);

  try {
    const { prisma } = await import("@repo/db");
    const calendars = await prisma.deliveryCalendar.findMany({
      where: { date: { gte: startDate, lte: endDate }, isActive: true },
      include: {
        menuAssignments: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                description: true,
                originalPrice: true,
                price: true,
                kcal: true,
                tags: true,
                imageUrl: true,
                category: { select: { name: true, slug: true } },
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { date: "asc" },
    });

    return NextResponse.json(calendars, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json([]);
  }
}
