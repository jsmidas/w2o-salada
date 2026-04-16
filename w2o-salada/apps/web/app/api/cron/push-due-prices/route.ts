import { NextResponse } from "next/server";
import { pushDuePrices } from "../../../lib/effective-price";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

// 예약 인상가 승격 (매일 KST 00:05 실행)
// Product.nextPriceEffectiveFrom 도래분 일괄로 price ← nextPrice 승격.
// idempotent — 도래분이 없으면 0 row.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const promoted = await pushDuePrices();
    return NextResponse.json({ ok: true, promoted });
  } catch (err) {
    console.error("GET /api/cron/push-due-prices error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
