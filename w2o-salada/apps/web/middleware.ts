import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // NextAuth v5 beta 쿠키: authjs.session-token (dev) / __Secure-authjs.session-token (prod)
  const hasSession =
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token");

  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ADMIN role 검증은 admin/layout.tsx 서버 컴포넌트에서 처리
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
