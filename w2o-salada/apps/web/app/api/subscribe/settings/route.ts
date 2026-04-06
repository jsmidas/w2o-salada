import { NextResponse } from "next/server";
import { prisma } from "@repo/db";

// 기본값
const DEFAULTS: Record<string, string> = {
  "subscribe.minItems": "2",
  "subscribe.maxItems": "2",
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
    const keys = Object.keys(DEFAULTS);
    const settings = await prisma.setting.findMany({
      where: { key: { in: keys } },
    });

    const result: Record<string, string> = { ...DEFAULTS };
    for (const s of settings) {
      result[s.key] = s.value;
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(DEFAULTS);
  }
}
