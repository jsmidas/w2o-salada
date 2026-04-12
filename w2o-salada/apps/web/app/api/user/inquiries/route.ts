import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAuth } from "../../../lib/auth-guard";

// GET: 본인의 문의 목록
export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  const userId = (session!.user as { id: string }).id;

  try {
    const inquiries = await prisma.inquiry.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        category: true,
        content: true,
        images: true,
        status: true,
        reply: true,
        repliedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json(inquiries);
  } catch (err) {
    console.error("GET /api/user/inquiries error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
