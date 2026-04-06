import { NextResponse } from "next/server";
import { prisma } from "@repo/db";

// GET: 특정 월의 식단 조회 (공개)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));

  try {
    const schedules = await prisma.menuSchedule.findMany({
      where: { year, month },
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
      orderBy: [{ week: "asc" }, { day: "asc" }, { slot: "asc" }],
    });

    return NextResponse.json(schedules);
  } catch {
    return NextResponse.json([]);
  }
}
