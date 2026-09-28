/**
 * 솔라피(Solapi) 알림톡 발송 공통 모듈
 *
 * 환경변수:
 *   SOLAPI_API_KEY      — 솔라피 API 키
 *   SOLAPI_API_SECRET   — 솔라피 API 시크릿
 *   SOLAPI_PFID         — 카카오 비즈니스 채널 발신프로필 ID
 *   SOLAPI_SENDER_PHONE — 발신자 전화번호 (SMS 폴백용)
 *
 * 위 4개 중 하나라도 없으면 Mock 모드로 동작 (콘솔 출력 + DB 기록만, 실발송 X)
 */

import crypto from "crypto";
import { prisma } from "@repo/db";

// ── 템플릿 코드 ───────────────────────────────────────────
export const TEMPLATE = {
  ORDER_PAID: "ORDER_PAID",
  // 배송 출발 알림은 두지 않는다 — 새벽 3시에 울리는 알림은 고객에게 득이 없다.
  // 도착 알림 하나만 아침 07:30 에 보낸다 (api/cron/delivery-arrived).
  DELIVERY_DONE: "DELIVERY_DONE",
  SUB_PAID: "SUB_PAID",
  PAYMENT_FAIL: "PAYMENT_FAIL",
  SUB_RENEWAL_NOTICE: "SUB_RENEWAL_NOTICE",
  SUB_RENEWED: "SUB_RENEWED",
  SUB_RENEWAL_FAILED: "SUB_RENEWAL_FAILED",
  SUB_SELECT_MENU: "SUB_SELECT_MENU",
} as const;

export type TemplateCode = (typeof TEMPLATE)[keyof typeof TEMPLATE];

// 템플릿별 미리보기 문구 (솔라피 템플릿 승인 후 templateId로 대체됨)
export const TEMPLATE_PREVIEW: Record<TemplateCode, string> = {
  ORDER_PAID:
    "[W2O SALADA]\n#{고객명}님, 주문이 완료되었습니다.\n주문번호: #{주문번호}\n#{배송일} 새벽 도착 예정입니다.",
  // 알림톡이 막혀 대체발송(SMS/LMS)으로 나갈 때를 대비해 버튼 주소를 본문에도 적어 둔다
  DELIVERY_DONE:
    "[W2O SALADA]\n#{고객명}님, 간밤에 문 앞으로 배송해 드렸습니다.\n\n배송 사진을 확인해보세요.\n맛있게 드세요!\nwww.w2o.co.kr/delivery/#{링크}",
  SUB_PAID:
    "[W2O SALADA]\n정기구독 결제가 완료되었습니다.\n금액: #{금액}원",
  PAYMENT_FAIL:
    "[W2O SALADA]\n결제에 실패했습니다.\n카드 정보를 확인해주세요.",
  SUB_RENEWAL_NOTICE:
    "[W2O SALADA]\n#{고객명}님, 1주일 후 구독이 자동 갱신됩니다.\n금액: #{금액}원\n변경/해지: w2o.co.kr/mypage/subscription",
  SUB_RENEWED:
    "[W2O SALADA]\n#{고객명}님, 구독이 자동 갱신되었습니다.\n금액: #{금액}원\n다음 배송을 준비합니다.",
  SUB_RENEWAL_FAILED:
    "[W2O SALADA]\n#{고객명}님, 구독 갱신 결제에 실패했습니다.\n카드 정보를 확인해주세요.\n확인: w2o.co.kr/mypage/subscription",
  SUB_SELECT_MENU:
    "[W2O SALADA]\n#{고객명}님, #{월}월 메뉴를 선택해주세요.\n선택: w2o.co.kr/subscribe",
};

// 솔라피 템플릿 ID 매핑 (승인 후 환경변수나 DB에서 읽어오도록 교체 가능)
const TEMPLATE_ID_MAP: Record<TemplateCode, string | undefined> = {
  ORDER_PAID: process.env.SOLAPI_TEMPLATE_ORDER_PAID,
  DELIVERY_DONE: process.env.SOLAPI_TEMPLATE_DELIVERY_DONE,
  SUB_PAID: process.env.SOLAPI_TEMPLATE_SUB_PAID,
  PAYMENT_FAIL: process.env.SOLAPI_TEMPLATE_PAYMENT_FAIL,
  // 갱신 관련 4종 — 빠져 있어서 알림톡 대신 SMS/LMS 로 나가고 있었다 (솔라피 템플릿 승인 후 env 에 ID 등록)
  SUB_RENEWAL_NOTICE: process.env.SOLAPI_TEMPLATE_SUB_RENEWAL_NOTICE,
  SUB_RENEWED: process.env.SOLAPI_TEMPLATE_SUB_RENEWED,
  SUB_RENEWAL_FAILED: process.env.SOLAPI_TEMPLATE_SUB_RENEWAL_FAILED,
  SUB_SELECT_MENU: process.env.SOLAPI_TEMPLATE_SUB_SELECT_MENU,
};

// ── 변수 치환 ─────────────────────────────────────────────
function renderTemplate(
  templateCode: TemplateCode,
  variables: Record<string, string | number>,
): string {
  let text = TEMPLATE_PREVIEW[templateCode];
  for (const [key, value] of Object.entries(variables)) {
    text = text.replaceAll(`#{${key}}`, String(value));
  }
  return text;
}

// 전화번호 정규화: "010-1234-5678" → "01012345678"
function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

