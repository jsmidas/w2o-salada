import { NextResponse } from "next/server";
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
    const entries = Object.entries(body) as [string, string][];

    for (const [key, value] of entries) {
      await prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }

    return NextResponse.json({ message: "저장 완료", count: entries.length });
  } catch (err) {
    console.error("POST /api/admin/settings error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
