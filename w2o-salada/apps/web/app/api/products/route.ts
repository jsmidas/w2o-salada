import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { pushDuePrices } from "../../lib/effective-price";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  try {
    await pushDuePrices();
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(category && category !== "all"
          ? { category: { slug: category } }
          : {}),
      },
      include: { category: true },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(products);
  } catch (err) {
    console.error("GET /api/products error:", err);
    // DB 장애 시에도 프론트가 깨지지 않도록 빈 배열 반환
    return NextResponse.json([]);
  }
}
