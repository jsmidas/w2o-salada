"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "../../lib/fetcher";

type OrderItem = {
  id: string;
  quantity: number;
  product: { name: string };
};

type Order = {
  id: string;
  orderNo: string;
  status: string;
  totalAmount: number;
  deliveryFee: number;
  createdAt: string;
  user: { name: string; email: string };
  items: OrderItem[];
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const statusColors: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  PAID: "bg-blue-100 text-blue-700",
  PREPARING: "bg-amber-100 text-amber-700",
  SHIPPING: "bg-purple-100 text-purple-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-600",
  REFUNDED: "bg-gray-100 text-gray-500",
  FAILED: "bg-red-100 text-red-600",
};

const statusLabels: Record<string, string> = {
  PENDING: "결제대기",
  PAID: "결제완료",
  PREPARING: "준비중",
  SHIPPING: "배송중",
  DELIVERED: "배송완료",
  CANCELLED: "취소",
  REFUNDED: "환불완료",
  FAILED: "결제실패",
};

const statusFilter = ["all", "PENDING", "PAID", "PREPARING", "SHIPPING", "DELIVERED", "CANCELLED"];

const nextStatus: Record<string, string> = {
  PAID: "PREPARING",
  PREPARING: "SHIPPING",
  SHIPPING: "DELIVERED",
};

export default function OrdersPage() {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  const params = new URLSearchParams();
  if (filter !== "all") params.set("status", filter);
  params.set("page", String(page));
  params.set("limit", String(limit));
  const apiUrl = `/api/admin/orders?${params}`;

  const { data, isLoading: loading, mutate } = useSWR<{ orders: Order[]; pagination: Pagination }>(apiUrl, fetcher, { revalidateOnFocus: false });
  const orders = data?.orders ?? [];
  const pagination = data?.pagination;
  const total = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    mutate();
  };

  const handleFilterChange = (s: string) => {
    setFilter(s);
    setPage(1);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">주문 관리</h2>
        <span className="text-sm text-gray-500">
          총 <span className="font-bold text-gray-800">{total}건</span>
        </span>
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {statusFilter.map((s) => (
          <button
            key={s}
            onClick={() => handleFilterChange(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === s
                ? "bg-[#1D9E75] text-white"
                : "bg-white text-gray-600 border hover:bg-gray-50"
            }`}
          >
            {s === "all" ? "전체" : statusLabels[s]}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">주문번호</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">고객</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">상품</th>
              <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">금액</th>
              <th className="text-center px-5 py-3 text-sm font-medium text-gray-500">상태</th>
              <th className="text-center px-5 py-3 text-sm font-medium text-gray-500">주문일</th>
              <th className="text-center px-5 py-3 text-sm font-medium text-gray-500">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <div className="inline-block w-6 h-6 border-2 border-[#1D9E75] border-t-transparent rounded-full animate-spin" />
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16 text-gray-400">
                  <span className="material-symbols-outlined text-4xl text-gray-200 block mb-2">receipt_long</span>
                  {filter === "all" ? "아직 주문이 없습니다." : `${statusLabels[filter]} 주문이 없습니다.`}
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-4">
                    <p className="font-medium text-gray-800 text-sm">{order.orderNo}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm text-gray-800">{order.user?.name ?? "-"}</p>
                    <p className="text-xs text-gray-400">{order.user?.email}</p>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">
                    {order.items.length > 0 ? (
                      <>
                        {order.items[0]?.product.name}
                        {order.items.length > 1 && (
                          <span className="text-gray-400"> 외 {order.items.length - 1}건</span>
                        )}
                      </>
                    ) : "-"}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-800 text-right font-medium">
                    {order.totalAmount.toLocaleString()}원
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {statusLabels[order.status] ?? order.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleDateString("ko-KR", {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {nextStatus[order.status] ? (
                      <button
                        onClick={() => handleStatusChange(order.id, nextStatus[order.status]!)}
                        className="px-3 py-1 bg-[#1D9E75] text-white text-xs rounded-lg hover:bg-[#178a64] transition"
                      >
                        {statusLabels[nextStatus[order.status]!]}으로
                      </button>
                    ) : order.status === "PAID" || order.status === "PENDING" ? (
                      <button
                        onClick={() => handleStatusChange(order.id, "CANCELLED")}
                        className="px-3 py-1 bg-red-50 text-red-500 text-xs rounded-lg hover:bg-red-100 transition"
                      >
                        취소
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 rounded border border-gray-200 text-sm disabled:opacity-40 hover:bg-gray-50 transition"
          >
            이전
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-600">{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 rounded border border-gray-200 text-sm disabled:opacity-40 hover:bg-gray-50 transition"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
