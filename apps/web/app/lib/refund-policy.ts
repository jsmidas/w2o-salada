import { prisma } from "@repo/db";

/**
 * 취소 수수료율(%) 기본값 — 관리자 설정 refundFeePercent 로 조정.
 * 약관 6조·환불 신청 화면·승인 모달이 모두 이 값을 본다.
 *
 * 10% 인 이유: 구독은 방문판매법상 '계속거래'라 소비자가 언제든 해지할 수 있고,
 * 사업자는 해지로 인한 실손해를 현저히 초과하는 위약금을 물릴 수 없다(공정위 산정기준상
 * 통상 잔여 대금의 10% 이내). 과하게 잡으면 약관규제법 제8조로 조항 자체가 무효가 되어
 * 오히려 한 푼도 못 받는다.
 *
 * 조리·재료 손실의 실제 방어선은 수수료가 아니라 "주문 마감이 지난 배송분은 환불 대상이
 * 아니다"(subscription-settle.ts) 쪽이다. 수수료는 그 위에 얹는 보조 장치다.
 */
export const DEFAULT_REFUND_FEE_PERCENT = 10;

export async function getRefundFeePercent(): Promise<number> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: "refundFeePercent" } });
    const n = Number(row?.value);
    return row && row.value !== "" && Number.isFinite(n) && n >= 0 && n <= 100 ? n : DEFAULT_REFUND_FEE_PERCENT;
  } catch {
    return DEFAULT_REFUND_FEE_PERCENT;
  }
}

/** 수수료 금액 (원 단위 반올림) */
export function feeFor(amount: number, percent: number): number {
  return Math.round((amount * percent) / 100);
}
