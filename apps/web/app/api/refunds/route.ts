import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAuth } from "../../lib/auth-guard";

// GET: 내 환불 신청 목록
export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const userId = (session!.user as { id: string }).id;
    const rows = await prisma.refundRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true, kind: true, reason: true, requestedAmount: true, feeAmount: true, refundAmount: true,
        status: true, createdAt: true, processedAt: true, subscriptionId: true,
      },
    });
    return NextResponse.json(rows);
  } catch (err) {
    console.error("GET /api/refunds error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
