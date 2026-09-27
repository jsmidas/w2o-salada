import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../../lib/auth-guard";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin("dashboard");
  if (error) return error;

  try {
    const { searchParams } = request.nextUrl;
    const period = searchParams.get("period") ?? "daily";
    const days = parseInt(searchParams.get("days") ?? "30", 10);

    const { kstDayStart } = await import("../../../../lib/cutoff");
    const startDate = new Date(kstDayStart().getTime() - days * 86400000); // KST 자정 기준 N일 전

    const payments = await prisma.payment.findMany({
      where: {
        status: "DONE",
        createdAt: { gte: startDate },
      },
      select: {
        amount: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Group by period
    const grouped = new Map<string, number>();

    for (const payment of payments) {
      // KST 벽시계로 옮겨 UTC 게터로 읽는다 — 자정~09시 결제가 전날로 잡히지 않게
      const date = new Date(payment.createdAt.getTime() + 9 * 60 * 60 * 1000);
      let key: string;

      if (period === "monthly") {
        key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      } else if (period === "weekly") {
        const weekStart = new Date(date);
        weekStart.setUTCDate(date.getUTCDate() - date.getUTCDay());
        key = weekStart.toISOString().split("T")[0] as string;
      } else {
        key = date.toISOString().split("T")[0] as string;
      }

      grouped.set(key, (grouped.get(key) ?? 0) + payment.amount);
    }

    const revenue = Array.from(grouped.entries()).map(
      ([dateKey, amount]: [string, number]) => ({
        date: dateKey,
        amount,
      })
    );

    const totalRevenue = payments.reduce(
      (sum: number, p: { amount: number }) => sum + p.amount,
      0
    );

    return NextResponse.json({
      period,
      days,
      totalRevenue,
      data: revenue,
    });
  } catch (err) {
    console.error("GET /api/admin/stats/revenue error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
