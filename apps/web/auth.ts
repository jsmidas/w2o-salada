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

// 세션 서명 키 — 저장소에 적힌 폴백으로 떨어지면 누구나 ADMIN 토큰을 위조할 수 있다. 운영에선 없으면 기동 실패
const AUTH_SECRET = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
if (typeof window === "undefined" && !AUTH_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("NEXTAUTH_SECRET(또는 AUTH_SECRET) 환경변수가 없습니다. 세션 서명 키 없이 운영할 수 없습니다.");
}

/**
 * 소셜 로그인 사용자를 DB 에서 찾거나 만들어 (id, role, permissions) 를 돌려준다.
 * 매칭 순서: provider+providerId → 이메일(기존 계정 연결). 예전엔 세션 id 가 카카오/네이버의 providerAccountId 라
 * 마이페이지 조회가 비고 주문이 guest 로 저장됐다.
 */
async function resolveSocialUser(p: { provider: string; providerAccountId: string; email?: string | null; name?: string | null }) {
  const prisma = await getPrisma();
  const byProvider = await prisma.user.findFirst({
    where: { provider: p.provider, providerId: p.providerAccountId },
    select: { id: true, role: true, permissions: true, email: true },
  });
  if (byProvider) return byProvider;

  if (!p.email) return null;
  const byEmail = await prisma.user.findUnique({ where: { email: p.email }, select: { id: true, role: true, permissions: true, email: true, provider: true, providerId: true } });
  if (byEmail) {
    // 같은 이메일의 기존 계정에 소셜 연결 (아직 연결된 provider 가 없을 때만)
    if (!byEmail.providerId) {
      await prisma.user.update({ where: { id: byEmail.id }, data: { provider: p.provider, providerId: p.providerAccountId } });
    }
    return byEmail;
  }
  return prisma.user.create({
    data: { email: p.email, name: p.name ?? "사용자", provider: p.provider, providerId: p.providerAccountId, role: "CUSTOMER" },
    select: { id: true, role: true, permissions: true, email: true },
  });
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
      async authorize(credentials, request) {
        if (!credentials?.username || !credentials?.password) return null;

        const usernameStr = credentials.username as string;
        const passwordStr = credentials.password as string;

        // 비밀번호 무차별 대입 차단 — 두 축으로 본다.
        //  IP : 번호를 바꿔가며 두드리는 경우 (넉넉히)
        //  계정: 한 계정을 집중적으로 노리는 경우 (엄격히)
        // 제한에 걸리면 비밀번호가 맞아도 null — 로그인 실패와 같은 응답이라
        // 공격자에게 "이 계정이 잠겼다"는 정보를 주지 않는다.
        const { clientIp, hitRateLimit, clearRateLimit } = await import("./app/lib/rate-limit");
        const ip = clientIp(request as { headers: Headers } | undefined);
        const accountKey = `login:id:${usernameStr.toLowerCase()}`;

        const gates = await Promise.all([
          hitRateLimit(accountKey, 10, 10 * 60 * 1000),
          // IP를 못 얻으면 모두가 한 키로 묶여 정상 사용자까지 막힌다 — 계정 제한만 건다
          ...(ip === "unknown" ? [] : [hitRateLimit(`login:ip:${ip}`, 30, 10 * 60 * 1000)]),
        ]);
        if (gates.some((g) => !g.allowed)) return null;

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
            omit: { password: false }, // 전역 omit 해제 — 로그인 검증에만 해시가 필요하다
          });

          if (!user || !user.password) return null;

          const valid = await bcrypt.compare(passwordStr, user.password);
          if (!valid) return null;

          // 정상 로그인이면 그 계정의 실패 기록을 지운다 (다음 로그인이 제한에 걸리지 않게)
          await clearRateLimit(accountKey);

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
    async jwt({ token, user, account, trigger, session }) {
      if (user) {
        token.role = (user as { role?: string }).role ?? "CUSTOMER";
        token.id = user.id;
        token.permissions = (user as { permissions?: string | null }).permissions ?? null;
        // 소셜 로그인: user.id 는 provider 의 계정 id — DB User.id 로 바꿔 넣는다
        if (account?.provider && account.provider !== "credentials") {
          try {
            const db = await resolveSocialUser({ provider: account.provider, providerAccountId: account.providerAccountId, email: user.email, name: user.name });
            if (db) {
              token.id = db.id;
              token.role = db.role;
              token.permissions = db.permissions ?? null;
            }
          } catch (err) {
            console.error("소셜 로그인 사용자 매핑 실패:", err);
          }
        }
      }
      // 프로필에서 update({ name, email }) 호출 시 토큰에 반영 — 재로그인 없이 헤더/세션이 갱신된다
      if (trigger === "update" && session) {
        if (typeof session.name === "string") token.name = session.name;
        if (typeof session.email === "string") token.email = session.email;
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
      // 소셜 로그인은 이메일이 있어야 계정을 만들 수 있다 (실제 생성·연결은 jwt 콜백의 resolveSocialUser)
      if (account?.provider && account.provider !== "credentials" && !user.email) return false;
      return true;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: AUTH_SECRET ?? "w2o-salada-dev-only-secret", // 개발 환경 전용 폴백 (운영은 위에서 막는다)
};

const result = NextAuth(config);
// NextAuth v5 beta 타입 추론 이슈로 any 명시
export const handlers: any = result.handlers;
export const signIn: any = result.signIn;
export const signOut: any = result.signOut;
export const auth: any = result.auth;
