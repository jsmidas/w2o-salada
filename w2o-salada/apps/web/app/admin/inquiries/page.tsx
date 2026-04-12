"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "../../lib/fetcher";

type Inquiry = {
  id: string;
  name: string;
  phone: string;
  category: string;
  content: string;
  images: string | null;
  status: string;
  reply: string | null;
  repliedBy: string | null;
  repliedAt: string | null;
  createdAt: string;
  user: { name: string; email: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "대기",
  IN_PROGRESS: "처리중",
  RESOLVED: "완료",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-red-100 text-red-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  RESOLVED: "bg-green-100 text-green-700",
};

const CATEGORY_LABELS: Record<string, string> = {
  order: "📦 주문",
  delivery: "🚚 배송",
  subscription: "🔄 구독",
  general: "💬 기타",
};

export default function InquiriesPage() {
  const [filter, setFilter] = useState<string>("");
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);

  const qs = filter ? `?status=${filter}` : "";
  const { data, isLoading: loading, mutate } = useSWR(`/api/admin/inquiries${qs}`, fetcher, { revalidateOnFocus: false });
  const inquiries: Inquiry[] = data?.inquiries ?? [];
  const pending: number = data?.pending ?? 0;

  const openDetail = (inq: Inquiry) => {
    setSelected(inq);
    setReply(inq.reply ?? "");
  };

  const submitReply = async () => {
    if (!selected || !reply.trim()) return;
    setReplying(true);
    try {
      const res = await fetch(`/api/admin/inquiries/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: reply.trim() }),
      });
      if (res.ok) {
        setSelected(null);
        setReply("");
        mutate();
      } else {
        const data = await res.json();
        alert(data.error ?? "답변 저장에 실패했습니다.");
      }
    } finally {
      setReplying(false);
    }
  };

  const parsedImages = (img: string | null): string[] => {
    if (!img) return [];
    try { return JSON.parse(img); } catch { return []; }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-800">문의 관리</h2>
          {pending > 0 && (
            <span className="px-2.5 py-1 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
              {pending}건 대기
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {["", "PENDING", "IN_PROGRESS", "RESOLVED"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                filter === s
                  ? "bg-[#1D9E75] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s === "" ? "전체" : STATUS_LABELS[s] ?? s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-500 w-20">상태</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-500 w-20">유형</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">고객</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">내용</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-500 w-16">사진</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-500 w-32">접수일</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-500 w-20">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">로딩 중...</td></tr>
            ) : inquiries.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">문의가 없습니다.</td></tr>
            ) : (
              inquiries.map((inq) => (
                <tr
                  key={inq.id}
                  className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                  onClick={() => openDetail(inq)}
                >
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[inq.status] ?? "bg-gray-100"}`}>
                      {STATUS_LABELS[inq.status] ?? inq.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm">{CATEGORY_LABELS[inq.category] ?? inq.category}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-800">{inq.name}</div>
                    <div className="text-xs text-gray-400">{inq.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-xs">{inq.content}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-500">
                    {parsedImages(inq.images).length > 0 && (
                      <span className="material-symbols-outlined text-lg text-[#1D9E75]">photo_library</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-gray-500">
                    {new Date(inq.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button className="p-1.5 rounded-lg hover:bg-gray-100" title="상세/답변">
                      <span className="material-symbols-outlined text-lg text-gray-400">reply</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 상세/답변 모달 */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[selected.status]}`}>
                    {STATUS_LABELS[selected.status]}
                  </span>
                  <span className="text-sm">{CATEGORY_LABELS[selected.category]}</span>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="flex items-center gap-3 mb-4 pb-4 border-b">
                <div className="w-10 h-10 bg-[#1D9E75]/10 rounded-full flex items-center justify-center text-[#1D9E75] font-bold">
                  {selected.name.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-gray-800">{selected.name}</div>
                  <div className="text-xs text-gray-500">{selected.phone} · {new Date(selected.createdAt).toLocaleString("ko-KR")}</div>
                </div>
              </div>

              <div className="text-gray-700 text-sm leading-relaxed mb-4 whitespace-pre-wrap">{selected.content}</div>

              {parsedImages(selected.images).length > 0 && (
                <div className="flex gap-2 flex-wrap mb-4">
                  {parsedImages(selected.images).map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer" className="w-24 h-24 rounded-lg overflow-hidden border hover:opacity-80">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              )}

              {selected.reply && (
                <div className="bg-green-50 rounded-xl p-4 mb-4">
                  <div className="text-xs text-green-700 font-semibold mb-1">
                    답변 ({selected.repliedBy} · {selected.repliedAt ? new Date(selected.repliedAt).toLocaleString("ko-KR") : ""})
                  </div>
                  <div className="text-sm text-green-800 whitespace-pre-wrap">{selected.reply}</div>
                </div>
              )}

              <div className="border-t pt-4">
                <label className="text-sm font-semibold text-gray-700 mb-2 block">
                  {selected.reply ? "답변 수정" : "답변 작성"}
                </label>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="고객에게 보낼 답변을 작성하세요"
                  rows={4}
                  className="w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:border-[#1D9E75] resize-none"
                />
                <div className="flex justify-end gap-2 mt-3">
                  <button onClick={() => setSelected(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                    취소
                  </button>
                  <button
                    onClick={submitReply}
                    disabled={replying || !reply.trim()}
                    className="px-5 py-2 bg-[#1D9E75] text-white text-sm font-semibold rounded-lg hover:bg-[#178a64] disabled:opacity-40"
                  >
                    {replying ? "저장 중..." : "답변 저장 + 고객 알림"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
