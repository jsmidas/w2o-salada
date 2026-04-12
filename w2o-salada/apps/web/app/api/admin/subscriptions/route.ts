import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../lib/auth-guard";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin("subscriptions");
  if (error) return error;

  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");
    const plan = searchParams.get("plan");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }
    if (plan) {
      where.selectionMode = plan;
    }
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          user: true,
          items: { include: { product: true } },
          periods: { orderBy: { year: "desc" }, take: 3 },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.subscription.count({ where }),
    ]);

    return NextResponse.json({
      subscriptions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("GET /api/admin/subscriptions error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
