import { PrismaClient } from "@prisma/client";

/**
 * 전역 omit — 비밀번호 해시와 빌링키(암호문)는 기본 조회 결과에서 빠진다.
 * 관리자·고객 API 가 `include: { user: true }` 로 행 전체를 내려보내도 새지 않는다.
 * 정말 필요한 곳(로그인 검증, 토스 청구)만 쿼리에서 `omit: { password: false }` / `omit: { billingKey: false }` 로 되살린다.
 */
const createClient = () =>
  new PrismaClient({
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
