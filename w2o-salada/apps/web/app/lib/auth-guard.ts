import { auth } from "../../auth";
import { NextResponse } from "next/server";

/** 관리자 권한 영역 */
export type AdminPermission =
  | "dashboard"      // 대시보드, 통계
  | "orders"         // 주문 관리, 배송 관리, 배송 캘린더
  | "products"       // 상품 관리, 카테고리, 상세페이지, 가격 설정
  | "subscriptions"  // 구독 관리, 구독 설정
  | "customers"      // 회원 관리, 문의 관리, 리뷰 관리, 알림톡
  | "system";        // 사이드바, 설정, 관리자 권한 관리

export const PERMISSION_LABELS: Record<AdminPermission, string> = {
  dashboard: "운영 (대시보드·통계)",
  orders: "주문·배송",
  products: "상품 관리",
  subscriptions: "구독 관리",
  customers: "고객 관리",
  system: "시스템 설정",
};

export const ALL_PERMISSIONS: AdminPermission[] = [
  "dashboard", "orders", "products", "subscriptions", "customers", "system",
];

/**
 * 사용자의 permissions JSON 문자열을 파싱하여 권한 배열 반환
 * null → 슈퍼관리자 (전체 권한)
 */
export function parsePermissions(permissions: string | null | undefined): AdminPermission[] | null {
  if (permissions === null || permissions === undefined) return null; // 슈퍼관리자
  try {
    const parsed = JSON.parse(permissions);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 특정 권한을 가지고 있는지 확인
 * permissions가 null이면 슈퍼관리자이므로 항상 true
 */
export function hasPermission(permissions: string | null | undefined, required: AdminPermission): boolean {
  const parsed = parsePermissions(permissions);
  if (parsed === null) return true; // 슈퍼관리자
  return parsed.includes(required);
}

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
