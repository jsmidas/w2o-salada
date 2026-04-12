import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../lib/auth-guard";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;

  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const search = searchParams.get("search");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }
    if (type) {
      where.type = type;
    }
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { id: { contains: search } },
      ];
    }
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: true,
          items: { include: { product: true } },
          payments: true,
          delivery: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("GET /api/admin/orders error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
