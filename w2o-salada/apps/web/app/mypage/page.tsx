"use client";

import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "../lib/fetcher";

const menus = [
  { href: "/mypage/orders", icon: "receipt_long", label: "주문내역", desc: "주문 및 배송 확인" },
  { href: "/mypage/subscription", icon: "autorenew", label: "구독관리", desc: "정기구독 현황" },
  { href: "/mypage/reviews", icon: "rate_review", label: "내 리뷰", desc: "리뷰 작성 · 관리" },
  { href: "/mypage/addresses", icon: "location_on", label: "배송지", desc: "주소 관리" },
  { href: "/mypage/inquiries", icon: "support_agent", label: "문의내역", desc: "문의 및 답변 확인" },
  { href: "/mypage/profile", icon: "person", label: "프로필", desc: "개인정보 수정" },
];

type RecentOrder = {
  id: string;
  orderNo: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: { id: string; quantity: number; product: { name: string } }[];
};

const statusLabels: Record<string, string> = {
  PENDING: "결제대기",
  PAID: "결제완료",
  PREPARING: "준비중",
  SHIPPING: "배송중",
  DELIVERED: "배송완료",
  CANCELLED: "취소",
  REFUNDED: "환불완료",
};

const statusColors: Record<string, string> = {
  PENDING: "text-gray-400",
  PAID: "text-blue-400",
  PREPARING: "text-amber-400",
  SHIPPING: "text-purple-400",
  DELIVERED: "text-brand-green",
  CANCELLED: "text-red-400",
  REFUNDED: "text-gray-400",
};

export default function MyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const { data: ordersData } = useSWR(
    status === "authenticated" ? "/api/orders" : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const recentOrders: RecentOrder[] = Array.isArray(ordersData) ? ordersData.slice(0, 2) : [];

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?redirect=/mypage");
    }
  }, [status, router]);

  if (status === "loading" || !session) return null;

  return (
    <div className="min-h-screen bg-brand-dark">
      <header className="sticky top-0 z-50 bg-brand-deep/95 backdrop-blur border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5">
            <span className="text-lg font-black text-brand-green">W2O</span>
            <span className="text-xs text-white/50 tracking-widest">SALADA</span>
          </Link>
          <h1 className="text-white font-bold">마이페이지</h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* 회원 정보 카드 */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10 mb-6">
          <div className="flex items-center gap-4">
            {session.user?.image ? (
              <img
                src={session.user.image}
                alt="프로필 사진"
                className="w-14 h-14 rounded-full object-cover border-2 border-brand-green/30"
              />
            ) : (
              <div className="w-14 h-14 bg-brand-green/20 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-brand-green text-2xl">person</span>
              </div>
            )}
            <div className="flex-1">
              <p className="text-white font-bold text-lg">{session.user?.name}님</p>
              <p className="text-gray-500 text-sm">{session.user?.email}</p>
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-white/10 rounded-lg hover:border-white/30 transition"
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* 최근 주문 */}
        {recentOrders.length > 0 && (
          <div className="bg-white/5 rounded-xl p-5 border border-white/10 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-brand-green text-lg">local_shipping</span>
                최근 주문
              </h3>
              <Link href="/mypage/orders" className="text-xs text-brand-green hover:underline">
                전체보기
              </Link>
            </div>
            <div className="space-y-3">
              {recentOrders.map((order) => {
                const itemName = order.items?.[0]?.product.name ?? "상품";
                const extra = (order.items?.length ?? 0) > 1 ? ` 외 ${order.items.length - 1}건` : "";
                return (
                  <Link
                    key={order.id}
                    href="/mypage/orders"
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/[0.08] transition"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {itemName}{extra}
                      </p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {order.orderNo} · {new Date(order.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <p className="text-white text-sm font-bold">{order.totalAmount.toLocaleString()}원</p>
                      <p className={`text-xs font-medium ${statusColors[order.status] ?? "text-gray-400"}`}>
                        {statusLabels[order.status] ?? order.status}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* 메뉴 그리드 */}
        <div className="grid grid-cols-2 gap-3">
          {menus.map((menu) => (
            <Link
              key={menu.href}
              href={menu.href}
              className="bg-white/5 rounded-xl p-5 border border-white/10 hover:border-brand-green/40 hover:bg-white/[0.07] transition group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="material-symbols-outlined text-brand-green text-2xl">
                  {menu.icon}
                </span>
                <span className="material-symbols-outlined text-white/20 text-lg group-hover:text-white/40 transition">
                  chevron_right
                </span>
              </div>
              <p className="text-white font-bold text-base mb-0.5">{menu.label}</p>
              <p className="text-gray-500 text-xs">{menu.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