// ── 환경변수 체크 ─────────────────────────────────────────
function isLiveMode(): boolean {
  return Boolean(
    process.env.SOLAPI_API_KEY &&
      process.env.SOLAPI_API_SECRET,
  );
}

// ── 솔라피 API 호출 ───────────────────────────────────────
// 솔라피 인증: HMAC-SHA256 signature (date + salt)
// 문서: https://developers.solapi.com/references/authentication
function buildSolapiAuthHeader(): string {
  const apiKey = process.env.SOLAPI_API_KEY!;
  const apiSecret = process.env.SOLAPI_API_SECRET!;
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString("hex");
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(date + salt)
    .digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

async function callSolapi(
  to: string,
  templateCode: TemplateCode,
  renderedText: string,
  variables: Record<string, string | number>,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const templateId = TEMPLATE_ID_MAP[templateCode];

  // 솔라피 변수 형식: {"#{고객명}": "홍길동"} 형태로 변환
  const solapiVariables: Record<string, string> = {};
  for (const [key, value] of Object.entries(variables)) {
    solapiVariables[`#{${key}}`] = String(value);
  }

  const body = {
    message: {
      to,
      from: process.env.SOLAPI_SENDER_PHONE ?? "",
      type: templateId ? "ATA" : (Buffer.byteLength(renderedText, "utf8") > 90 ? "LMS" : "SMS"),
      ...(templateId
        ? {
            kakaoOptions: {
              pfId: process.env.SOLAPI_PFID!,
              templateId,
              variables: solapiVariables,
              disableSms: false, // 알림톡 실패 시 SMS 자동 전환
            },
          }
        : {
            text: renderedText, // 템플릿 ID 없으면 SMS/LMS로 발송
          }),
    },
  };

  try {
    const res = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: {
        Authorization: buildSolapiAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      return { ok: false, error: data.errorMessage ?? JSON.stringify(data) };
    }
    // 솔라피는 접수 실패도 HTTP 200 으로 답한다. statusCode 가 2xxx 가 아니면 나가지 않은 것이다.
    const failed = Array.isArray(data.failedMessageList) ? data.failedMessageList : [];
    if (failed.length > 0) {
      const f = failed[0];
      return { ok: false, error: `${f?.statusCode ?? ""} ${f?.statusMessage ?? JSON.stringify(f)}`.trim() };
    }
    const statusCode = String(data.statusCode ?? "");
    if (statusCode && !statusCode.startsWith("2")) {
      return { ok: false, error: `${statusCode} ${data.statusMessage ?? ""}`.trim() };
    }
    return { ok: true, messageId: data.messageId };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ── 메인 발송 함수 ────────────────────────────────────────
export interface SendAlimtalkParams {
  userId: string;
  to: string; // 수신자 전화번호
  templateCode: TemplateCode;
  variables: Record<string, string | number>;
}

export interface SendAlimtalkResult {
  ok: boolean;
  mocked: boolean;
  notificationId: string;
  error?: string;
}

export async function sendAlimtalk(
  params: SendAlimtalkParams,
): Promise<SendAlimtalkResult> {
  const { userId, to, templateCode, variables } = params;
  const normalizedTo = normalizePhone(to);
  const renderedText = renderTemplate(templateCode, variables);
  const mocked = !isLiveMode();

  // 1. DB에 PENDING으로 기록 (userId가 유효하지 않으면 스킵)
  let notificationId: string | null = null;
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: "ALIMTALK",
        templateCode,
        content: renderedText,
        status: "PENDING",
      },
    });
    notificationId = notification.id;
  } catch {
    // userId FK 실패 등 — DB 기록 없이 발송 계속 진행
  }

  // 2. Mock 모드: 콘솔 출력 후 바로 SENT 처리
  if (mocked) {
    console.log("[알림톡 Mock 발송]", {
      to: normalizedTo,
      templateCode,
      content: renderedText,
    });
    if (notificationId) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { status: "SENT", sentAt: new Date() },
      }).catch(() => {});
    }
    return { ok: true, mocked: true, notificationId: notificationId ?? "none" };
  }

  // 3. 실발송
  const result = await callSolapi(normalizedTo, templateCode, renderedText, variables);

  if (notificationId) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: result.ok ? "SENT" : "FAILED",
        sentAt: result.ok ? new Date() : null,
      },
    }).catch(() => {});
  }

  return {
    ok: result.ok,
    mocked: false,
    notificationId: notificationId ?? "none",
    error: result.error,
  };
}

// ── 단순 SMS 발송 (템플릿 없이 직접 텍스트, 문의 알림 등) ──
export async function sendSmsDirect(
  to: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isLiveMode()) {
    console.log("[SMS Mock 발송]", { to: normalizePhone(to), text });
    return { ok: true };
  }

  const normalizedTo = normalizePhone(to);
  const type = Buffer.byteLength(text, "utf8") > 90 ? "LMS" : "SMS";

  try {
    const res = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: {
        Authorization: buildSolapiAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          to: normalizedTo,
          from: process.env.SOLAPI_SENDER_PHONE ?? "",
          type,
          text,
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.errorMessage ?? JSON.stringify(data) };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ── 안전 래퍼 (알림톡 실패가 주 로직을 망치지 않도록) ─────
export async function sendAlimtalkSafe(
  params: SendAlimtalkParams,
): Promise<void> {
  try {
    const result = await sendAlimtalk(params);
    if (!result.ok) {
      console.warn("알림톡 발송 실패:", result.error, params.templateCode);
    }
  } catch (err) {
    console.error("알림톡 발송 오류:", err);
  }
}
