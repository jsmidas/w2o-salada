/**
 * 휴대폰 번호 정규화 (서버·클라이언트 공용, 의존성 없음)
 *
 * 받아들이는 형태: "010-1234-5678", "01012345678", "+82 10-1234-5678", "+82 010 1234 5678", "82-10-1234-5678"
 * → 숫자만 남기고 국가번호(82)를 국내 형식(0으로 시작)으로 되돌린다.
 */

/** 숫자만 남긴 국내 형식 ("01012345678"). 형식이 이상해도 예외 없이 숫자 문자열을 돌려준다 */
export function normalizePhone(input: string): string {
  let digits = (input ?? "").replace(/[^0-9]/g, "");
  // 국제 형식: 82 + (0 없이) 1012345678  또는  82 + 01012345678
  if (digits.startsWith("82") && digits.length >= 11) {
    const rest = digits.slice(2);
    digits = rest.startsWith("0") ? rest : "0" + rest;
  }
  return digits;
}

export function isValidMobile(digits: string): boolean {
  return /^01[016789][0-9]{7,8}$/.test(digits);
}

/** "01012345678" → "010-1234-5678" (형식이 안 맞으면 입력 그대로) */
export function formatPhone(input: string): string {
  const d = normalizePhone(input);
  if (!isValidMobile(d)) return input;
  return d.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3");
}
