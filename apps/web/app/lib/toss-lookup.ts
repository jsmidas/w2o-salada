/**
 * 토스 결제 조회 — 승인이 이미 처리됐거나 웹훅으로 들어온 결제를 "우리 주문·금액과 맞는지" 확인하는 데 쓴다.
 */
const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY ?? "";

export type TossPayment = {
  paymentKey?: string;
  orderId?: string;
  status?: string;
  totalAmount?: number;
  method?: string;
  receipt?: { url?: string };
  [k: string]: unknown;
};

export async function fetchTossPayment(paymentKey: string): Promise<TossPayment | null> {
  if (!TOSS_SECRET_KEY) return null;
  const res = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}`, {
    headers: { Authorization: `Basic ${Buffer.from(TOSS_SECRET_KEY + ":").toString("base64")}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as TossPayment | null;
}

/** DONE 이고 orderId·금액이 우리 기록과 같을 때만 돌려준다 */
export async function lookupDonePayment(paymentKey: string, expectedOrderId: string, expectedAmount: number): Promise<TossPayment | null> {
  const p = await fetchTossPayment(paymentKey);
  if (!p || p.status !== "DONE") return null;
  if (p.orderId !== expectedOrderId || p.totalAmount !== expectedAmount) return null;
  return p;
}
