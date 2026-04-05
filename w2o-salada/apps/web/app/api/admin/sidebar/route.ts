import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../lib/auth-guard";

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const value = JSON.stringify(body);

    await prisma.setting.upsert({
      where: { key: "sidebar.config" },
      update: { value },
      create: { key: "sidebar.config", value },
    });

    return NextResponse.json({ message: "저장 완료" });
  } catch (err) {
    console.error("POST /api/admin/sidebar error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
