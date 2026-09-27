"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type SubItem = {
  id: string;
  quantity: number;
  dayOfWeek: number | null;
  product: { name: string; imageUrl: string | null };
};

type Subscription = {
  id: string;
  planType: string;
  frequency: string;
  status: string;
  price: number;
  nextBillingDate: string | null;
  nextDeliveryDate: string | null;
  startedAt: string | null;
  pausedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  items: SubItem[];
  address: SubAddress | null;
  creditBalance: number;
  pauseMode: "CREDIT" | "EXTEND" | null;
  settlement?: { remainingCount: number; remainingAmount: number; creditBalance: number; feePercent: number };
  refundRequests?: { id: string; kind: string; status: string; requestedAmount: number; feeAmount: number; refundAmount: number | null; createdAt: string; processedAt: string | null; adminNote: string | null }[];
};

const REFUND_REASONS: [string, string][] = [
  ["TASTE", "맛·품질이 기대와 달라요"],
  ["DELIVERY", "배송 시간·상태가 불편해요"],
  ["PRICE", "가격이 부담돼요"],
  ["PERSONAL", "이사·여행 등 개인 사정"],
  ["HEALTH", "건강·식단이 바뀌었어요"],
  ["COMPETITOR", "다른 서비스를 이용하려고요"],
  ["OTHER", "기타"],
];
const REFUND_STATUS: Record<string, string> = { PENDING: "검토 중", APPROVED: "승인", REJECTED: "거절", COMPLETED: "환불 완료" };

type SubAddress = {
  id: string;
  label: string | null;
  name: string;
  phone: string;
  zipCode: string;
  address1: string;
  address2: string | null;
  buildingName: string | null;
  areaStatus: "UNKNOWN" | "IN_RANGE" | "OUT_OF_RANGE";
  distanceKm: number | null;
  dropLocation: string;
  entranceMethod: string | null;
  floor: string | null;
};

const DROP_LABEL: Record<string, string> = { DOOR: "문 앞", SECURITY_OFFICE: "경비실", PARCEL_BOX: "택배함", OTHER: "기타" };

function addressLine(a: SubAddress) {
  const b = a.buildingName && !a.address1.includes(a.buildingName) ? ` (${a.buildingName})` : "";
  return `${a.address1}${b} ${a.address2 ?? ""}`.trim();
}

const planLabels: Record<string, string> = {
  LIGHT: "라이트",
  REGULAR: "레귤러",
  PREMIUM: "프리미엄",
};

const frequencyLabels: Record<string, string> = {
  WEEKLY: "주간",
  BIWEEKLY: "격주",
  MONTHLY: "월간",
};

const statusLabels: Record<string, string> = {
  PENDING: "결제 대기",
  ACTIVE: "이용 중",
  PAUSED: "일시정지",
  CANCELLED: "해지",
};

const statusColors: Record<string, string> = {
  PENDING: "text-gray-400 bg-gray-500/10",
  ACTIVE: "text-brand-green bg-brand-green/10",
  PAUSED: "text-amber-400 bg-amber-500/10",
  CANCELLED: "text-gray-500 bg-gray-500/10",
};

const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];

