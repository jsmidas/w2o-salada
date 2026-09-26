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
                singlePrice: true,
                price: true,
                kcal: true,
                tags: true,
                imageUrl: true,
                category: { select: { name: true, slug: true, isOption: true } },
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { date: "asc" },
    });

    // 관리자가 배송일·대체 요일을 바꾸면 고객 화면에 곧 보여야 하므로 CDN 캐시를 짧게 둔다 (전엔 5분+10분 stale)
    return NextResponse.json(calendars, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" },
    });
  } catch {
    return NextResponse.json([]);
  }
}
