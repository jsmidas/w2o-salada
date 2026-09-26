import { NextResponse } from "next/server";

const DEFAULTS: Record<string, string> = {
  minOrderAmount: "11000",
  // 배송비는 무료 정책이지만, 값을 코드에 박지 않고 관리자 설정을 따른다
  deliveryFee: "0",
  freeShippingMin: "11000",
};

// GET: 공개 설정 조회 (최소 주문액 등, 고객 UI에서 사용)
export async function GET() {
  try {
    const { prisma } = await import("@repo/db");
    const keys = Object.keys(DEFAULTS);
    const settings = await prisma.setting.findMany({
      where: { key: { in: keys } },
    });

    const result: Record<string, string> = { ...DEFAULTS };
    for (const s of settings) {
      result[s.key] = s.value;
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch {
    return NextResponse.json(DEFAULTS);
  }
}
