import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// NextAuth v5 beta 쿠키: authjs.session-token (dev) / __Secure-authjs.session-token (prod)
const SECURE_COOKIE = "__Secure-authjs.session-token";
const PLAIN_COOKIE = "authjs.session-token";
const SECRET = process.env.NEXTAUTH_SECRET ?? "w2o-salada-dev-secret-key-2026";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const secure = request.cookies.has(SECURE_COOKIE);
  const cookieName = secure ? SECURE_COOKIE : PLAIN_COOKIE;
  const hasSession = request.cookies.has(cookieName);

  // 관리자·기사 영역은 로그인 필수. 세부 role 검증은 각 layout.tsx 서버 컴포넌트에서 한다
  const protectedArea = pathname.startsWith("/admin") || pathname.startsWith("/driver");
  if (protectedArea && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!hasSession) return NextResponse.next();

  // 배송 기사 계정은 기사 화면만 쓴다 — 고객·관리자 페이지로 가면 /driver 로 되돌린다
  if (!pathname.startsWith("/driver")) {
    let role: string | undefined;
    try {
      const token = await getToken({ req: request, secret: SECRET, salt: cookieName, cookieName, secureCookie: secure });
      role = token?.role as string | undefined;
    } catch {
      role = undefined;
    }
    if (role === "DRIVER") {
      return NextResponse.redirect(new URL("/driver", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // API·정적 파일·이미지·확장자가 있는 경로는 제외
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
