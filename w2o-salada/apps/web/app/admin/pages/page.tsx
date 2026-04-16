import { prisma } from "@repo/db";
import PagesListClient from "./PagesListClient";

export const dynamic = "force-dynamic";

export default async function PagesListPage() {
  const [products, pages] = await Promise.all([
    prisma.product.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, imageUrl: true, isActive: true },
    }),
    prisma.productPage.findMany({
      select: { productId: true, isPublished: true, updatedAt: true },
    }),
  ]);

  const pageMap = new Map(pages.map((p) => [p.productId, p]));
  const result = products.map((product) => ({
    ...product,
    page: pageMap.get(product.id)
      ? {
          productId: product.id,
          isPublished: pageMap.get(product.id)!.isPublished,
          updatedAt: pageMap.get(product.id)!.updatedAt.toISOString(),
        }
      : null,
  }));

  return <PagesListClient initialProducts={result} />;
}
