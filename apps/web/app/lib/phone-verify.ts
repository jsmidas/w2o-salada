/**
 * 아이디·비밀번호 찾기 — 휴대폰 인증 공통 로직
 *
 * 흐름: 이름+휴대폰 → 6자리 코드 SMS 발송 → 코드 검증 → 재설정 토큰 발급 → 새 비밀번호 저장
 * 코드·토큰은 해시로만 저장한다. 발송 제한(전화번호당 10분 5회, 재발송 간격 60초)과
 * 검증 시도 제한(코드당 5회)으로 무차별 대입을 막는다.
 */

import crypto from "crypto";
import { prisma } from "@repo/db";
import { sendSmsDirect } from "./notification";
import { isValidMobile, normalizePhone } from "./phone-format";

export { isValidMobile, normalizePhone };

export const CODE_TTL_MS = 5 * 60 * 1000; // 코드 유효 5분
export const TOKEN_TTL_MS = 15 * 60 * 1000; // 재설정 토큰 유효 15분 (검증 시각 기준)
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const SEND_LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const SEND_LIMIT_COUNT = 5;
export const MAX_ATTEMPTS = 5;
const PURPOSE = "FIND_ACCOUNT";

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function secret(): string {
  const s = process.env.PHONE_VERIFY_SECRET ?? process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (s) return s;
  // 운영에서 비밀키 없이 인증 코드 해시를 만들면 코드가 추측 가능해진다
  if (process.env.NODE_ENV === "production") throw new Error("NEXTAUTH_SECRET 미설정 — 휴대폰 인증을 쓸 수 없습니다.");
  return "w2o-phone-verify-dev-only";
}

function hashCode(phone: string, code: string): string {
  return sha256(`${phone}:${code}:${secret()}`);
}

function hashToken(token: string): string {
  return sha256(`${token}:${secret()}`);
}

/** 이름 + 휴대폰이 일치하는 회원 조회 (전화번호는 숫자만 비교) */
export async function findUsersByNamePhone(name: string, phoneDigits: string) {
  const candidates = await prisma.user.findMany({
    where: { name: name.trim(), phone: { not: null } },
    select: {
      id: true,
      username: true,
      email: true,
      provider: true,
      password: true,
      phone: true,
      createdAt: true,
    },
  });
  return candidates.filter((u) => normalizePhone(u.phone ?? "") === phoneDigits);
}

export type SendCodeResult =
  | { ok: true; mocked: boolean; devCode?: string }
  | { ok: false; status: number; error: string };

export async function sendVerificationCode(phoneDigits: string): Promise<SendCodeResult> {
  const now = Date.now();

  // 발송 제한: 10분 5회, 재발송 간격 60초
  const recent = await prisma.phoneVerification.findMany({
    where: {
      phone: phoneDigits,
      purpose: PURPOSE,
      createdAt: { gte: new Date(now - SEND_LIMIT_WINDOW_MS) },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recent.length >= SEND_LIMIT_COUNT) {
    return {
      ok: false,
      status: 429,
      error: "인증번호 발송 횟수를 초과했습니다. 10분 후 다시 시도해주세요.",
    };
  }
  if (recent[0] && now - recent[0].createdAt.getTime() < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (now - recent[0].createdAt.getTime())) / 1000);
    return { ok: false, status: 429, error: `${wait}초 후에 다시 요청할 수 있습니다.` };
  }

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");

  await prisma.phoneVerification.create({
    data: {
      phone: phoneDigits,
      purpose: PURPOSE,
      codeHash: hashCode(phoneDigits, code),
      expiresAt: new Date(now + CODE_TTL_MS),
    },
  });

  const text = `[W2O SALADA] 인증번호는 ${code} 입니다. 5분 안에 입력해주세요. 본인이 요청하지 않았다면 무시하세요.`;
  const sent = await sendSmsDirect(phoneDigits, text);
  if (!sent.ok) {
    return {
      ok: false,
      status: 502,
      error: "인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.",
    };
  }

  const live = Boolean(process.env.SOLAPI_API_KEY && process.env.SOLAPI_API_SECRET);
  return {
    ok: true,
    mocked: !live,
    // 솔라피 미설정(Mock) + 개발 환경에서만 코드를 응답에 실어 로컬 테스트를 돕는다
    devCode: !live && process.env.NODE_ENV === "development" ? code : undefined,
  };
}

export type VerifyCodeResult =
  | { ok: true; token: string }
  | { ok: false; status: number; error: string };

export async function verifyCode(phoneDigits: string, code: string): Promise<VerifyCodeResult> {
  const record = await prisma.phoneVerification.findFirst({
    where: { phone: phoneDigits, purpose: PURPOSE, verifiedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!record || record.expiresAt.getTime() < Date.now()) {
    return { ok: false, status: 400, error: "인증번호가 만료되었습니다. 다시 요청해주세요." };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    return {
      ok: false,
      status: 429,
      error: "인증 시도 횟수를 초과했습니다. 인증번호를 다시 요청해주세요.",
    };
  }

  const expected = Buffer.from(record.codeHash, "hex");
  const actual = Buffer.from(hashCode(phoneDigits, code.trim()), "hex");
  const match = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

  if (!match) {
    await prisma.phoneVerification.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    const left = MAX_ATTEMPTS - record.attempts - 1;
    return {
      ok: false,
      status: 400,
      error:
        left > 0
          ? `인증번호가 올바르지 않습니다. (${left}회 남음)`
          : "인증 시도 횟수를 초과했습니다. 인증번호를 다시 요청해주세요.",
    };
  }

  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.phoneVerification.update({
    where: { id: record.id },
    data: { verifiedAt: new Date(), resetTokenHash: hashToken(token) },
  });
  return { ok: true, token };
}

/** 검증 완료된 유효 토큰이면 해당 레코드를 돌려준다 (없으면 null) */
export async function findValidResetToken(token: string) {
  const record = await prisma.phoneVerification.findFirst({
    where: { resetTokenHash: hashToken(token), usedAt: null, verifiedAt: { not: null } },
  });
  if (!record || !record.verifiedAt) return null;
  if (record.verifiedAt.getTime() + TOKEN_TTL_MS < Date.now()) return null;
  return record;
}

export async function markTokenUsed(id: string) {
  await prisma.phoneVerification.update({ where: { id }, data: { usedAt: new Date() } });
}

/** 클라이언트에 노출할 계정 요약 */
export function summarizeAccount(u: {
  username: string | null;
  email: string;
  provider: string | null;
  password: string | null;
  createdAt: Date;
}) {
  const provider = u.provider ?? (u.password ? "email" : "unknown");
  const providerLabel =
    provider === "kakao"
      ? "카카오"
      : provider === "naver"
        ? "네이버"
        : provider === "google"
          ? "Google"
          : "아이디·비밀번호";
  return {
    username: u.username,
    email: u.email,
    provider,
    providerLabel,
    canResetPassword: Boolean(u.password && u.username),
    joinedAt: u.createdAt.toISOString().slice(0, 10),
  };
}
