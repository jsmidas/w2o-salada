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
  type?: "SINGLE" | "SUBSCRIPTION";
  status: string;
  totalAmount: number;
  deliveryFee: number;
  deliveryDate?: string | null;
  deliveryHold?: boolean;
  deliveryHoldReason?: string | null;
  deliveryHoldResolvedAt?: string | null;
  deliveryHoldNote?: string | null;
  createdAt: string;
  user: { name: string; email: string; phone?: string | null };
  address?: {
    label: string | null; name: string; phone: string; address1: string; address2: string | null;
    sigungu: string | null; bname: string | null; buildingName: string | null;
    distanceKm: number | null; areaStatus: "UNKNOWN" | "IN_RANGE" | "OUT_OF_RANGE";
  } | null;
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

// "hold" 는 상태가 아니라 배송지 확인 큐 (반경 밖·좌표 불명 주소, 미처리)
const statusFilter = ["all", "hold", "PENDING", "PAID", "PREPARING", "SHIPPING", "DELIVERED", "CANCELLED"];
const filterLabels: Record<string, string> = { all: "전체", hold: "배송지 확인" };

const areaLabel: Record<string, { text: string; cls: string }> = {
  IN_RANGE: { text: "권역 내", cls: "bg-green-50 text-green-700" },
  OUT_OF_RANGE: { text: "반경 밖", cls: "bg-red-50 text-red-600" },
  UNKNOWN: { text: "좌표 미확인", cls: "bg-gray-100 text-gray-500" },
};

const nextStatus: Record<string, string> = {
  PAID: "PREPARING",
  PREPARING: "SHIPPING",
  SHIPPING: "DELIVERED",
};

type Payload = { orders: Order[]; pagination: Pagination };

export default function OrdersClient({ initialData }: { initialData: Payload }) {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  const params = new URLSearchParams();
  if (filter !== "all") params.set("status", filter);
  params.set("page", String(page));
  params.set("limit", String(limit));
  const apiUrl = `/api/admin/orders?${params}`;
  const isInitial = filter === "all" && page === 1;

  const { data, mutate } = useSWR<Payload>(apiUrl, fetcher, {
    fallbackData: isInitial ? initialData : undefined,
    revalidateOnFocus: false,
  });
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

  // 배송지 확인 완료 — 통화 결과를 메모로 남기고 큐에서 뺀다
  const handleResolveHold = async (order: Order) => {
    const note = prompt(
      `${order.address?.name ?? order.user?.name ?? ""} 고객과 확인한 내용을 적어주세요.\n(예: 10/6부터 배송 가능 안내 / 취소 처리 / 대기 명단 등록)`,
      order.deliveryHoldNote ?? "",
    );
    if (note === null) return;
    const res = await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolveHold: true, holdNote: note }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert((err as { error?: string }).error ?? "처리 실패");
      return;
    }
    mutate();
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
            {filterLabels[s] ?? statusLabels[s]}
          </button>
        ))}
      </div>

      {filter === "hold" && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          배송 권역(센터 반경) 밖이거나 좌표를 확인하지 못한 주소로 들어온 주문입니다. 결제는 정상 완료된 상태이니
          주간(08~17시)에 고객에게 전화해 배송 가능 여부를 안내하고 <b>확인 완료</b>를 눌러 주세요.
          취소가 필요하면 확인 완료 후 상태를 취소로 바꿉니다.
        </div>
      )}

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
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16 text-gray-400">
                  <span className="material-symbols-outlined text-4xl text-gray-200 block mb-2">receipt_long</span>
                  {filter === "all" ? "아직 주문이 없습니다." : filter === "hold" ? "확인이 필요한 배송지가 없습니다." : `${statusLabels[filter]} 주문이 없습니다.`}
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-4">
                    <p className="font-medium text-gray-800 text-sm">{order.orderNo}</p>
                    {order.type === "SUBSCRIPTION" && (
                      <span className="text-[10px] text-[#1D9E75] bg-[#1D9E75]/10 px-1 rounded">구독</span>
                    )}
                    {order.deliveryHold && !order.deliveryHoldResolvedAt && (
                      <span className="ml-1 text-[10px] text-red-600 bg-red-50 px-1 rounded font-semibold">배송지 확인</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm text-gray-800">{order.user?.name ?? "-"}</p>
                    <p className="text-xs text-gray-400">{order.user?.email}</p>
                    {order.address && (
                      <div className="mt-1 text-xs text-gray-500 max-w-xs">
                        <span className="text-gray-700">
                          {order.address.label && <span className="text-gray-400">[{order.address.label}] </span>}
                          {order.address.name} · {order.address.phone}
                        </span>
                        <div className="truncate" title={`${order.address.address1} ${order.address.address2 ?? ""}`}>
                          {order.address.address1} {order.address.address2}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {order.address.bname && <span className="text-gray-400">{order.address.bname}</span>}
                          {order.address.buildingName && <span className="text-gray-400">· {order.address.buildingName}</span>}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${areaLabel[order.address.areaStatus]?.cls ?? ""}`}>
                            {areaLabel[order.address.areaStatus]?.text}
                            {order.address.distanceKm !== null && ` ${order.address.distanceKm}km`}
                          </span>
                        </div>
                        {order.deliveryHold && order.deliveryHoldReason && (
                          <div className="text-[11px] text-red-500 mt-0.5">{order.deliveryHoldReason}</div>
                        )}
                        {order.deliveryHoldNote && (
                          <div className="text-[11px] text-gray-500 mt-0.5">확인: {order.deliveryHoldNote}</div>
                        )}
                      </div>
                    )}
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
                  <td className="px-5 py-4 text-center text-sm text-gray-500" suppressHydrationWarning>
                    {new Date(order.createdAt).toLocaleDateString("ko-KR", {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {order.deliveryHold && !order.deliveryHoldResolvedAt && (
                      <button
                        onClick={() => handleResolveHold(order)}
                        className="mb-1 px-3 py-1 bg-amber-500 text-white text-xs rounded-lg hover:bg-amber-600 transition block mx-auto"
                      >
                        확인 완료
                      </button>
                    )}
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
