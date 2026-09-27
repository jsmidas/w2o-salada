import { auth } from "../../auth";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

// 권한 타입·라벨·파서는 서버 의존성 없는 permissions.ts 에 있다 (클라이언트 컴포넌트는 그쪽을 import 할 것).
// 여기서 재export 하는 건 기존 서버 코드 호환용 — 이 파일은 auth.ts 를 끌고 오므로 클라이언트에서 import 하면 안 된다.
export { ALL_PERMISSIONS, PERMISSION_LABELS, hasPermission, parsePermissions, type AdminPermission } from "./permissions";
import { ALL_PERMISSIONS, PERMISSION_LABELS, hasPermission, type AdminPermission } from "./permissions";

/**
 * Admin API 인증 가드
 * permission 파라미터 없으면 ADMIN 역할만 확인
 * permission 파라미터 있으면 해당 영역 권한도 확인
 */
export async function requireAdmin(permission?: AdminPermission) {
  const session = await auth();

  if (!session?.user) {
    return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }), session: null };
  }

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN") {
    return { error: NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 }), session: null };
  }

  if (permission) {
    const permissions = (session.user as { permissions?: string | null }).permissions;
    if (!hasPermission(permissions, permission)) {
      return { error: NextResponse.json({ error: `'${PERMISSION_LABELS[permission]}' 권한이 필요합니다.` }, { status: 403 }), session: null };
    }
  }

  return { error: null, session };
}

/** 권한별 첫 화면 — 거부됐을 때 보낼 곳 */
const SECTION_HOME: Record<AdminPermission, string> = {
  dashboard: "/admin/dashboard",
  orders: "/admin/orders",
  products: "/admin/products",
  subscriptions: "/admin/subscriptions",
  customers: "/admin/members",
  system: "/admin/settings",
};

/**
 * 관리자 페이지(RSC) 권한 가드 — 섹션 layout.tsx 에서 호출한다.
 * API 는 requireAdmin(permission) 으로 막혀 있었지만 페이지 자체는 role 만 봐서, 주문 권한만 있는 직원이
 * URL 로 /admin/members 나 /admin/settings 를 열면 데이터가 그대로 렌더링됐다.
 */
export async function requirePagePermission(permission: AdminPermission): Promise<void> {
  const session = await auth();
  const user = session?.user as { role?: string; permissions?: string | null } | undefined;
  if (!user || user.role !== "ADMIN") redirect("/login");
  if (hasPermission(user.permissions, permission)) return;
  const allowed = ALL_PERMISSIONS.find((p) => hasPermission(user.permissions, p));
  redirect(allowed ? `${SECTION_HOME[allowed]}?denied=${permission}` : "/login");
}

/**
 * 로그인 필수 가드
 */
export async function requireAuth() {
  const session = await auth();

  if (!session?.user) {
    return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }), session: null };
  }

  return { error: null, session };
}

/**
 * 배송 기사 API 가드 — DRIVER 전용. ADMIN 도 통과시켜 관리자가 기사 화면을 점검할 수 있게 한다.
 */
export async function requireDriver() {
  const session = await auth();

  if (!session?.user) {
    return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }), session: null, isAdmin: false };
  }

  const role = (session.user as { role?: string }).role;
  if (role !== "DRIVER" && role !== "ADMIN") {
    return { error: NextResponse.json({ error: "배송 기사 권한이 필요합니다." }, { status: 403 }), session: null, isAdmin: false };
  }

  return { error: null, session, isAdmin: role === "ADMIN" };
}
