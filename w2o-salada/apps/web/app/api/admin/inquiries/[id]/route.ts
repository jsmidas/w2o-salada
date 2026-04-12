import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../../lib/auth-guard";
import { sendAlimtalkSafe, TEMPLATE } from "../../../../lib/notification";

// GET: 문의 상세
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin("customers");
  if (error) return error;

  try {
    const { id } = await params;
    const inquiry = await prisma.inquiry.findUnique({
      where: { id },
      include: { user: { select: { name: true, email: true, phone: true } } },
    });
    if (!inquiry) return NextResponse.json({ error: "문의를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json(inquiry);
  } catch (err) {
    console.error("GET /api/admin/inquiries/[id] error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// PATCH: 답변 작성 / 상태 변경
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAdmin("customers");
  if (error) return error;

  try {
    const { id } = await params;
    const { reply, status } = await request.json();

    const data: Record<string, unknown> = {};
    if (status) data.status = status;
    if (reply !== undefined) {
      data.reply = reply;
      data.repliedBy = (session!.user as { name?: string }).name ?? "관리자";
      data.repliedAt = new Date();
      if (!status) data.status = "RESOLVED";
    }

    const inquiry = await prisma.inquiry.update({
      where: { id },
      data,
    });

    // 답변 완료 시 고객에게 알림톡
    if (reply && inquiry.phone) {
      await sendAlimtalkSafe({
        userId: inquiry.userId ?? "guest",
        to: inquiry.phone,
        templateCode: TEMPLATE.ORDER_PAID,
        variables: {
          고객명: inquiry.name,
          주문번호: "문의에 답변이 등록되었습니다",
        },
      });
    }

    return NextResponse.json(inquiry);
  } catch (err) {
    console.error("PATCH /api/admin/inquiries/[id] error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
