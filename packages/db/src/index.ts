import { PrismaClient } from "@prisma/client";

/**
 * 전역 omit — 비밀번호 해시와 빌링키(암호문)는 기본 조회 결과에서 빠진다.
 * 관리자·고객 API 가 `include: { user: true }` 로 행 전체를 내려보내도 새지 않는다.
 * 정말 필요한 곳(로그인 검증, 토스 청구)만 쿼리에서 `omit: { password: false }` / `omit: { billingKey: false }` 로 되살린다.
 */
/**
 * 서버리스(Vercel)용 연결 문자열 — 인스턴스마다 연결을 1개만 연다.
 * Prisma 기본값(CPU×2+1)으로 두면 트래픽이 몰려 인스턴스가 40개 남짓 뜨는 순간
 * Supabase 풀러의 클라이언트 상한(Free 200개)을 넘긴다. 실제 재사용은 PgBouncer(6543)가 맡는다.
 * 로컬 dev 서버는 프로세스 하나가 오래 살며 동시 쿼리를 내므로 기본 풀을 그대로 쓴다.
 */
const resolveDatabaseUrl = () => {
  const raw = process.env.DATABASE_URL;
  if (!raw || !process.env.VERCEL) return raw;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "1");
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "20");
    return url.toString();
  } catch {
    return raw;
  }
};

const createClient = () =>
  new PrismaClient({
    datasourceUrl: resolveDatabaseUrl(),
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
    omit: {
      user: { password: true },
      subscription: { billingKey: true },
      payment: { billingKey: true },
    },
  });

type Client = ReturnType<typeof createClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: Client | undefined;
};

export const prisma: Client = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
