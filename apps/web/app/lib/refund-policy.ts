import { prisma } from "@repo/db";

/** 취소 수수료율(%) 기본값 — 관리자 설정 refundFeePercent 로 조정. 약관·환불 신청 화면·승인 모달이 모두 이 값을 본다 */
export const DEFAULT_REFUND_FEE_PERCENT = 30;

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
