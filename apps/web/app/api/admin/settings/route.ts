import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../lib/auth-guard";

// GET: 모든 설정 조회
export async function GET() {
  const { error } = await requireAdmin("system");
  if (error) return error;

  try {
    const settings = await prisma.setting.findMany();
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/admin/settings error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// POST: 설정 저장 (여러 키-값 한번에)
export async function POST(request: Request) {
  const { error } = await requireAdmin("system");
  if (error) return error;

  try {
    const body = await request.json();
    const entries = Object.entries(body) as [string, unknown][];

    // 키 형식 + 숫자 키 검증. "11,000" 같은 값이 들어가면 NaN 비교로 최소 주문액 검사가 통째로 뚫렸다
    const NUMERIC_KEYS = new Set(["minOrderAmount", "deliveryFee", "freeShippingMin", "deliveryRadiusKm", "deliveryCenterLat", "deliveryCenterLng", "refundFeePercent"]);
    const RESERVED_PREFIX = ["sidebar.", "subscribe."]; // 다른 화면이 관리하는 키는 여기서 덮어쓰지 않는다
    for (const [key, raw] of entries) {
      if (!/^[A-Za-z0-9_.]{1,64}$/.test(key)) return NextResponse.json({ error: `설정 키가 올바르지 않습니다: ${key}` }, { status: 400 });
      if (RESERVED_PREFIX.some((p) => key.startsWith(p))) return NextResponse.json({ error: `${key} 는 이 화면에서 바꿀 수 없습니다.` }, { status: 400 });
      if (NUMERIC_KEYS.has(key)) {
        const n = Number(String(raw).replace(/,/g, "").trim());
        if (String(raw).trim() !== "" && !Number.isFinite(n)) return NextResponse.json({ error: `${key} 는 숫자여야 합니다.` }, { status: 400 });
        if (key !== "deliveryCenterLat" && key !== "deliveryCenterLng" && n < 0) return NextResponse.json({ error: `${key} 는 0 이상이어야 합니다.` }, { status: 400 });
        if (key === "refundFeePercent" && n > 100) return NextResponse.json({ error: "수수료율은 100 이하여야 합니다." }, { status: 400 });
      }
    }

    for (const [key, raw] of entries) {
      const value = NUMERIC_KEYS.has(key) && String(raw).trim() !== "" ? String(Number(String(raw).replace(/,/g, "").trim())) : String(raw);
      await prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }

    // 메인 페이지 footer가 Setting 값을 읽으므로 저장 즉시 재검증
    revalidatePath("/");

    return NextResponse.json({ message: "저장 완료", count: entries.length });
  } catch (err) {
    console.error("POST /api/admin/settings error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
