import { NextResponse } from "next/server";

// 기본값
const DEFAULTS: Record<string, string> = {
  "subscribe.minItems": "1", // 회당 최소 개수 — 실제 하한은 본품 최소 주문액(11,000원)이 정한다
  "subscribe.maxItems": "6", // 회당 최대 개수 — 포장·적재 편의용 상한. /admin/subscribe-settings 에서 변경
  "subscribe.salad.price": "5900",
  "subscribe.salad.originalPrice": "7500",
  "subscribe.trial.price": "6900",
  "subscribe.deliveryFee": "0",
  "subscribe.weeksPerMonth": "4",
  "subscribe.deliveryDays": "tue,thu",
};

// GET: 구독 설정 조회 (공개)
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
