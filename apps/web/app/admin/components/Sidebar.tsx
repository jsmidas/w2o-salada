"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { type AdminPermission, parsePermissions } from "../../lib/auth-guard";

type MenuItem = { href: string; icon: string; label: string };
type MenuGroup = { title: string; permission: AdminPermission; items: MenuItem[] };

const menuGroups: MenuGroup[] = [
  {
    title: "운영",
    permission: "dashboard",
    items: [
      { href: "/admin/dashboard", icon: "dashboard", label: "대시보드" },
      { href: "/admin/stats", icon: "bar_chart", label: "통계" },
    ],
  },
  {
    title: "주문 · 배송",
    permission: "orders",
    items: [
      { href: "/admin/orders", icon: "receipt_long", label: "주문 관리" },
      { href: "/admin/production", icon: "factory", label: "생산 집계" },
      { href: "/admin/delivery", icon: "local_shipping", label: "배송 관리" },
      { href: "/admin/delivery-calendar", icon: "calendar_month", label: "배송 캘린더" },
      { href: "/admin/routes", icon: "alt_route", label: "배송 코스·기사" },
      { href: "/admin/apartments", icon: "apartment", label: "아파트 단지" },
    ],
  },
  {
    title: "상품",
    permission: "products",
    items: [
      { href: "/admin/products", icon: "inventory_2", label: "상품 관리" },
      { href: "/admin/categories", icon: "category", label: "카테고리" },
      { href: "/admin/pages", icon: "article", label: "상세페이지" },
      { href: "/admin/pricing", icon: "sell", label: "통합 가격 설정" },
    ],
  },
  {
    title: "구독",
    permission: "subscriptions",
    items: [
      { href: "/admin/subscriptions", icon: "autorenew", label: "구독 관리" },
      { href: "/admin/subscribe-settings", icon: "tune", label: "구독 설정" },
    ],
  },
  {
    title: "고객",
    permission: "customers",
    items: [
      { href: "/admin/members", icon: "people", label: "회원 관리" },
      { href: "/admin/reviews", icon: "rate_review", label: "리뷰 관리" },
      { href: "/admin/notifications", icon: "notifications", label: "알림톡" },
    ],
  },
  {
    title: "시스템",
    permission: "system",
    items: [
      { href: "/admin/sidebar", icon: "view_sidebar", label: "사이드바" },
      { href: "/admin/permissions", icon: "admin_panel_settings", label: "관리자 권한" },
      { href: "/admin/settings", icon: "settings", label: "설정" },
    ],
  },
];

export default function Sidebar({
  name,
  email,
  permissions: permissionsRaw,
}: {
  name: string | null;
  email: string | null;
  permissions: string | null;
}) {
  const pathname = usePathname();

  const permissions = parsePermissions(permissionsRaw);
  // permissions === null → 슈퍼관리자 (모든 메뉴 표시)
  const isSuperAdmin = permissions === null;

  const visibleGroups = menuGroups.filter(
    (group) => isSuperAdmin || permissions.includes(group.permission)
  );

  return (
    <aside className="w-52 bg-[#1a1f2e] min-h-screen flex flex-col print:hidden">
      {/* 로고 */}
      <div className="h-12 flex items-center px-4 border-b border-white/5 gap-2">
        <Link href="/" className="text-lg font-black text-[#1D9E75] hover:text-[#5DCAA5] transition">
          W2O
        </Link>
        <Link href="/admin/dashboard" className="text-xs text-white/50 tracking-widest hover:text-white/80 transition">
          ADMIN
        </Link>
      </div>

      {/* 메뉴 */}
      <nav className="flex-1 py-1 overflow-y-auto">
        {visibleGroups.map((group, gi) => (
          <div key={group.title} className={gi === 0 ? "" : "mt-1"}>
            <div className="px-4 pt-1 pb-0 text-[9px] font-bold tracking-wider text-white/30 uppercase">
              {group.title}
            </div>
            {group.items.map((item) => {
              const active = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-[1px] text-[12px] leading-5 transition ${
                    active
                      ? "bg-[#1D9E75]/10 text-[#1D9E75] border-r-2 border-[#1D9E75]"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* 하단 - 사용자 정보 + 로그아웃 */}
      <div className="px-3 py-2 border-t border-white/5">
        {name && (
          <Link
            href="/mypage/profile?from=admin"
            title="내 정보 · 비밀번호 변경"
            className="flex items-center gap-2 mb-1 -mx-1 px-1 py-1 rounded-lg hover:bg-white/5 transition group"
          >
            <div className="w-6 h-6 bg-[#1D9E75]/20 rounded-full flex items-center justify-center text-[#1D9E75] text-[11px] font-bold shrink-0">
              {name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] text-white/80 font-medium truncate leading-tight">
                {name}
              </div>
              {email && <div className="text-[10px] text-white/30 truncate">{email}</div>}
              {isSuperAdmin && (
                <div className="text-[9px] text-[#EF9F27] font-semibold">슈퍼관리자</div>
              )}
            </div>
            <span className="material-symbols-outlined text-lg text-white/20 group-hover:text-white/60 transition">
              manage_accounts
            </span>
          </Link>
        )}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 w-full px-1 py-1 text-[12px] text-gray-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition"
        >
          <span className="material-symbols-outlined text-[15px]">logout</span>
          로그아웃
        </button>
        <div className="text-[10px] text-gray-600 mt-1">v0.1.0</div>
      </div>
    </aside>
  );
}
