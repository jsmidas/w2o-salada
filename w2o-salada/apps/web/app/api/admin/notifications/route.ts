import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin } from "../../../lib/auth-guard";
import {
  sendAlimtalk,
  TEMPLATE,
  TEMPLATE_PREVIEW,
  type TemplateCode,
} from "../../../lib/notification";

// GET: 발송 이력 + 모드 정보
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin("customers");
  if (error) return error;

  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status"); // PENDING | SENT | FAILED
    const templateCode = searchParams.get("templateCode");
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "30", 10);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { type: "ALIMTALK" };
    if (status) where.status = status;
    if (templateCode) where.templateCode = templateCode;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    const liveMode = Boolean(
      process.env.SOLAPI_API_KEY &&
        process.env.SOLAPI_API_SECRET &&
        process.env.SOLAPI_PFID,
    );

    return NextResponse.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      mode: liveMode ? "live" : "mock",
      templates: Object.entries(TEMPLATE_PREVIEW).map(([code, preview]) => ({
        code,
        preview,
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/notifications error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// POST: 수동 발송 (관리자 테스트)
export async function POST(request: Request) {
  const { error, session } = await requireAdmin("customers");
  if (error) return error;

  try {
    const body = await request.json();
    const { templateCode, to, variables, userId } = body as {
      templateCode: TemplateCode;
      to: string;
      variables: Record<string, string>;
      userId?: string;
    };

    if (!templateCode || !to) {
      return NextResponse.json(
        { error: "templateCode와 수신번호(to)가 필요합니다." },
        { status: 400 },
      );
    }

    if (!Object.values(TEMPLATE).includes(templateCode)) {
      return NextResponse.json({ error: "유효하지 않은 템플릿 코드입니다." }, { status: 400 });
    }

    // userId가 없으면 관리자 본인 ID로 기록 (테스트 발송 용도)
    const targetUserId = userId ?? (session!.user as { id: string }).id;

    const result = await sendAlimtalk({
      userId: targetUserId,
      to,
      templateCode,
      variables: variables ?? {},
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/admin/notifications error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
