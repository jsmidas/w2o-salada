import { NextResponse } from "next/server";
import {
  findUsersByNamePhone,
  normalizePhone,
  summarizeAccount,
  verifyCode,
} from "../../../../lib/phone-verify";

// POST /api/auth/find/verify-code  { name, phone, code }
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const phone = normalizePhone(String(body.phone ?? ""));
  const code = String(body.code ?? "").trim();

  if (!name || !phone || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "인증번호 6자리를 입력해주세요." }, { status: 400 });
  }

  const result = await verifyCode(phone, code);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const users = await findUsersByNamePhone(name, phone);
  return NextResponse.json({
    ok: true,
    token: result.token,
    accounts: users.map(summarizeAccount),
  });
}