export default function SubscriptionDetailPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const subId = params?.id as string;

  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  // 배송지 변경 — 저장된 배송지 중에서 고른다 (새 주소는 배송지 관리에서 추가)
  const [pickingAddress, setPickingAddress] = useState(false);
  const [myAddresses, setMyAddresses] = useState<SubAddress[]>([]);

  const openAddressPicker = async () => {
    setPickingAddress(true);
    try {
      const r = await fetch("/api/addresses");
      const list = r.ok ? await r.json() : [];
      setMyAddresses(Array.isArray(list) ? list : []);
    } catch {
      setMyAddresses([]);
    }
  };

  const changeAddress = async (addressId: string) => {
    if (!sub || addressId === sub.address?.id) { setPickingAddress(false); return; }
    setActing(true);
    try {
      const res = await fetch(`/api/subscriptions/${subId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressId }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? "변경에 실패했습니다."); return; }
      setPickingAddress(false);
      if (data.movedOrders > 0) alert(`배송지를 바꿨습니다. 배송 전인 주문 ${data.movedOrders}건도 새 배송지로 갑니다.`);
      loadSubscription();
    } finally {
      setActing(false);
    }
  };

  const loadSubscription = useCallback(() => {
    fetch(`/api/subscriptions/${subId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setSub(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [subId]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push(`/login?redirect=/mypage/subscription/${subId}`);
      return;
    }
    if (authStatus === "authenticated") loadSubscription();
  }, [authStatus, router, subId, loadSubscription]);

  const handleAction = async (
    action: "pause" | "resume" | "cancel",
    confirmMessage?: string,
  ) => {
    if (confirmMessage && !confirm(confirmMessage)) return;
    setActing(true);
    try {
      const res = await fetch(`/api/subscriptions/${subId}/${action}`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "처리에 실패했습니다.");
        return;
      }
      loadSubscription();
    } finally {
      setActing(false);
    }
  };

  // 일시정지 방식 선택 · 해지 사유 입력
  const [pauseOpen, setPauseOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelDetail, setCancelDetail] = useState("");
  const settlement = sub?.settlement;

  const submitPause = async (mode: "CREDIT" | "EXTEND") => {
    setActing(true);
    try {
      const res = await fetch(`/api/subscriptions/${subId}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data.error ?? "처리에 실패했습니다."); return; }
      setPauseOpen(false);
      if (data.message) alert(data.message);
      loadSubscription();
    } finally {
      setActing(false);
    }
  };

  const submitCancel = async () => {
    if (!cancelReason) { alert("해지 사유를 선택해주세요."); return; }
    if (!confirm("정말 구독을 해지하시겠습니까?\n해지 후에는 복구할 수 없습니다.")) return;
    setActing(true);
    try {
      const res = await fetch(`/api/subscriptions/${subId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason, reasonDetail: cancelDetail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data.error ?? "처리에 실패했습니다."); return; }
      setCancelOpen(false);
      if (data.message) alert(data.message);
      loadSubscription();
    } finally {
      setActing(false);
    }
  };

  if (authStatus === "loading" || !session) return null;

  return (
    <div className="min-h-screen bg-brand-dark">
      <header className="sticky top-0 z-50 bg-brand-deep/95 backdrop-blur border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/mypage/subscription"
            className="flex items-center gap-1 text-gray-400 hover:text-white transition"
          >
            <span className="material-symbols-outlined text-xl">chevron_left</span>
            <span className="text-sm">구독 목록</span>
          </Link>
          <h1 className="text-white font-bold">구독 상세</h1>
          <div className="w-20" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {loading ? (
          <p className="text-gray-400 text-center py-12">로딩 중...</p>
        ) : !sub ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">구독을 찾을 수 없습니다.</p>
            <Link
              href="/mypage/subscription"
              className="inline-block px-6 py-2.5 bg-brand-green text-white rounded-full font-semibold text-sm hover:bg-brand-mint transition"
            >
              구독 목록으로
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 구독 요약 */}
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-white font-bold text-xl">
                    {planLabels[sub.planType] ?? sub.planType} /{" "}
                    {frequencyLabels[sub.frequency] ?? sub.frequency}
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    {sub.price.toLocaleString()}원 /{" "}
                    {frequencyLabels[sub.frequency] ?? sub.frequency}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    statusColors[sub.status] ?? "text-gray-400 bg-gray-500/10"
                  }`}
                >
                  {statusLabels[sub.status] ?? sub.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
                <div>
                  <p className="text-gray-500 text-xs mb-1">시작일</p>
                  <p className="text-white text-sm">
                    {sub.startedAt
                      ? new Date(sub.startedAt).toLocaleDateString("ko-KR")
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">다음 결제일</p>
                  <p className="text-white text-sm">
                    {sub.nextBillingDate
                      ? new Date(sub.nextBillingDate).toLocaleDateString("ko-KR")
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">다음 배송일</p>
                  <p className="text-white text-sm">
                    {sub.nextDeliveryDate
                      ? new Date(sub.nextDeliveryDate).toLocaleDateString("ko-KR", {
                          month: "long",
                          day: "numeric",
                          weekday: "short",
                        })
                      : "-"}
                  </p>
                </div>
                {sub.pausedAt && (
                  <div>
                    <p className="text-gray-500 text-xs mb-1">일시정지일</p>
                    <p className="text-amber-400 text-sm">
                      {new Date(sub.pausedAt).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                )}
                {sub.cancelledAt && (
                  <div>
                    <p className="text-gray-500 text-xs mb-1">해지일</p>
                    <p className="text-gray-400 text-sm">
                      {new Date(sub.cancelledAt).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 배송지 — 구독마다 고정. 부모님 댁 등 다른 곳으로 옮길 수 있다 */}
            <div className="bg-white/5 rounded-xl p-5 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white font-bold">배송지</h2>
                {sub.status !== "CANCELLED" && !pickingAddress && (
                  <button type="button" onClick={openAddressPicker} className="text-xs text-brand-green hover:underline">
                    배송지 변경
                  </button>
                )}
              </div>
              {sub.address ? (
                <div className="text-sm">
                  <p className="text-white font-semibold">
                    {sub.address.label && <span className="text-brand-green mr-1">[{sub.address.label}]</span>}
                    {sub.address.name} <span className="text-gray-400 font-normal">· {sub.address.phone}</span>
                  </p>
                  <p className="text-gray-300 mt-0.5">({sub.address.zipCode}) {addressLine(sub.address)}</p>
                  <p className="text-gray-500 text-xs mt-1">
                    {DROP_LABEL[sub.address.dropLocation] ?? "문 앞"}
                    {sub.address.floor && ` · ${sub.address.floor}`}
                    {sub.address.entranceMethod && ` · ${sub.address.entranceMethod}`}
                    {sub.address.areaStatus === "OUT_OF_RANGE" && <span className="text-amber-400"> · 배송 권역 밖, 담당자 확인 중</span>}
                    {sub.address.areaStatus === "UNKNOWN" && <span className="text-gray-400"> · 위치 확인 중</span>}
                  </p>
                </div>
              ) : (
                <p className="text-amber-400 text-sm">배송지가 지정되지 않았습니다. 배송지를 선택해주세요.</p>
              )}

              {pickingAddress && (
                <div className="mt-3 space-y-2">
                  {myAddresses.length === 0 ? (
                    <p className="text-gray-500 text-xs">저장된 배송지가 없습니다.</p>
                  ) : (
                    myAddresses.map((a) => {
                      const current = a.id === sub.address?.id;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          disabled={acting || current}
                          onClick={() => changeAddress(a.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition ${
                            current ? "border-brand-green bg-brand-green/10 cursor-default" : "border-white/10 hover:border-brand-green/60"
                          }`}
                        >
                          <span className="text-white font-medium">{a.label || a.name}</span>
                          {a.label && <span className="text-gray-400"> · {a.name}</span>}
                          {current && <span className="text-[10px] text-brand-green ml-2">현재</span>}
                          <span className="block text-gray-400 text-xs">{addressLine(a)}</span>
                        </button>
                      );
                    })
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <Link href="/mypage/addresses" className="text-xs text-gray-400 hover:text-white">
                      + 새 배송지는 배송지 관리에서 추가
                    </Link>
                    <button type="button" onClick={() => setPickingAddress(false)} className="text-xs text-gray-400 hover:text-white">
                      닫기
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 구독 메뉴 */}
            {sub.items.length > 0 && (
              <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                <h2 className="text-white font-bold mb-4">구독 메뉴</h2>
                <div className="space-y-3">
                  {sub.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {item.product.imageUrl ? (
                          <img
                            src={item.product.imageUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="material-symbols-outlined text-white/10">
                            lunch_dining
                          </span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">
                          {item.product.name}
                        </p>
                        <p className="text-gray-500 text-xs mt-0.5">
                          {item.dayOfWeek !== null
                            ? `${dayLabels[item.dayOfWeek]}요일 `
                            : ""}
                          · {item.quantity}개
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sub.refundRequests && sub.refundRequests.length > 0 && (
              <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                <h2 className="text-white font-bold mb-3">환불 신청 현황</h2>
                <div className="space-y-2">
                  {sub.refundRequests.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="text-gray-300">{new Date(r.createdAt).toLocaleDateString("ko-KR")} · 신청 {r.requestedAmount.toLocaleString()}원</p>
                        {r.status === "COMPLETED" && r.refundAmount !== null && (
                          <p className="text-xs text-gray-500">수수료 {r.feeAmount.toLocaleString()}원 차감 → {r.refundAmount.toLocaleString()}원 환불</p>
                        )}
                        {r.status === "REJECTED" && r.adminNote && <p className="text-xs text-gray-500">{r.adminNote}</p>}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${r.status === "COMPLETED" ? "text-brand-green bg-brand-green/10" : r.status === "REJECTED" ? "text-gray-400 bg-gray-500/10" : "text-amber-400 bg-amber-500/10"}`}>
                        {REFUND_STATUS[r.status] ?? r.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 액션 버튼 */}
            {sub.status !== "CANCELLED" && (
              <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                <h2 className="text-white font-bold mb-4">구독 관리</h2>
                {(sub.creditBalance > 0 || (settlement && settlement.remainingCount > 0)) && (
                  <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 space-y-1">
                    {settlement && settlement.remainingCount > 0 && (
                      <p>결제된 남은 배송 <b className="text-white">{settlement.remainingCount}회</b> · {settlement.remainingAmount.toLocaleString()}원</p>
                    )}
                    {sub.creditBalance > 0 && (
                      <p>보유 크레딧 <b className="text-[#5DCAA5]">{sub.creditBalance.toLocaleString()}원</b> — 다음 결제에서 자동 차감됩니다</p>
                    )}
                    {sub.status === "PAUSED" && sub.pauseMode === "EXTEND" && (
                      <p className="text-amber-300">주기 연장으로 정지 중 — 재개하면 놓친 배송을 이어서 받습니다</p>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  {sub.status === "ACTIVE" && (
                    <button
                      type="button"
                      onClick={() => setPauseOpen(true)}
                      disabled={acting}
                      className="w-full py-3 border border-white/10 text-white rounded-lg hover:border-amber-500/50 hover:bg-amber-500/10 transition text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">pause_circle</span>
                      일시정지
                    </button>
                  )}
                  {sub.status === "PAUSED" && (
                    <button
                      type="button"
                      onClick={() => handleAction("resume")}
                      disabled={acting}
                      className="w-full py-3 bg-brand-green text-white rounded-lg hover:bg-brand-mint transition text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">play_circle</span>
                      구독 재개
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setCancelReason(""); setCancelDetail(""); setCancelOpen(true); }}
                    disabled={acting}
                    className="w-full py-3 border border-white/10 text-gray-400 rounded-lg hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10 transition text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base">cancel</span>
                    구독 해지
                  </button>
                </div>
                <p className="text-gray-600 text-xs mt-4 leading-relaxed">
                  · 일시정지 중에는 결제와 배송이 이루어지지 않습니다. 결제된 남은 배송분은 크레딧 적립 또는 주기 연장 중 고를 수 있습니다.
                  <br />· 해지 시 남은 배송분과 크레딧은 환불 신청으로 접수되며, 담당자 검토 후 약관에 따른 수수료를 뺀 금액이 환불됩니다.
                  <br />· 카드 변경은 준비 중입니다.
                </p>
              </div>
            )}
          </div>
        )}

      {/* 일시정지 — 정산 방식 선택 */}
      {pauseOpen && sub && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-brand-deep border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-white font-bold text-lg mb-1">구독 일시정지</h3>
            <p className="text-gray-400 text-sm mb-4">정지 중에는 결제와 배송이 멈춥니다. 결제된 남은 배송분을 어떻게 할지 골라주세요.</p>
            {settlement && settlement.remainingCount > 0 ? (
              <p className="text-sm text-gray-300 mb-4">결제된 남은 배송 <b className="text-white">{settlement.remainingCount}회</b> · {settlement.remainingAmount.toLocaleString()}원</p>
            ) : (
              <p className="text-sm text-gray-500 mb-4">결제된 남은 배송분이 없어 정산 없이 정지됩니다.</p>
            )}
            <div className="space-y-2">
              <button type="button" disabled={acting} onClick={() => submitPause("CREDIT")} className="w-full text-left p-4 rounded-xl border border-white/10 hover:border-brand-green/60 hover:bg-brand-green/10 transition disabled:opacity-50">
                <p className="text-white font-semibold text-sm">크레딧으로 적립</p>
                <p className="text-gray-400 text-xs mt-1">남은 배송분 금액을 크레딧으로 두고, 재개 후 다음 결제에서 그만큼 뺍니다.</p>
              </button>
              <button type="button" disabled={acting} onClick={() => submitPause("EXTEND")} className="w-full text-left p-4 rounded-xl border border-white/10 hover:border-amber-400/60 hover:bg-amber-500/10 transition disabled:opacity-50">
                <p className="text-white font-semibold text-sm">주기 연장</p>
                <p className="text-gray-400 text-xs mt-1">남은 배송을 그대로 두고, 재개하면 놓친 횟수만큼 배송일을 뒤로 이어 붙입니다. 다음 결제일도 그만큼 미뤄집니다.</p>
              </button>
            </div>
            <button type="button" onClick={() => setPauseOpen(false)} className="w-full mt-4 py-2.5 text-gray-400 text-sm hover:text-white transition">취소</button>
          </div>
        </div>
      )}

      {/* 해지 — 사유 입력 + 환불 신청 안내 */}
      {cancelOpen && sub && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-brand-deep border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-white font-bold text-lg mb-1">구독 해지</h3>
            <p className="text-gray-400 text-sm mb-4">더 나은 서비스를 위해 해지 사유를 알려주세요.</p>
            <div className="space-y-1.5 mb-4">
              {REFUND_REASONS.map(([v, l]) => (
                <label key={v} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition text-sm ${cancelReason === v ? "border-brand-green bg-brand-green/10 text-white" : "border-white/10 text-gray-300 hover:border-white/30"}`}>
                  <input type="radio" name="cancel-reason" value={v} checked={cancelReason === v} onChange={() => setCancelReason(v)} className="accent-[#1D9E75]" />
                  {l}
                </label>
              ))}
            </div>
            <textarea value={cancelDetail} onChange={(e) => setCancelDetail(e.target.value)} rows={3} maxLength={500} placeholder="자세한 내용을 적어주시면 큰 도움이 됩니다 (선택)" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-brand-green mb-4" />
            {settlement && (settlement.remainingAmount + sub.creditBalance) > 0 ? (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 mb-4 leading-relaxed">
                결제된 남은 배송 {settlement.remainingCount}회분 {settlement.remainingAmount.toLocaleString()}원{sub.creditBalance > 0 ? ` + 크레딧 ${sub.creditBalance.toLocaleString()}원` : ""} = <b>{(settlement.remainingAmount + sub.creditBalance).toLocaleString()}원</b>이 환불 신청으로 접수됩니다.
                담당자 검토 후 약관에 따른 취소 수수료 {settlement.feePercent}%({Math.round(((settlement.remainingAmount + sub.creditBalance) * settlement.feePercent) / 100).toLocaleString()}원)를 뺀
                약 <b>{((settlement.remainingAmount + sub.creditBalance) - Math.round(((settlement.remainingAmount + sub.creditBalance) * settlement.feePercent) / 100)).toLocaleString()}원</b>이 결제 수단으로 환불됩니다.
                <a href="/terms/subscription" target="_blank" rel="noopener noreferrer" className="underline ml-1">약관 보기</a>
              </div>
            ) : (
              <p className="text-xs text-gray-500 mb-4">환불 대상 금액은 없습니다.</p>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => setCancelOpen(false)} className="flex-1 py-2.5 border border-white/10 text-gray-300 rounded-lg text-sm hover:bg-white/5 transition">돌아가기</button>
              <button type="button" disabled={acting || !cancelReason} onClick={submitCancel} className="flex-1 py-2.5 bg-red-500/80 text-white rounded-lg text-sm font-semibold hover:bg-red-500 transition disabled:opacity-50">해지하기</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
