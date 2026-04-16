import { prisma } from "@repo/db";
import OrdersClient from "./OrdersClient";

export const dynamic = "force-dynamic";

const LIMIT = 20;

export default async function OrdersPage() {
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      include: {
        user: true,
        items: { include: { product: true } },
        payments: true,
        delivery: true,
      },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    }),
    prisma.order.count(),
  ]);

  const payload = {
    orders: JSON.parse(JSON.stringify(orders)),
    pagination: {
      page: 1,
      limit: LIMIT,
      total,
      totalPages: Math.max(1, Math.ceil(total / LIMIT)),
    },
  };

  return <OrdersClient initialData={payload} />;
}
