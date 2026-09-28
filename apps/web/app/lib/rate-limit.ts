/**
 * 접근 제한 (rate limit)
 *
 * 로그인·인증번호처럼 반복 호출로 남용될 수 있는 동작을 "최근 N분에 M회"로 막는다.
 * 서버리스는 요청마다 인스턴스가 달라 메모리에 셀 수 없으므로 DB(AccessAttempt)에 기록한다.
 *
 * 나중에 워커 때문에 Redis를 도입하면 이 파일의 구현만 바꾸면 된다 —
 * 호출부는 hitRateLimit / clearRateLimit 두 함수만 쓴다.
 */
import { prisma } from "@repo/db";

export type RateLimitResult = {
  allowed: boolean;
  /** 남은 허용 횟수 */
  remaining: number;
  /** 막혔을 때 몇 초 뒤에 다시 시도할 수 있는지 */
  retryAfterSec: number;
};

/** 요청에서 클라이언트 IP를 뽑는다. Vercel은 x-forwarded-for 에 실어 보낸다 */
export function clientIp(req: { headers: Headers } | Headers | null | undefined): string {
  const headers = req instanceof Headers ? req : req?.headers;
  if (!headers) return "unknown";
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * 시도를 한 번 기록하고 창 안의 횟수가 한도를 넘었는지 본다.
 * 한도를 넘으면 기록하지 않고 막는다 (계속 두드려도 창이 밀리지 않게).
 */
export async function hitRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const since = new Date(Date.now() - windowMs);

  try {
    const hits = await prisma.accessAttempt.findMany({
      where: { key, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });

    if (hits.length >= limit) {
      // 가장 오래된 기록이 창을 벗어나야 다시 시도할 수 있다
      const oldest = hits[0]!.createdAt.getTime();
      const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - Date.now()) / 1000));
      return { allowed: false, remaining: 0, retryAfterSec };
    }

    await prisma.accessAttempt.create({ data: { key } });
    return { allowed: true, remaining: limit - hits.length - 1, retryAfterSec: 0 };
  } catch (err) {
    // 제한 장치가 죽었다고 로그인·인증을 막지는 않는다 (가용성 우선)
    console.error("rate limit 확인 실패:", err);
    return { allowed: true, remaining: limit, retryAfterSec: 0 };
  }
}

/** 성공했을 때 해당 키의 기록을 지운다 (로그인 성공 시 실패 카운트 초기화) */
export async function clearRateLimit(key: string): Promise<void> {
  try {
    await prisma.accessAttempt.deleteMany({ where: { key } });
  } catch (err) {
    console.error("rate limit 초기화 실패:", err);
  }
}

/** 창을 한참 지난 기록 정리 — 기본 하루. 크론이나 드물게 호출한다 */
export async function purgeRateLimits(olderThanMs = 24 * 60 * 60 * 1000): Promise<number> {
  try {
    const res = await prisma.accessAttempt.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - olderThanMs) } },
    });
    return res.count;
  } catch (err) {
    console.error("rate limit 정리 실패:", err);
    return 0;
  }
}
