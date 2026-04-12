import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../../lib/auth-guard";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin("subscriptions");
  if (error) return error;

  try {
    const { id } = await params;

    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        user: true,
        items: { include: { product: true } },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "구독을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json(subscription);
  } catch (err) {
    console.error("GET /api/admin/subscriptions/[id] error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin("subscriptions");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { action, plan } = body;

    const subscription = await prisma.subscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "구독을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};

    switch (action) {
      case "pause":
        if (subscription.status !== "ACTIVE") {
          return NextResponse.json(
            { error: "활성 상태의 구독만 일시정지할 수 있습니다." },
            { status: 400 }
          );
        }
        data.status = "PAUSED";
        break;

      case "resume":
        if (subscription.status !== "PAUSED") {
          return NextResponse.json(
            { error: "일시정지 상태의 구독만 재개할 수 있습니다." },
            { status: 400 }
          );
        }
        data.status = "ACTIVE";
        break;

      case "cancel":
        if (subscription.status === "CANCELLED") {
          return NextResponse.json(
            { error: "이미 취소된 구독입니다." },
            { status: 400 }
          );
        }
        data.status = "CANCELLED";
        data.cancelledAt = new Date();
        break;

      case "changePlan":
        if (!plan) {
          return NextResponse.json(
            { error: "변경할 플랜을 지정해주세요." },
            { status: 400 }
          );
        }
        data.planType = plan;
        break;

      default:
        return NextResponse.json(
          { error: "유효하지 않은 작업입니다. (pause, resume, cancel, changePlan)" },
          { status: 400 }
        );
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data,
      include: {
        user: true,
        items: { include: { product: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/admin/subscriptions/[id] error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
