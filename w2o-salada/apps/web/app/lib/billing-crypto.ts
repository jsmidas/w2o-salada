import crypto from "crypto";

// 토스 빌링키 암호화 유틸 — AES-256-GCM
//
// 형식: "aes:${iv_hex}:${authTag_hex}:${ciphertext_hex}"
// 접두어 "aes:"가 없으면 레거시 평문으로 간주 (기존 DB 데이터 호환)
//
// 환경변수 BILLING_ENCRYPTION_KEY — 64자 hex (32바이트).
// 생성 방법: `openssl rand -hex 32`

const PREFIX = "aes:";
const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.BILLING_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "BILLING_ENCRYPTION_KEY 미설정 — `openssl rand -hex 32`로 생성 후 환경변수 등록 필요",
    );
  }
  if (raw.length !== 64) {
    throw new Error("BILLING_ENCRYPTION_KEY는 64자 hex(32바이트)여야 합니다.");
  }
  return Buffer.from(raw, "hex");
}

/**
 * 평문 빌링키를 AES-256-GCM으로 암호화해서 DB 저장용 문자열 반환.
 */
export function encryptBillingKey(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * DB에서 읽은 값을 복호화.
 * 레거시 평문(prefix 없음)은 경고 로그 후 원본 반환 (점진적 마이그레이션 허용).
 */
export function decryptBillingKey(stored: string | null | undefined): string {
  if (!stored) throw new Error("빌링키가 없습니다.");

  if (!stored.startsWith(PREFIX)) {
    // 레거시 평문 — 다음 결제 성공 시 암호화로 교체 권장
    console.warn("[billing-crypto] 레거시 평문 빌링키 감지. 암호화 마이그레이션 권장.");
    return stored;
  }

  const key = getKey();
  const parts = stored.slice(PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("빌링키 포맷 오류");
  }
  const [ivHex, tagHex, ctHex] = parts;
  const iv = Buffer.from(ivHex!, "hex");
  const authTag = Buffer.from(tagHex!, "hex");
  const ciphertext = Buffer.from(ctHex!, "hex");

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * 저장된 값이 암호화되어 있는지 확인. (레거시 감지용)
 */
export function isEncryptedBillingKey(stored: string | null | undefined): boolean {
  return typeof stored === "string" && stored.startsWith(PREFIX);
}
