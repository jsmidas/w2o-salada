import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../lib/auth-guard";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin("orders");
  if (error) return error;

  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const search = searchParams.get("search");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (status === "hold") {
      // 배송지 확인 큐 — 반경 밖·좌표 불명 주소로 들어온 미처리 주문
      where.deliveryHold = true;
      where.deliveryHoldResolvedAt = null;
      where.status = { notIn: ["CANCELLED", "REFUNDED", "FAILED"] };
    } else if (status) {
      where.status = status;
    }
    if (type) {
      where.type = type;
    }
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { id: { contains: search } },
      ];
    }
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: {
          id: true,
          orderNo: true,
          type: true,
          status: true,
          totalAmount: true,
          deliveryFee: true,
          deliveryDate: true,
          deliveryHold: true,
          deliveryHoldReason: true,
          deliveryHoldResolvedAt: true,
          deliveryHoldNote: true,
          createdAt: true,
          user: { select: { name: true, email: true, phone: true } },
          address: {
            select: {
              label: true, name: true, phone: true, address1: true, address2: true,
              sigungu: true, bname: true, buildingName: true, distanceKm: true, areaStatus: true,
            },
          },
          items: {
            select: {
              id: true,
              quantity: true,
              product: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("GET /api/admin/orders error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
