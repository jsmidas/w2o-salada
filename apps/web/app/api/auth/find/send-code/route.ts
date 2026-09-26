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
    return NextResponse.json(
      {
        error:
          "입력한 이름과 휴대폰 번호로 가입된 계정이 없습니다. 가입 시 휴대폰을 등록하지 않았다면 고객센터로 문의해주세요.",
      },
      { status: 404 },
    );
  }

  const result = await sendVerificationCode(phone);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, mocked: result.mocked, devCode: result.devCode });
}
