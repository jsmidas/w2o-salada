import { prisma } from "@repo/db";
import { pushDuePrices } from "../../lib/effective-price";
import ProductsClient from "./ProductsClient";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  await pushDuePrices();
  const products = await prisma.product.findMany({
    include: { category: true },
    orderBy: { sortOrder: "asc" },
  });

  return <ProductsClient initialProducts={JSON.parse(JSON.stringify(products))} />;
}
