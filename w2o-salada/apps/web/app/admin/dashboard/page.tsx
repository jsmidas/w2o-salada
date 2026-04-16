import { prisma } from "@repo/db";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
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
    recentOrders,
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
    prisma.order.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const initialStats = {
    todayOrders,
    todayRevenue: todayRevenueAgg._sum.amount ?? 0,
    pendingOrders,
    preparingOrders,
    shippingOrders,
    totalProducts,
    totalMembers,
    activeSubscriptions,
  };

  return (
    <DashboardClient
      initialStats={initialStats}
      initialOrders={JSON.parse(JSON.stringify(recentOrders))}
    />
  );
}
