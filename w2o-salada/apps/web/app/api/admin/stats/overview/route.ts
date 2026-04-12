import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../../lib/auth-guard";

export async function GET() {
  const { error } = await requireAdmin("dashboard");
  if (error) return error;

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      todayOrders,
      todayRevenueAgg,
      pendingOrders,
      preparingOrders,
      shippingOrders,
      totalProducts,
      totalMembers,
      activeSubscriptions,
    ] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.payment.aggregate({
        where: { status: "DONE", createdAt: { gte: todayStart } },
        _sum: { amount: true },
      }),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.order.count({ where: { status: "PREPARING" } }),
      prisma.order.count({ where: { status: "SHIPPING" } }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
    ]);

    return NextResponse.json({
      todayOrders,
      todayRevenue: todayRevenueAgg._sum.amount ?? 0,
      pendingOrders,
      preparingOrders,
      shippingOrders,
      totalProducts,
      totalMembers,
      activeSubscriptions,
    });
  } catch (err) {
    console.error("GET /api/admin/stats/overview error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
