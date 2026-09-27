import { NextResponse } from "next/server";
import { prisma } from "@repo/db";

import { DEFAULT_SIDEBAR_CONFIG as DEFAULT_CONFIG } from "../../lib/sidebar-defaults";

export async function GET() {
  try {
    const row = await prisma.setting.findUnique({
      where: { key: "sidebar.config" },
    });
    if (!row) {
      return NextResponse.json(DEFAULT_CONFIG);
    }
    try {
      const parsed = JSON.parse(row.value);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json(DEFAULT_CONFIG);
    }
  } catch (err) {
    console.error("GET /api/sidebar-config error:", err);
    return NextResponse.json(DEFAULT_CONFIG);
  }
}
