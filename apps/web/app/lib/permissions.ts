/**
 * 관리자 권한 — 순수 헬퍼 (서버 의존성 없음).
 * 클라이언트 컴포넌트(사이드바, 권한 관리 화면)도 import 하므로 여기엔 auth/prisma 를 절대 넣지 않는다.
 * 서버 전용 가드(requireAdmin 등)는 auth-guard.ts 에 있다.
 */
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
