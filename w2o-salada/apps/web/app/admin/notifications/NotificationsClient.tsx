"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "../../lib/fetcher";

type Notification = {
  id: string;
  templateCode: string | null;
  content: string;
  status: "PENDING" | "SENT" | "FAILED";
  sentAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
};

type Template = { code: string; preview: string };

const statusLabels: Record<string, string> = {
  PENDING: "대기",
  SENT: "발송 완료",
  FAILED: "실패",
};

const statusColors: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  SENT: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

const templateLabels: Record<string, string> = {
  ORDER_PAID: "주문 완료",
  DELIVERY_START: "배송 출발",
  DELIVERY_DONE: "배송 완료",
  SUB_PAID: "구독 결제",
  PAYMENT_FAIL: "결제 실패",
};

type InitialData = {
  notifications: Notification[];
  templates: Template[];
  mode: "mock" | "live";
};

export default function NotificationsClient({ initialData }: { initialData: InitialData }) {
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTemplate, setFilterTemplate] = useState("");

  const params = new URLSearchParams();
  if (filterStatus) params.set("status", filterStatus);
  if (filterTemplate) params.set("templateCode", filterTemplate);
  const apiUrl = `/api/admin/notifications?${params.toString()}`;
  const isInitial = !filterStatus && !filterTemplate;

  const { data, isLoading: loading, mutate } = useSWR(apiUrl, fetcher, {
    fallbackData: isInitial ? initialData : undefined,
    revalidateOnFocus: false,
  });
  const notifications: Notification[] = data?.notifications ?? [];
  const templates: Template[] = data?.templates ?? [];
  const mode: "mock" | "live" = data?.mode ?? "mock";

  // 테스트 발송 폼
  const [showTestForm, setShowTestForm] = useState(false);
  const [testTemplate, setTestTemplate] = useState("ORDER_PAID");
  const [testPhone, setTestPhone] = useState("");
  const [testVars, setTestVars] = useState<Record<string, string>>({
    고객명: "홍길동",
    주문번호: "W2O-TEST-0001",
    배송일: "4월 15일",
    금액: "11,000",
    월: "4",
  });
  const [sending, setSending] = useState(false);

  // 템플릿별 필요 변수 추출
  const requiredVars = (() => {
    const preview = templates.find((t) => t.code === testTemplate)?.preview ?? "";
    const matches = preview.matchAll(/#\{([^}]+)\}/g);
    return Array.from(new Set(Array.from(matches, (m) => m[1]!)));
  })();

  const handleTestSend = async () => {
    if (!testPhone.trim()) {
      alert("수신 전화번호를 입력해주세요.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateCode: testTemplate,
          to: testPhone,
          variables: Object.fromEntries(
            requiredVars.map((k) => [k, testVars[k] ?? ""]),
          ),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(`발송 실패: ${data.error ?? "알 수 없는 오류"}`);
        return;
      }
      alert(
        data.mocked
          ? "Mock 모드로 발송 기록되었습니다. (콘솔 확인)"
          : "알림톡이 발송되었습니다.",
      );
      setShowTestForm(false);
      mutate();
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">알림톡 관리</h2>
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              mode === "live"
                ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {mode === "live" ? "LIVE 모드" : "MOCK 모드"}
          </span>
          <button
            type="button"
            onClick={() => setShowTestForm((v) => !v)}
            className="px-4 py-2 bg-[#1D9E75] text-white rounded-lg text-sm font-semibold hover:bg-[#178761] transition"
          >
            테스트 발송
          </button>
        </div>
      </div>

      {/* 모드 안내 */}
      {mode === "mock" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-900">
          <p className="font-semibold mb-1">⚠️ Mock 모드로 동작 중입니다.</p>
          <p className="text-xs">
            환경변수 <code className="bg-amber-100 px-1 rounded">SOLAPI_API_KEY</code>,{" "}
            <code className="bg-amber-100 px-1 rounded">SOLAPI_API_SECRET</code>,{" "}
            <code className="bg-amber-100 px-1 rounded">SOLAPI_PFID</code>가 설정되지 않았습니다.
            실제 발송은 되지 않고 DB에만 기록됩니다.
          </p>
        </div>
      )}

      {/* 테스트 발송 폼 */}
      {showTestForm && (
        <div className="bg-white rounded-xl p-6 shadow-sm border mb-4">
          <h3 className="font-bold text-gray-800 mb-4">테스트 발송</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-600 block mb-1">템플릿</label>
              <select
                value={testTemplate}
                onChange={(e) => setTestTemplate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#1D9E75]"
              >
                {templates.map((t) => (
                  <option key={t.code} value={t.code}>
                    {templateLabels[t.code] ?? t.code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-600 block mb-1">수신 전화번호</label>
              <input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="010-0000-0000"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#1D9E75]"
              />
            </div>

            {requiredVars.map((varName) => (
              <div key={varName}>
                <label className="text-xs text-gray-600 block mb-1">#{"{"}
                  {varName}
                  {"}"}</label>
                <input
                  type="text"
                  value={testVars[varName] ?? ""}
                  onChange={(e) =>
                    setTestVars({ ...testVars, [varName]: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#1D9E75]"
                />
              </div>
            ))}

            {/* 미리보기 */}
            <div>
              <label className="text-xs text-gray-600 block mb-1">미리보기</label>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm whitespace-pre-wrap text-gray-800">
                {(() => {
                  let preview =
                    templates.find((t) => t.code === testTemplate)?.preview ?? "";
                  for (const [k, v] of Object.entries(testVars)) {
                    preview = preview.replaceAll(`#{${k}}`, v);
                  }
                  return preview;
                })()}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowTestForm(false)}
                className="flex-1 py-2 border text-gray-600 rounded-lg hover:bg-gray-50 transition text-sm"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleTestSend}
                disabled={sending}
                className="flex-1 py-2 bg-[#1D9E75] text-white rounded-lg font-semibold hover:bg-[#178761] transition text-sm disabled:opacity-50"
              >
                {sending ? "발송 중..." : "발송"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="bg-white rounded-xl p-4 shadow-sm border mb-4 flex gap-3 flex-wrap">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#1D9E75]"
        >
          <option value="">전체 상태</option>
          <option value="SENT">발송 완료</option>
          <option value="PENDING">대기</option>
          <option value="FAILED">실패</option>
        </select>
        <select
          value={filterTemplate}
          onChange={(e) => setFilterTemplate(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#1D9E75]"
        >
          <option value="">전체 템플릿</option>
          {templates.map((t) => (
            <option key={t.code} value={t.code}>
              {templateLabels[t.code] ?? t.code}
            </option>
          ))}
        </select>
      </div>

      {/* 이력 테이블 */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">시간</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">템플릿</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">수신자</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-gray-500">내용</th>
              <th className="text-center px-5 py-3 text-sm font-medium text-gray-500">상태</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-500">
                  로딩 중...
                </td>
              </tr>
            ) : notifications.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-500">
                  발송 이력이 없습니다.
                </td>
              </tr>
            ) : (
              notifications.map((n) => (
                <tr key={n.id} className="border-b hover:bg-gray-50">
                  <td className="px-5 py-3 text-sm text-gray-600 whitespace-nowrap" suppressHydrationWarning>
                    {new Date(n.createdAt).toLocaleString("ko-KR", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-5 py-3 text-sm">
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                      {templateLabels[n.templateCode ?? ""] ?? n.templateCode ?? "-"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm">
                    <div className="text-gray-800">{n.user.name}</div>
                    <div className="text-xs text-gray-500">{n.user.phone ?? "-"}</div>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-600 max-w-md truncate">
                    {n.content}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                        statusColors[n.status]
                      }`}
                    >
                      {statusLabels[n.status]}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
