import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@repo/db";
import { requireAdmin, ALL_PERMISSIONS } from "../../../lib/auth-guard";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9_.-]{3,30}$/i;
const ROLES = ["CUSTOMER", "ADMIN", "DRIVER"] as const;

function normalizePermissions(permissions: unknown): string | null | undefined {
  if (permissions === undefined) return undefined;
  if (permissions === null) return null; // 슈퍼관리자
  if (!Array.isArray(permissions)) return undefined;
  const valid = permissions.filter((p) => ALL_PERMISSIONS.includes(p as (typeof ALL_PERMISSIONS)[number]));
  return JSON.stringify(valid);
}

export async function GET() {
  const { error } = await requireAdmin("customers");
  if (error) return error;

  try {
    const members = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
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

// POST: 관리자(또는 기사) 계정을 직접 생성 — 회원가입 없이 아이디/비밀번호로 만든다
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin("system");
  if (error) return error;

  try {
    const body = await request.json();
    const { username, email, name, phone, password, role, permissions } = body as {
      username?: string; email?: string; name?: string; phone?: string | null;
      password?: string; role?: string; permissions?: string[] | null;
    };

    const uname = String(username ?? "").trim();
    const mail = String(email ?? "").trim().toLowerCase();
    const displayName = String(name ?? "").trim();
    const pw = String(password ?? "");
    const finalRole = (role ?? "ADMIN") as (typeof ROLES)[number];

    if (!USERNAME_RE.test(uname)) {
      return NextResponse.json({ error: "아이디는 영문·숫자·._- 3~30자여야 합니다." }, { status: 400 });
    }
    if (!EMAIL_RE.test(mail)) {
      return NextResponse.json({ error: "이메일 형식이 올바르지 않습니다." }, { status: 400 });
    }
    if (!displayName) {
      return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
    }
    if (pw.length < 6) {
      return NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다." }, { status: 400 });
    }
    if (!ROLES.includes(finalRole)) {
      return NextResponse.json({ error: "유효하지 않은 역할입니다." }, { status: 400 });
    }

    const dup = await prisma.user.findFirst({
      where: { OR: [{ username: uname }, { email: mail }] },
      select: { username: true, email: true },
    });
    if (dup) {
      const which = dup.username === uname ? "아이디" : "이메일";
      return NextResponse.json({ error: `이미 사용 중인 ${which}입니다.` }, { status: 409 });
    }

    const created = await prisma.user.create({
      data: {
        username: uname,
        email: mail,
        name: displayName,
        phone: phone ? String(phone).trim() : null,
        password: await bcrypt.hash(pw, 12),
        role: finalRole,
        provider: "email",
        permissions: finalRole === "ADMIN" ? (normalizePermissions(permissions) ?? null) : null,
      },
      select: { id: true, username: true, email: true, name: true, role: true, permissions: true },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/members error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// PATCH: 회원 역할/권한 변경 + 계정 정보(아이디·이메일·이름·전화·비밀번호) 수정
export async function PATCH(request: NextRequest) {
  const { error, session } = await requireAdmin("system");
  if (error) return error;

  try {
    const body = await request.json();
    const { userId, role, permissions, username, email, name, phone, newPassword } = body as {
      userId: string;
      role?: string;
      permissions?: string[] | null;
      username?: string | null;
      email?: string;
      name?: string;
      phone?: string | null;
      newPassword?: string;
    };

    if (!userId) {
      return NextResponse.json({ error: "userId가 필요합니다." }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, email: true, provider: true },
    });
    if (!target) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    // 자기 자신의 역할·권한은 변경 불가 (잠금 방지). 계정 정보는 마이페이지 프로필에서 바꾼다.
    const currentUserId = (session!.user as { id: string }).id;
    if (userId === currentUserId && (role !== undefined || permissions !== undefined)) {
      return NextResponse.json({ error: "자신의 권한은 변경할 수 없습니다." }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};

    if (role !== undefined) {
      if (!ROLES.includes(role as (typeof ROLES)[number])) {
        return NextResponse.json({ error: "유효하지 않은 역할입니다." }, { status: 400 });
      }
      updateData.role = role;
      if (role !== "ADMIN") updateData.permissions = null; // CUSTOMER/DRIVER는 권한 초기화
    }

    const perms = normalizePermissions(permissions);
    if (perms !== undefined) updateData.permissions = perms;

    if (name !== undefined) {
      const n = String(name).trim();
      if (!n) return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
      updateData.name = n;
    }
    if (phone !== undefined) updateData.phone = phone ? String(phone).trim() : null;

    if (username !== undefined) {
      const u = username === null ? null : String(username).trim();
      if (u !== null && u !== "" && !USERNAME_RE.test(u)) {
        return NextResponse.json({ error: "아이디는 영문·숫자·._- 3~30자여야 합니다." }, { status: 400 });
      }
      const next = u === "" ? null : u;
      if (next !== target.username) {
        if (next) {
          const taken = await prisma.user.findUnique({ where: { username: next }, select: { id: true } });
          if (taken && taken.id !== userId) {
            return NextResponse.json({ error: "이미 사용 중인 아이디입니다." }, { status: 409 });
          }
        }
        updateData.username = next;
      }
    }

    if (email !== undefined) {
      const m = String(email).trim().toLowerCase();
      if (!EMAIL_RE.test(m)) {
        return NextResponse.json({ error: "이메일 형식이 올바르지 않습니다." }, { status: 400 });
      }
      if (m !== target.email) {
        if (target.provider && target.provider !== "email") {
          return NextResponse.json({ error: "소셜 로그인 계정은 이메일을 변경할 수 없습니다." }, { status: 400 });
        }
        const taken = await prisma.user.findUnique({ where: { email: m }, select: { id: true } });
        if (taken && taken.id !== userId) {
          return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });
        }
        updateData.email = m;
      }
    }

    if (newPassword !== undefined && newPassword !== "") {
      if (String(newPassword).length < 6) {
        return NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다." }, { status: 400 });
      }
      updateData.password = await bcrypt.hash(String(newPassword), 12);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "변경할 값이 없습니다." }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, username: true, email: true, name: true, phone: true, role: true, permissions: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/admin/members error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
