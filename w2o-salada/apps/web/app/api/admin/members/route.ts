import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAdmin, ALL_PERMISSIONS } from "../../../lib/auth-guard";

export async function GET() {
  const { error } = await requireAdmin("customers");
  if (error) return error;

  try {
    const members = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        permissions: true,
        provider: true,
        createdAt: true,
      },
    });
    return NextResponse.json(members);
  } catch (err) {
    console.error("GET /api/admin/members error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// PATCH: 회원 역할/권한 변경
export async function PATCH(request: NextRequest) {
  const { error, session } = await requireAdmin("system");
  if (error) return error;

  try {
    const body = await request.json();
    const { userId, role, permissions } = body as {
      userId: string;
      role?: string;
      permissions?: string[] | null;
    };

    if (!userId) {
      return NextResponse.json({ error: "userId가 필요합니다." }, { status: 400 });
    }

    // 자기 자신의 권한은 변경 불가
    const currentUserId = (session!.user as { id: string }).id;
    if (userId === currentUserId) {
      return NextResponse.json({ error: "자신의 권한은 변경할 수 없습니다." }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};

    if (role !== undefined) {
      if (!["CUSTOMER", "ADMIN", "DRIVER"].includes(role)) {
        return NextResponse.json({ error: "유효하지 않은 역할입니다." }, { status: 400 });
      }
      updateData.role = role;
      // CUSTOMER/DRIVER로 변경 시 permissions 초기화
      if (role !== "ADMIN") {
        updateData.permissions = null;
      }
    }

    if (permissions !== undefined) {
      if (permissions === null) {
        // 슈퍼관리자로 설정
        updateData.permissions = null;
      } else if (Array.isArray(permissions)) {
        // 유효한 권한만 필터링
        const valid = permissions.filter((p) => ALL_PERMISSIONS.includes(p as typeof ALL_PERMISSIONS[number]));
        updateData.permissions = JSON.stringify(valid);
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, role: true, permissions: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/admin/members error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
