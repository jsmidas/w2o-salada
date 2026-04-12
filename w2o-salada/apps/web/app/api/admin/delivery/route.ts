import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../lib/auth-guard";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;

  try {
    const { searchParams } = request.nextUrl;
    const date = searchParams.get("date");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};

    if (date) {
      const targetDate = new Date(date);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      where.scheduledDate = {
        gte: targetDate,
        lt: nextDay,
      };
    }

    if (status) {
      where.status = status;
    }

    const deliveries = await prisma.delivery.findMany({
      where,
      include: {
        order: {
          include: {
            user: true,
            address: true,
            items: { include: { product: true } },
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ deliveries });
  } catch (err) {
    console.error("GET /api/admin/delivery error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
