import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@repo/db";
import {
  findUsersByNamePhone,
  findValidResetToken,
  markTokenUsed,
  normalizePhone,
} from "../../../../lib/phone-verify";

// POST /api/auth/find/reset-password  { token, name, phone, username, newPassword }
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = String(body.token ?? "");
  const name = String(body.name ?? "").trim();
  const phone = normalizePhone(String(body.phone ?? ""));
  const username = String(body.username ?? "").trim();
  const newPassword = String(body.newPassword ?? "");

  if (!token || !name || !phone || !username) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다." }, { status: 400 });
  }

  const record = await findValidResetToken(token);
  if (!record || record.phone !== phone) {
    return NextResponse.json(
      { error: "인증이 만료되었습니다. 처음부터 다시 진행해주세요." },
      { status: 401 },
    );
  }

  // 토큰이 인증한 휴대폰에 속한 계정만 재설정 가능
  const users = await findUsersByNamePhone(name, phone);
  const target = users.find((u) => u.username === username);
  if (!target) {
    return NextResponse.json({ error: "해당 아이디를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!target.password) {
    return NextResponse.json(
      {
        error:
          "간편 로그인(카카오·네이버·Google)으로 가입된 계정은 비밀번호가 없습니다. 해당 서비스로 로그인해주세요.",
      },
      { status: 400 },
    );
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: target.id }, data: { password: hashed } });
  await markTokenUsed(record.id);

  return NextResponse.json({ ok: true });
}
