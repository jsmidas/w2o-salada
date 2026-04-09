import { NextResponse } from "next/server";
import { requireAuth } from "../../lib/auth-guard";

function generateOrderNo() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `W2O-${date}-${rand}`;
}

// POST: 주문 생성
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items } = body;

    if (!items?.length) {
      return NextResponse.json({ error: "주문 항목이 필요합니다." }, { status: 400 });
    }

    const orderNo = generateOrderNo();

    // DB 저장 시도
    try {
      const { prisma } = await import("@repo/db");
      // userId가 DB에 존재하는지 확인, 없으면 guest로 폴백
      let userId = body.userId ?? "guest";
      if (userId !== "guest") {
        const userExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
        if (!userExists) userId = "guest";
      }
      const order = await prisma.order.create({
        data: {
          orderNo,
          userId,
          type: "SINGLE",
          status: "PENDING",
          totalAmount: 0,
          deliveryFee: 0,
          discountAmount: 0,
        },
      });
      return NextResponse.json({ id: order.id, orderNo: order.orderNo }, { status: 201 });
    } catch {
      // DB 없으면 임시 주문 정보 반환
      return NextResponse.json({ id: orderNo, orderNo }, { status: 201 });
    }
  } catch (err) {
    console.error("POST /api/orders error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// GET: 내 주문 목록
export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const { prisma } = await import("@repo/db");
    const userId = (session!.user as { id: string }).id;

    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        items: { include: { product: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(orders);
  } catch (err) {
    console.error("GET /api/orders error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
