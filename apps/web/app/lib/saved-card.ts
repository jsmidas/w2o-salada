/**
 * 등록 카드(빌링키) 재사용 — 구독 때 등록한 카드로 단건 주문·맛보기·이번 주기만 구독을 바로 결제한다.
 *
 * 빌링키는 구독(Subscription) 행에 암호화되어 있고 토스 customerKey = userId 이므로,
 * 같은 회원의 다른 주문에도 그대로 청구할 수 있다. 취소된 구독의 카드는 쓰지 않는다.
 */
import { prisma } from "@repo/db";
import { decryptBillingKey } from "./billing-crypto";
import type { TossPaymentData } from "./payment-complete";

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY ?? "";

export type SavedCard = {
  subscriptionId: string;
  billingKey: string; // 암호화본
  cardCompany: string | null;
  cardNumber: string | null;
};

/** 화면 표시용 라벨: "현대 ****1234" / "등록된 카드" */
export function savedCardLabel(card: { cardCompany: string | null; cardNumber: string | null }): string {
  const last4 = card.cardNumber ? card.cardNumber.replace(/[^0-9*]/g, "").slice(-4) : "";
  if (card.cardCompany && last4) return `${card.cardCompany} ****${last4}`;
  if (card.cardCompany) return `${card.cardCompany} 카드`;
  if (last4) return `등록된 카드 ****${last4}`;
  return "등록된 카드";
}

/** 회원의 가장 최근 유효 빌링키 (ACTIVE 우선, 그다음 PAUSED/PENDING) */
export async function findSavedCard(userId: string): Promise<SavedCard | null> {
  const sub = await prisma.subscription.findFirst({
    where: { userId, billingKey: { not: null }, status: { in: ["ACTIVE", "PAUSED", "PENDING"] } },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }], // ACTIVE < PAUSED < PENDING (enum 순서)
    select: { id: true, billingKey: true, cardCompany: true, cardNumber: true },
  });
  if (!sub?.billingKey) return null;
  return { subscriptionId: sub.id, billingKey: sub.billingKey, cardCompany: sub.cardCompany, cardNumber: sub.cardNumber };
}

export type ChargeResult =
  | { ok: true; data: TossPaymentData }
  | { ok: false; error: string; code?: string };

/** 빌링키로 즉시 결제 (토스 /v1/billing/{billingKey}) */
export async function chargeSavedCard(params: {
  card: SavedCard;
  userId: string;
  orderNo: string;
  amount: number;
  orderName: string;
}): Promise<ChargeResult> {
  const { card, userId, orderNo, amount, orderName } = params;
  if (!TOSS_SECRET_KEY) return { ok: false, error: "토스 시크릿 키가 설정되지 않았습니다." };

  let plainKey: string;
  try {
    plainKey = decryptBillingKey(card.billingKey);
  } catch {
    return { ok: false, error: "등록된 카드 정보를 읽을 수 없습니다. 카드 결제창으로 진행해주세요." };
  }

  try {
    const res = await fetch(`https://api.tosspayments.com/v1/billing/${plainKey}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(TOSS_SECRET_KEY + ":").toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ customerKey: userId, amount, orderId: orderNo, orderName }),
    });
    const data = (await res.json()) as TossPaymentData & { message?: string; code?: string };
    if (!res.ok) {
      return { ok: false, error: data.message ?? "등록된 카드 결제에 실패했습니다.", code: data.code };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
