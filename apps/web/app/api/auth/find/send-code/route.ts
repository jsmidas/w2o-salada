import { NextResponse } from "next/server";
import {
  findUsersByNamePhone,
  isValidMobile,
  normalizePhone,
  sendVerificationCode,
} from "../../../../lib/phone-verify";
import { clientIp, hitRateLimit } from "../../../../lib/rate-limit";

// 번호당 제한은 sendVerificationCode 안에 있다(10분 5회·60초 간격).
// 여기서는 번호를 바꿔가며 두드리는 경우를 막는다 — 한 IP가 1시간에 20회.
const IP_LIMIT = 20;
const IP_WINDOW_MS = 60 * 60 * 1000;

// POST /api/auth/find/send-code  { name, phone }
export async function POST(request: Request) {
  const ip = clientIp(request);
  // IP를 못 얻으면 모두가 한 키로 묶이므로 IP 제한은 건너뛴다 (번호당 제한은 그대로 적용된다)
  const gate = ip === "unknown"
    ? { allowed: true, retryAfterSec: 0 }
    : await hitRateLimit(`sendcode:ip:${ip}`, IP_LIMIT, IP_WINDOW_MS);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: `인증번호 요청이 너무 잦습니다. ${Math.ceil(gate.retryAfterSec / 60)}분 후 다시 시도해주세요.` },
      { status: 429, headers: { "Retry-After": String(gate.retryAfterSec) } },
    );
  }

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
