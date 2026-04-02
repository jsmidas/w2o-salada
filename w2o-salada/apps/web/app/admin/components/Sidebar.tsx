"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const menuItems = [
  { href: "/admin/dashboard", icon: "dashboard", label: "대시보드" },
  { href: "/admin/orders", icon: "receipt_long", label: "주문 관리" },
  { href: "/admin/products", icon: "inventory_2", label: "상품 관리" },
  { href: "/admin/categories", icon: "category", label: "카테고리" },
  { href: "/admin/pages", icon: "article", label: "상세페이지" },
  { href: "/admin/subscriptions", icon: "autorenew", label: "구독 관리" },
  { href: "/admin/delivery", icon: "local_shipping", label: "배송 관리" },
  { href: "/admin/members", icon: "people", label: "회원 관리" },
  { href: "/admin/stats", icon: "bar_chart", label: "통계" },
  { href: "/admin/settings", icon: "settings", label: "설정" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <aside className="w-60 bg-[#1a1f2e] min-h-screen flex flex-col">
      {/* 로고 */}
      <div className="h-16 flex items-center px-5 border-b border-white/5 gap-2">
        <Link href="/" className="text-lg font-black text-[#1D9E75] hover:text-[#5DCAA5] transition">
          W2O
        </Link>
        <Link href="/admin/dashboard" className="text-xs text-white/50 tracking-widest hover:text-white/80 transition">
          ADMIN
        </Link>
      </div>

      {/* 메뉴 */}
      <nav className="flex-1 py-4">
        {menuItems.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                active
                  ? "bg-[#1D9E75]/10 text-[#1D9E75] border-r-2 border-[#1D9E75]"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 하단 - 사용자 정보 + 로그아웃 */}
      <div className="p-4 border-t border-white/5">
        {user && (
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-[#1D9E75]/20 rounded-full flex items-center justify-center text-[#1D9E75] text-sm font-bold shrink-0">
              {user.name?.charAt(0) ?? "A"}
            </div>
            <div className="min-w-0">
              <div className="text-sm text-white/80 font-medium truncate">
                {user.name}
              </div>
              <div className="text-xs text-white/30 truncate">{user.email}</div>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 w-full px-2 py-2 text-sm text-gray-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition"
        >
          <span className="material-symbols-outlined text-lg">logout</span>
          로그아웃
        </button>
        <div className="text-xs text-gray-600 mt-3">v0.1.0</div>
      </div>
    </aside>
  );
}
