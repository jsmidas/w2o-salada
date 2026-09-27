/**
 * 주문 마감 기준 — 배송 전날 14:00 (KST)
 *
 * 재료는 D-2에 예측 수량으로 발주하고, 전날 오후에 조리·포장을 마쳐
 * 냉장보관한 뒤 새벽에 배송한다. 조리를 시작하기 전에 수량이 확정돼야
 * 하므로 마감이 전날 오후다.
 *
 * 서버(UTC)와 브라우저(KST) 어디서 계산해도 같은 결과가 나오도록
 * KST 벽시계 기준으로 고정해 계산한다.
 */
export const ORDER_CUTOFF_HOUR = 14;

/** 화면 안내에 쓰는 문구 — 여러 곳에서 같은 표현을 쓰도록 모아둔다 */
export const CUTOFF_LABEL = "배송 전날 오후 2시";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** UTC 시각을 KST 벽시계로 옮긴 Date (getUTC* 로 읽으면 KST 값이 된다) */
function toKst(now: Date): Date {
  return new Date(now.getTime() + KST_OFFSET_MS);
}

/**
 * 지금 주문할 수 있는 가장 이른 배송일 (YYYY-MM-DD).
 * 마감 시각을 넘겼으면 다음날 배송분은 이미 닫힌 것으로 본다.
 */
export function firstOrderableDate(now: Date = new Date()): string {
  const kst = toKst(now);
  const passedCutoff = kst.getUTCHours() >= ORDER_CUTOFF_HOUR;
  kst.setUTCDate(kst.getUTCDate() + (passedCutoff ? 2 : 1));
  return kst.toISOString().slice(0, 10);
}

/** 해당 배송일(YYYY-MM-DD)을 아직 주문·변경할 수 있는가 */
export function isOrderable(deliveryDate: string, now: Date = new Date()): boolean {
  return deliveryDate >= firstOrderableDate(now);
}

/** KST 기준 "오늘 00:00" 을 UTC Date 로 — 대시보드·통계의 오늘 경계 (서버가 UTC 라 new Date(y,m,d) 는 09시까지 어제였다) */
export function kstDayStart(now: Date = new Date()): Date {
  const kst = toKst(now);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - KST_OFFSET_MS);
}

/** Date → KST 날짜 키 (YYYY-MM-DD) — 일자별 집계 키 */
export function kstDateKey(d: Date): string {
  return toKst(d).toISOString().slice(0, 10);
}

/** 그 배송일의 마감 시각 (KST). 안내 문구나 남은 시간 계산에 쓴다 */
export function cutoffAt(deliveryDate: string): Date {
  const [y, m, d] = deliveryDate.split("-").map(Number);
  // 배송 전날 14:00 KST = 전날 05:00 UTC
  return new Date(Date.UTC(y!, m! - 1, d! - 1, ORDER_CUTOFF_HOUR - 9, 0, 0));
}
