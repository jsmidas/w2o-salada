import { NextResponse } from "next/server";
import {
  findUsersByNamePhone,
  isValidMobile,
  normalizePhone,
  sendVerificationCode,
} from "../../../../lib/phone-verify";

// POST /api/auth/find/send-code  { name, phone }
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const phone = normalizePhone(String(body.phone ?? ""));

  if (!name || !phone) {
    return NextResponse.json({ error: "이름과 휴대폰 번호를 입력해주세요." }, { status: 400 });
  }
  if (!isValidMobile(phone)) {
    return NextResponse.json({ error: "휴대폰 번호 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const users = await findUsersByNamePhone(name, phone);
  if (users.length === 0) {
    // 계정 유무를 응답으로 알려주면 이름×번호 조합으로 가입 여부를 훑을 수 있다 — 발송 없이 같은 응답
    return NextResponse.json({ ok: true, message: "가입된 계정이면 인증번호가 발송됩니다. 5분 안에 입력해주세요." });
  }

  const result = await sendVerificationCode(phone);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, mocked: result.mocked, devCode: result.devCode });
}
