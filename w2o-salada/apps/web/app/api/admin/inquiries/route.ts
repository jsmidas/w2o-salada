import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../lib/auth-guard";

// GET: 문의 목록 (최신순, 상태 필터)
export async function GET(request: Request) {
  const { error } = await requireAdmin("customers");
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // PENDING, IN_PROGRESS, RESOLVED
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20"));

    const where = status ? { status: status as "PENDING" | "IN_PROGRESS" | "RESOLVED" } : {};

    const [inquiries, total] = await Promise.all([
      prisma.inquiry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.inquiry.count({ where }),
    ]);

    const pending = await prisma.inquiry.count({ where: { status: "PENDING" } });

    return NextResponse.json({ inquiries, total, page, limit, pending });
  } catch (err) {
    console.error("GET /api/admin/inquiries error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
