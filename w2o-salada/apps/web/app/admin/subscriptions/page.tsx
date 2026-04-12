"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { fetcher } from "../../lib/fetcher";

const REGULAR_PRICE = 7500; // 정가 (중도해지 정산 기준)

type SubUser = { id: string; name: string; email: string; phone: string | null };
type SubPeriod = { id: string; year: number; month: number; status: string; totalAmount: number; paidAt: string | null };
type Sub = {
  id: string;
  selectionMode: string;
  itemsPerDelivery: number;
  status: string;
  price: number;
  nextBillingDate: string | null;
  startedAt: string | null;
  user: SubUser;
  periods: SubPeriod[];
};

const statusLabels: Record<string, string> = { PENDING: "대기", ACTIVE: "활성", PAUSED: "정지", CANCELLED: "해지" };
const statusColors: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-500",
  ACTIVE: "bg-green-50 text-green-600",
  PAUSED: "bg-amber-50 text-amber-600",
  CANCELLED: "bg-gray-100 text-gray-400",
};
const modeLabels: Record<string, string> = { MANUAL: "직접선택", AUTO: "위임형" };

export default function AdminSubscriptionsPage() {
  const [filter, setFilter] = useState({ status: "", mode: "", search: "" });
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (filter.status) params.set("status", filter.status);
  if (filter.mode) params.set("plan", filter.mode);
  if (filter.search) params.set("search", filter.search);
  params.set("page", String(page));
  params.set("limit", "20");
  const apiUrl = `/api/admin/subscriptions?${params}`;

  const { data, isLoading: loading, mutate } = useSWR(apiUrl, fetcher, { revalidateOnFocus: false });
  const subs: Sub[] = data?.subscriptions || [];
  const total: number = data?.pagination?.total || 0;

  const handleSearch = () => { setPage(1); };

  // 중도해지 정산
  const [cancelModal, setCancelModal] = useState<Sub | null>(null);
  const [cancelDelivered, setCancelDelivered] = useState(0); // 배송 완료 건수
  const [cancelItemsPerDelivery, setCancelItemsPerDelivery] = useState(2);
  const [cancelling, setCancelling] = useState(false);

  const openCancelModal = (sub: Sub) => {
    setCancelModal(sub);
    setCancelDelivered(0);
    setCancelItemsPerDelivery(sub.itemsPerDelivery);
  };

  const cancelSettlement = {
    deliveredItems: cancelDelivered * cancelItemsPerDelivery,
    regularTotal: cancelDelivered * cancelItemsPerDelivery * REGULAR_PRICE,
    paidTotal: cancelDelivered * cancelItemsPerDelivery * (cancelModal?.price ? Math.round(cancelModal.price / (cancelModal.itemsPerDelivery * 1)) : 5900),
    get difference() { return this.regularTotal - this.paidTotal; },
  };

  const handleCancelSubmit = useCallback(async () => {
    if (!cancelModal) return;
    setCancelling(true);
    try {
      await fetch(`/api/subscriptions/${cancelModal.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "중도해지",
          deliveredCount: cancelDelivered,
          itemsPerDelivery: cancelItemsPerDelivery,
          regularPrice: REGULAR_PRICE,
          settlement: cancelSettlement.difference,
        }),
      });
      setCancelModal(null);
      mutate();
    } catch {
      alert("해지 처리 중 오류가 발생했습니다.");
    } finally {
      setCancelling(false);
    }
  }, [cancelModal, cancelDelivered, cancelItemsPerDelivery, cancelSettlement.difference]);

  // 갱신 예정 수
  const renewalCount = subs.filter((s) => {
    if (s.status !== "ACTIVE" || !s.nextBillingDate) return false;
    const diff = new Date(s.nextBillingDate).getTime() - Date.now();
    return diff <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">구독 관리</h1>
          <p className="text-gray-500 text-sm mt-1">총 {total}건</p>
        </div>
        {renewalCount > 0 && (
          <div className="px-4 py-2 bg-amber-50 text-amber-600 rounded-lg text-sm font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">schedule</span>
            갱신 예정 {renewalCount}건
          </div>
        )}
      </div>

      {/* 필터 */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select
          value={filter.status}
          onChange={(e) => { setFilter({ ...filter, status: e.target.value }); setPage(1); }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#1D9E75]"
        >
          <option value="">전체 상태</option>
          <option value="ACTIVE">활성</option>
          <option value="PAUSED">정지</option>
          <option value="PENDING">대기</option>
          <option value="CANCELLED">해지</option>
        </select>
        <select
          value={filter.mode}
          onChange={(e) => { setFilter({ ...filter, mode: e.target.value }); setPage(1); }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#1D9E75]"
        >
          <option value="">전체 유형</option>
          <option value="MANUAL">직접선택</option>
          <option value="AUTO">위임형</option>
        </select>
        <div className="flex gap-1">
          <input
            type="text"
            placeholder="이름 / 이메일 검색"
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#1D9E75] w-48"
          />
          <button onClick={handleSearch} className="px-3 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-700 transition">
            검색
          </button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-3 border-[#1D9E75] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : subs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <span className="material-symbols-outlined text-4xl mb-2 block">inbox</span>
            <p>구독 내역이 없습니다</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">회원</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">유형</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">수량</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">금액</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">상태</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">다음 결제</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">시작일</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">관리</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((sub) => {
                const isRenewal = sub.status === "ACTIVE" && sub.nextBillingDate &&
                  (new Date(sub.nextBillingDate).getTime() - Date.now()) <= 7 * 24 * 60 * 60 * 1000;

                return (
                  <tr key={sub.id} className={`border-b border-gray-100 hover:bg-gray-50 transition ${isRenewal ? "bg-amber-50/30" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{sub.user.name}</p>
                      <p className="text-xs text-gray-400">{sub.user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${sub.selectionMode === "AUTO" ? "text-[#EF9F27]" : "text-[#1D9E75]"}`}>
                        {modeLabels[sub.selectionMode] ?? sub.selectionMode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{sub.itemsPerDelivery}개/회</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{sub.price.toLocaleString()}원</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${statusColors[sub.status] ?? "bg-gray-100 text-gray-400"}`}>
                        {statusLabels[sub.status] ?? sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {sub.nextBillingDate
                        ? new Date(sub.nextBillingDate).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
                        : "-"}
                      {isRenewal && (
                        <span className="material-symbols-outlined text-amber-500 text-sm ml-1 align-text-bottom">schedule</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {sub.startedAt
                        ? new Date(sub.startedAt).toLocaleDateString("ko-KR")
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(sub.status === "ACTIVE" || sub.status === "PAUSED") && (
                        <button
                          onClick={() => openCancelModal(sub)}
                          className="px-3 py-1 bg-red-50 text-red-500 text-xs rounded-lg hover:bg-red-100 transition font-medium"
                        >
                          중도해지
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 페이징 */}
      {total > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 rounded border border-gray-200 text-sm disabled:opacity-40">이전</button>
          <span className="px-3 py-1.5 text-sm text-gray-600">{page} / {Math.ceil(total / 20)}</span>
          <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(page + 1)} className="px-3 py-1.5 rounded border border-gray-200 text-sm disabled:opacity-40">다음</button>
        </div>
      )}
      {/* 중도해지 정산 모달 */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setCancelModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">중도해지 정산</h3>
            <p className="text-sm text-gray-500 mb-5">{cancelModal.user.name} ({cancelModal.user.email})</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-600 block mb-1">배송 완료 횟수</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCancelDelivered(Math.max(0, cancelDelivered - 1))}
                    className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center font-bold text-gray-500 hover:bg-gray-50"
                  >−</button>
                  <span className="text-2xl font-black text-gray-800 min-w-[3ch] text-center">{cancelDelivered}회</span>
                  <button
                    onClick={() => setCancelDelivered(cancelDelivered + 1)}
                    className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center font-bold text-gray-500 hover:bg-gray-50"
                  >+</button>
                  <span className="text-xs text-gray-400">× {cancelItemsPerDelivery}개/회</span>
                </div>
              </div>

              {/* 정산 내역 */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">배송 상품 수</span>
                  <span className="font-medium">{cancelSettlement.deliveredItems}개</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">정가 기준 ({REGULAR_PRICE.toLocaleString()}원/개)</span>
                  <span className="font-medium">{cancelSettlement.regularTotal.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">구독가 결제 금액</span>
                  <span className="font-medium">{cancelSettlement.paidTotal.toLocaleString()}원</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="text-gray-700 font-semibold">차액 (공제)</span>
                  <span className="font-bold text-red-600">{cancelSettlement.difference.toLocaleString()}원</span>
                </div>
                {cancelSettlement.paidTotal > cancelSettlement.regularTotal && (
                  <p className="text-xs text-green-600 mt-1">* 환불 가능 금액이 발생합니다.</p>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-amber-700 text-xs">
                  위 차액({cancelSettlement.difference.toLocaleString()}원)을 공제한 후 나머지 금액을 환불 처리합니다.
                  미배송분은 전액 환불됩니다.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setCancelModal(null)}
                className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition"
              >
                취소
              </button>
              <button
                onClick={handleCancelSubmit}
                disabled={cancelling || cancelDelivered === 0}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition disabled:opacity-50"
              >
                {cancelling ? "처리 중..." : "해지 처리"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
