// @ts-nocheck - NextAuth v5 beta 타입 추론 이슈 회피
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Kakao from "next-auth/providers/kakao";
import Naver from "next-auth/providers/naver";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";

async function getPrisma() {
  const { prisma } = await import("@repo/db");
  return prisma;
}

const config: NextAuthConfig = {
  providers: [
    // 이메일/비밀번호 로그인
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "아이디", type: "text" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const usernameStr = credentials.username as string;
        const passwordStr = credentials.password as string;

        // 개발 전용 데모 관리자 계정 — prod 환경에선 비활성화
        if (
          process.env.NODE_ENV === "development" &&
          usernameStr === "admin" &&
          passwordStr === "admin1234"
        ) {
          try {
            const prisma = await getPrisma();
            const admin = await prisma.user.upsert({
              where: { email: "admin@w2o.kr" },
              // permissions를 매번 null로 리셋 → 슈퍼관리자(전체 권한)로 강제 복구
              update: { role: "ADMIN", name: "관리자", permissions: null },
              create: {
                username: "admin",
                email: "admin@w2o.kr",
                name: "관리자",
                role: "ADMIN",
                permissions: null,
              },
            });
            return {
              id: admin.id,
              email: admin.email,
              name: admin.name,
              role: admin.role,
              permissions: admin.permissions,
            };
          } catch (err) {
            console.error("admin 계정 upsert 실패:", err);
            return null;
          }
        }

        try {
          // DB에서 아이디 또는 이메일로 검색
          const prisma = await getPrisma();
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { username: usernameStr },
                { email: usernameStr },
              ],
            },
          });

          if (!user || !user.password) return null;

          const valid = await bcrypt.compare(passwordStr, user.password);
          if (!valid) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            permissions: user.permissions,
          };
        } catch {
          console.error("DB 연결 실패 - DB 로그인 불가");
          return null;
        }
      },
    }),
    // 카카오
    Kakao({
      clientId: process.env.KAKAO_CLIENT_ID ?? "",
      clientSecret: process.env.KAKAO_CLIENT_SECRET ?? "",
    }),
    // 네이버
    Naver({
      clientId: process.env.NAVER_CLIENT_ID ?? "",
      clientSecret: process.env.NAVER_CLIENT_SECRET ?? "",
    }),
    // 구글
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role ?? "CUSTOMER";
        token.id = user.id;
        token.permissions = (user as { permissions?: string | null }).permissions ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { permissions?: string | null }).permissions = token.permissions as string | null;
      }
      return session;
    },
    async signIn({ user, account }) {
      // 소셜 로그인 시 DB에 유저 생성/업데이트
      if (account?.provider && account.provider !== "credentials") {
        try {
          const email = user.email;
          if (!email) return false;

          const prisma = await getPrisma();
          const existing = await prisma.user.findUnique({ where: { email } });
          if (!existing) {
            await prisma.user.create({
              data: {
                email,
                name: user.name ?? "사용자",
                provider: account.provider,
                providerId: account.providerAccountId,
                role: "CUSTOMER",
              },
            });
          }
        } catch {
          console.error("DB 연결 실패 - 소셜 로그인 유저 저장 실패");
        }
      }
      return true;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET ?? "w2o-salada-dev-secret-key-2026",
};

const result = NextAuth(config);
// NextAuth v5 beta 타입 추론 이슈로 any 명시
export const handlers: any = result.handlers;
export const signIn: any = result.signIn;
export const signOut: any = result.signOut;
export const auth: any = result.auth;
