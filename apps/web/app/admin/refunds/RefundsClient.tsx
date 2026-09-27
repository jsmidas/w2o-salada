"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "../../lib/fetcher";

type Req = {
  id: string;
  kind: "SUBSCRIPTION_CANCEL" | "CREDIT_PAYOUT" | "ORDER";
  reason: string | null;
  reasonDetail: string | null;
  requestedAmount: number;
  feeAmount: number;
  refundAmount: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";
  adminNote: string | null;
  createdAt: string;
  processedAt: string | null;
  user: { id: string; name: string; email: string; phone: string | null };
  subscription: { id: string; status: string; cycleWeeks: number; price: number } | null;
  order: { id: string; orderNo: string; totalAmount: number; paymentKey: string | null; status: string } | null;
};
type Stats = {
  pendingCount: number;
  pendingAmount: number;
  byReason: { reason: string; count: number }[];
  byReason30: { reason: string; count: number }[];
};

const REASON_LABEL: Record<string, string> = {
  TASTE: "맛·품질", DELIVERY: "배송", PRICE: "가격", PERSONAL: "개인 사정", HEALTH: "건강·식단", COMPETITOR: "다른 서비스", OTHER: "기타", UNKNOWN: "미기재",
};
const KIND_LABEL: Record<Req["kind"], string> = { SUBSCRIPTION_CANCEL: "구독 해지", CREDIT_PAYOUT: "크레딧 환불", ORDER: "주문 환불" };
const STATUS_LABEL: Record<Req["status"], string> = { PENDING: "검토 대기", APPROVED: "승인", REJECTED: "거절", COMPLETED: "환불 완료" };
const STATUS_COLOR: Record<Req["status"], string> = {
  PENDING: "bg-amber-50 text-amber-700", APPROVED: "bg-blue-50 text-blue-700", REJECTED: "bg-gray-100 text-gray-500", COMPLETED: "bg-green-50 text-green-700",
};

