/** 관리자 입력 검증 — 작은 헬퍼 모음 (zod 없이) */
export function intOrNull(v: unknown, opts: { min?: number; max?: number } = {}): number | null | "invalid" {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  if (!Number.isInteger(n)) return "invalid";
  if (opts.min !== undefined && n < opts.min) return "invalid";
  if (opts.max !== undefined && n > opts.max) return "invalid";
  return n;
}

export function cleanText(v: unknown, max = 200): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}
