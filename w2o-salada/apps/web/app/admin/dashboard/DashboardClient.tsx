"use client";

import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "../../lib/fetcher";

type Stats = {
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  preparingOrders: number;
  shippingOrders: number;
  totalProducts: number;
  totalMembers: number;
  activeSubscriptions: number;
};

type RecentOrder = {
  id: string;
  orderNo: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  user: { name: string; email: string };
};

const statusLabels: Record<string, string> = {
  PENDING: "결제대기",
  PAID: "결제완료",
  PREPARING: "준비중",
  SHIPPING: "배송중",
  DELIVERED: "배송완료",
  CANCELLED: "취소",
};

const statusColors: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  PAID: "bg-blue-100 text-blue-700",
  PREPARING: "bg-amber-100 text-amber-700",
  SHIPPING: "bg-purple-100 text-purple-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-600",
};

const quickActions = [
  { label: "상품 등록", icon: "add_circle", href: "/admin/products" },
  { label: "주문 확인", icon: "receipt_long", href: "/admin/orders" },
  { label: "배송 관리", icon: "local_shipping", href: "/admin/delivery" },
  { label: "회원 관리", icon: "people", href: "/admin/members" },
];

export default function DashboardClient({
  initialStats,
  initialOrders,
}: {
  initialStats: Stats;
  initialOrders: RecentOrder[];
}) {
  const { data: stats } = useSWR<Stats>("/api/admin/stats/overview", fetcher, {
    fallbackData: initialStats,
    revalidateOnFocus: false,
  });
  const { data: ordersData } = useSWR<{ orders: RecentOrder[] }>(
    "/api/admin/orders?limit=5",
    fetcher,
    {
      fallbackData: { orders: initialOrders },
      revalidateOnFocus: false,
    }
  );
  const recentOrders = ordersData?.orders ?? [];

  const statCards = [
    { label: "오늘 주문", value: `${stats!.todayOrders}건`, sub: `${stats!.todayRevenue.toLocaleString()}원`, icon: "receipt_long", color: "bg-blue-500" },
    { label: "결제 대기", value: `${stats!.pendingOrders}건`, sub: "", icon: "payments", color: "bg-amber-500" },
    { label: "준비 중", value: `${stats!.preparingOrders}건`, sub: "", icon: "inventory_2", color: "bg-green-500" },
    { label: "배송 중", value: `${stats!.shippingOrders}건`, sub: "", icon: "local_shipping", color: "bg-purple-500" },
  ];

  const summaryCards = [
    { label: "총 상품", value: stats!.totalProducts, icon: "restaurant_menu" },
    { label: "총 회원", value: stats!.totalMembers, icon: "people" },
    { label: "활성 구독", value: stats!.activeSubscriptions, icon: "autorenew" },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">대시보드</h2>

      {/* 오늘의 현황 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((s, i) => (
          <div key={i} className="bg-white rounded-xl p-5 shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{s.value}</p>
                {s.sub && <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>}
              </div>
              <div className={`${s.color} w-12 h-12 rounded-xl flex items-center justify-center`}>
                <span className="material-symbols-outlined text-white">{s.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {summaryCards.map((s, i) => (
          <div key={i} className="bg-white rounded-xl p-5 shadow-sm border text-center">
            <span className="material-symbols-outlined text-3xl text-[#1D9E75]">{s.icon}</span>
            <p className="text-2xl font-bold text-gray-800 mt-2">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 빠른 실행 */}
      <div className="bg-white rounded-xl p-6 shadow-sm border mb-8">
        <h3 className="font-bold text-gray-700 mb-4">빠른 실행</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((a, i) => (
            <Link
              key={i}
              href={a.href}
              className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-gray-50 transition border border-gray-100"
            >
              <span className="material-symbols-outlined text-3xl text-[#1D9E75]">{a.icon}</span>
              <span className="text-sm font-medium text-gray-600">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* 최근 주문 */}
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-700">최근 주문</h3>
          <Link href="/admin/orders" className="text-sm text-[#1D9E75] hover:underline">전체 보기</Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">아직 주문이 없습니다.</p>
        ) : (
          <table className="w-full">
            <thead className="border-b">
              <tr>
                <th className="text-left px-3 py-2 text-sm font-medium text-gray-500">주문번호</th>
                <th className="text-left px-3 py-2 text-sm font-medium text-gray-500">고객</th>
                <th className="text-right px-3 py-2 text-sm font-medium text-gray-500">금액</th>
                <th className="text-center px-3 py-2 text-sm font-medium text-gray-500">상태</th>
                <th className="text-center px-3 py-2 text-sm font-medium text-gray-500">일시</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-3 text-sm font-medium text-gray-800">{order.orderNo}</td>
                  <td className="px-3 py-3 text-sm text-gray-600">{order.user?.name ?? "-"}</td>
                  <td className="px-3 py-3 text-sm text-gray-800 text-right">{order.totalAmount.toLocaleString()}원</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {statusLabels[order.status] ?? order.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-500 text-center" suppressHydrationWarning>
                    {new Date(order.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
