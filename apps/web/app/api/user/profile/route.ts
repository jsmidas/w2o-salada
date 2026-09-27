import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@repo/db";
import { requireAuth } from "../../../lib/auth-guard";

// GET: 내 프로필
export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const userId = (session!.user as { id: string }).id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        phone: true,
        provider: true,
        createdAt: true,
      },
    });
    // User row가 없더라도 호출자(checkout 프리필 등) 는 null이면 무시하므로 200 으로 응답.
    // 404 로 반환하면 세션 토큰의 id가 stale인 경우 프론트 콘솔에 에러가 쌓임.
    return NextResponse.json(user ?? null);
  } catch (err) {
    console.error("GET /api/user/profile error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// PATCH: 프로필 수정 (이름/전화/비밀번호)
export async function PATCH(request: Request) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const userId = (session!.user as { id: string }).id;
    const body = await request.json();
    const { name, phone, email, currentPassword, newPassword } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;

    // 이메일 변경 — 계정 키는 id 이고 이메일은 unique 필드일 뿐이라 바꿀 수 있다.
    // 단, 소셜 계정은 소셜 로그인 시 이메일로 기존 계정을 찾으므로 변경을 막는다.
    if (email !== undefined) {
      const nextEmail = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
        return NextResponse.json({ error: "이메일 형식이 올바르지 않습니다." }, { status: 400 });
      }
      const me = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, provider: true } });
      if (!me) {
        return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
      }
      if (me.provider && me.provider !== "email") {
        return NextResponse.json({ error: "소셜 로그인 계정은 이메일을 변경할 수 없습니다." }, { status: 400 });
      }
      if (nextEmail !== me.email) {
        const taken = await prisma.user.findUnique({ where: { email: nextEmail }, select: { id: true } });
        if (taken) {
          return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });
        }
        data.email = nextEmail;
      }
    }

    // 비밀번호 변경
    if (newPassword) {
      const user = await prisma.user.findUnique({ where: { id: userId }, omit: { password: false } });
      if (!user) {
        return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
      }
      // 이메일 가입 유저만 비밀번호 변경 가능
      if (!user.password) {
        return NextResponse.json(
          { error: "소셜 로그인 계정은 비밀번호를 변경할 수 없습니다." },
          { status: 400 },
        );
      }
      const valid = await bcrypt.compare(currentPassword ?? "", user.password);
      if (!valid) {
        return NextResponse.json({ error: "현재 비밀번호가 일치하지 않습니다." }, { status: 400 });
      }
      data.password = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "변경할 값이 없습니다." }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        phone: true,
        provider: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/user/profile error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