export default function RefundsClient() {
  const [status, setStatus] = useState<string>("PENDING");
  const url = `/api/admin/refunds${status ? `?status=${status}` : ""}`;
  const { data, isLoading, mutate } = useSWR<{ requests: Req[]; stats: Stats }>(url, fetcher, { revalidateOnFocus: false });
  const rows = data?.requests ?? [];
  const stats = data?.stats;

  const [target, setTarget] = useState<Req | null>(null);
  const [mode, setMode] = useState<"approve" | "manual" | "reject">("approve");
  const [fee, setFee] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const open = (r: Req, m: "approve" | "manual" | "reject") => {
    setTarget(r); setMode(m); setFee(r.feeAmount ?? 0); setNote(r.adminNote ?? "");
  };

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/refunds/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, feeAmount: fee, adminNote: note }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { alert((j as { error?: string }).error ?? "처리 실패"); return; }
      setTarget(null);
      mutate();
    } finally {
      setBusy(false);
    }
  };

  const totalReason = (stats?.byReason ?? []).reduce((s, r) => s + r.count, 0);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-1">환불 신청</h2>
      <p className="text-sm text-gray-500 mb-6">
        해지·크레딧 환불은 자동으로 돈이 나가지 않습니다. 사유를 보고 약관에 따른 수수료를 정한 뒤 승인하면 토스 결제가 그 금액만큼 부분 취소됩니다.
      </p>

      {/* 요약 + 이탈 사유 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <p className="text-xs text-gray-500">검토 대기</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{stats?.pendingCount ?? 0}건</p>
          <p className="text-sm text-amber-600 font-medium">{(stats?.pendingAmount ?? 0).toLocaleString()}원</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border md:col-span-2">
          <p className="text-xs text-gray-500 mb-2">해지 사유 분포 (전체 {totalReason}건 · 괄호는 최근 30일)</p>
          <div className="space-y-1.5">
            {(stats?.byReason ?? []).sort((a, b) => b.count - a.count).map((r) => {
              const r30 = stats?.byReason30.find((x) => x.reason === r.reason)?.count ?? 0;
              const pct = totalReason ? Math.round((r.count / totalReason) * 100) : 0;
              return (
                <div key={r.reason} className="flex items-center gap-3 text-sm">
                  <span className="w-24 text-gray-600">{REASON_LABEL[r.reason] ?? r.reason}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#1D9E75]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-20 text-right text-gray-700">{r.count}건 <span className="text-gray-400">({r30})</span></span>
                </div>
              );
            })}
            {totalReason === 0 && <p className="text-sm text-gray-400">아직 해지 신청이 없습니다.</p>}
          </div>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-4">
        {[["PENDING", "검토 대기"], ["COMPLETED", "환불 완료"], ["REJECTED", "거절"], ["", "전체"]].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setStatus(v!)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition ${status === v ? "bg-[#1D9E75] text-white border-[#1D9E75]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th className="px-4 py-3 text-left">접수</th>
              <th className="px-4 py-3 text-left">고객</th>
              <th className="px-4 py-3 text-left">구분</th>
              <th className="px-4 py-3 text-left">사유</th>
              <th className="px-4 py-3 text-right">신청액</th>
              <th className="px-4 py-3 text-right">수수료</th>
              <th className="px-4 py-3 text-right">환불액</th>
              <th className="px-4 py-3 text-left">결제 주문</th>
              <th className="px-4 py-3 text-center">상태</th>
              <th className="px-4 py-3 text-center">처리</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && rows.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">불러오는 중…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">해당 상태의 신청이 없습니다.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(r.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{r.user.name}</p>
                  <p className="text-xs text-gray-400">{r.user.phone ?? r.user.email}</p>
                </td>
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{KIND_LABEL[r.kind]}</td>
                <td className="px-4 py-3 max-w-xs">
                  <p className="text-gray-800">{r.reason ? REASON_LABEL[r.reason] ?? r.reason : "-"}</p>
                  {r.reasonDetail && <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{r.reasonDetail}</p>}
                  {r.adminNote && <p className="text-xs text-blue-600 mt-1">담당자: {r.adminNote}</p>}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-800 whitespace-nowrap">{r.requestedAmount.toLocaleString()}원</td>
                <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">{r.feeAmount ? `${r.feeAmount.toLocaleString()}원` : "-"}</td>
                <td className="px-4 py-3 text-right text-gray-800 whitespace-nowrap">{r.refundAmount !== null ? `${r.refundAmount.toLocaleString()}원` : "-"}</td>
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                  {r.order ? (
                    <>
                      <p>{r.order.orderNo}</p>
                      <p className="text-gray-400">{r.order.totalAmount.toLocaleString()}원 · {r.order.paymentKey ? "카드" : "결제키 없음"}</p>
                    </>
                  ) : "-"}
                </td>
                <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  {(r.status === "PENDING" || r.status === "APPROVED") ? (
                    <div className="flex flex-col gap-1">
                      <button onClick={() => open(r, "approve")} className="px-3 py-1 bg-[#1D9E75] text-white text-xs rounded-lg hover:bg-[#178a64]">승인·환불</button>
                      <button onClick={() => open(r, "manual")} className="px-3 py-1 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-50">수동 완료</button>
                      <button onClick={() => open(r, "reject")} className="px-3 py-1 text-red-500 text-xs rounded-lg hover:bg-red-50">거절</button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">{r.processedAt ? new Date(r.processedAt).toLocaleDateString("ko-KR") : "-"}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {target && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              {mode === "approve" ? "승인 · 토스 부분 취소" : mode === "manual" ? "수동 환불 완료 표시" : "거절"}
            </h3>
            <p className="text-sm text-gray-500 mb-4">{target.user.name} · {KIND_LABEL[target.kind]} · 신청 {target.requestedAmount.toLocaleString()}원</p>

            {mode !== "reject" && (
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-600 block mb-1">취소 수수료 (원)</label>
                <input type="number" min={0} max={target.requestedAmount} value={fee} onChange={(e) => setFee(Math.max(0, Number(e.target.value) || 0))} className="w-full px-3 py-2 border rounded-lg text-sm" />
                <p className="text-xs text-gray-500 mt-1">
                  환불액 <b className="text-gray-800">{Math.max(0, target.requestedAmount - fee).toLocaleString()}원</b>
                  {mode === "approve" && target.order && ` — ${target.order.orderNo} 결제에서 부분 취소`}
                  {mode === "approve" && !target.order && " — 연결된 결제가 없어 승인 불가, 수동 완료를 쓰세요"}
                </p>
              </div>
            )}
            <div className="mb-5">
              <label className="text-sm font-medium text-gray-600 block mb-1">담당자 메모{mode === "reject" && " (거절 사유, 필수)"}</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder={mode === "reject" ? "고객에게 안내한 거절 사유" : "수수료 산정 근거, 통화 내용 등"} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setTarget(null)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-600 text-sm hover:bg-gray-50">닫기</button>
              <button onClick={submit} disabled={busy} className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 ${mode === "reject" ? "bg-red-500 hover:bg-red-600" : "bg-[#1D9E75] hover:bg-[#178a64]"}`}>
                {busy ? "처리 중…" : mode === "approve" ? "환불 실행" : mode === "manual" ? "완료 표시" : "거절"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
