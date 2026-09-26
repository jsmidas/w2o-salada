"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Subscription = {
  id: string;
  selectionMode: string;
  itemsPerDelivery: number;
  status: string;
  price: number;
  nextBillingDate: string | null;
  nextDeliveryDate: string | null;
  startedAt: string | null;
  pausedAt: string | null;
  address: {
    id: string; label: string | null; name: string; phone: string; address1: string; address2: string | null;
    buildingName: string | null; areaStatus: "UNKNOWN" | "IN_RANGE" | "OUT_OF_RANGE";
  } | null;
  periods: {
    id: string;
    year: number;
    month: number;
    status: string;
    totalAmount: number;
    paidAt: string | null;
  }[];
};

const statusLabels: Record<string, string> = {
  PENDING: "결제 대기",
  ACTIVE: "이용 중",
  PAUSED: "일시정지",
  CANCELLED: "해지",
};

const statusColors: Record<string, string> = {
  PENDING: "text-gray-400 bg-gray-400/10",
  ACTIVE: "text-[#1D9E75] bg-[#1D9E75]/10",
  PAUSED: "text-amber-500 bg-amber-500/10",
  CANCELLED: "text-gray-500 bg-gray-500/10",
};

const modeLabels: Record<string, string> = {
  MANUAL: "맞춤 정기구독",
  AUTO: "알아서 정기구독",
};

export default function SubscriptionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?redirect=/mypage/subscription");
      return;
    }
    if (status !== "authenticated") return;

    fetch("/api/subscriptions")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setSubs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, router]);

  if (status === "loading" || !session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f7fdf9] to-[#edf7f0]">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#1D9E75]/10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/mypage" className="flex items-center gap-1 text-[#7aaa90] hover:text-[#1D9E75] transition">
            <span className="material-symbols-outlined text-xl">chevron_left</span>
            <span className="text-sm">마이페이지</span>
          </Link>
          <h1 className="text-[#0A1A0F] font-bold">구독 관리</h1>
          <div className="w-20" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-3 border-[#1D9E75] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : subs.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl text-[#1D9E75]/15 block mb-3">autorenew</span>
            <p className="text-[#4a7a5e] mb-2">진행 중인 구독이 없습니다.</p>
            <p className="text-[#7aaa90] text-xs mb-5">정기구독으로 매주 신선한 샐러드를 받아보세요.</p>
            <Link href="/subscribe" className="inline-block px-6 py-2.5 bg-[#1D9E75] text-white rounded-full font-semibold text-sm hover:bg-[#167A5B] transition">
              구독 시작하기
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {subs.map((sub) => (
              <div key={sub.id} className="bg-white rounded-2xl border border-[#1D9E75]/10 overflow-hidden">
                {/* 헤더 */}
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${statusColors[sub.status] ?? "text-gray-400 bg-gray-100"}`}>
                          {statusLabels[sub.status] ?? sub.status}
                        </span>
                        <span className="text-xs text-[#7aaa90]">
                          {modeLabels[sub.selectionMode] ?? sub.selectionMode}
                        </span>
                      </div>
                      <p className="text-[#0A1A0F] font-bold text-lg">
                        월 {sub.price.toLocaleString()}원
                      </p>
                      <p className="text-[#7aaa90] text-xs">
                        배송당 {sub.itemsPerDelivery}개
                      </p>
                      {/* 배송지 — 구독이 여러 개일 때 어디로 가는 구독인지 구분 */}
                      <p className="text-xs mt-1.5 flex items-start gap-1">
                        <span className="material-symbols-outlined text-sm text-[#1D9E75] mt-px">location_on</span>
                        {sub.address ? (
                          <span className="text-gray-600">
                            <b className="text-[#0A1A0F]">{sub.address.label || sub.address.name}</b>
                            {sub.address.label && <span className="text-gray-400"> · {sub.address.name}</span>}
                            <span className="block text-gray-400 truncate max-w-[16rem]">
                              {sub.address.address1}{sub.address.buildingName && !sub.address.address1.includes(sub.address.buildingName) ? ` (${sub.address.buildingName})` : ""} {sub.address.address2}
                            </span>
                            {sub.address.areaStatus === "OUT_OF_RANGE" && <span className="text-amber-600">배송 권역 밖 · 확인 중</span>}
                          </span>
                        ) : (
                          <span className="text-amber-600">배송지 미지정 — 상세에서 지정해주세요</span>
                        )}
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-[#1D9E75] text-2xl">
                      {sub.selectionMode === "AUTO" ? "auto_awesome" : "restaurant_menu"}
                    </span>
                  </div>

                  {/* 다음 결제/배송 */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {sub.nextBillingDate && sub.status === "ACTIVE" && (
                      <div className="bg-[#f0faf4] rounded-xl p-3">
                        <p className="text-[#7aaa90] text-[10px] mb-0.5">다음 결제</p>
                        <p className="text-[#0A1A0F] text-sm font-semibold">
                          {new Date(sub.nextBillingDate).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
                        </p>
                      </div>
                    )}
                    {sub.nextDeliveryDate && sub.status === "ACTIVE" && (
                      <div className="bg-[#f0faf4] rounded-xl p-3">
                        <p className="text-[#7aaa90] text-[10px] mb-0.5">다음 배송</p>
                        <p className="text-[#0A1A0F] text-sm font-semibold">
                          {new Date(sub.nextDeliveryDate).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 결제 이력 */}
                  {sub.periods.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[#7aaa90] text-xs mb-2">결제 이력</p>
                      <div className="space-y-1.5">
                        {sub.periods.slice(0, 3).map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-sm">
                            <span className="text-[#4a7a5e]">{p.year}년 {p.month}월</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[#0A1A0F] font-medium">{p.totalAmount.toLocaleString()}원</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                p.status === "PAID" ? "bg-[#1D9E75]/10 text-[#1D9E75]" :
                                p.status === "COMPLETED" ? "bg-gray-100 text-gray-500" :
                                "bg-gray-100 text-gray-400"
                              }`}>
                                {p.status === "PAID" ? "결제완료" : p.status === "COMPLETED" ? "완료" : p.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 모드 전환 */}
                  {sub.status === "ACTIVE" && (
                    <div className="flex items-center justify-between mb-3 p-3 bg-[#f0faf4] rounded-xl">
                      <div>
                        <p className="text-[#0A1A0F] text-sm font-semibold">메뉴 선택 방식</p>
                        <p className="text-[#7aaa90] text-[11px] mt-0.5">
                          {sub.selectionMode === "AUTO"
                            ? "매주 알아서 배정 (원하면 미리보기에서 교체)"
                            : "매 배송 전 직접 선택 (D-3 알림톡)"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const next = sub.selectionMode === "AUTO" ? "MANUAL" : "AUTO";
                          const label = next === "AUTO" ? "알아서 정기구독" : "맞춤 정기구독";
                          if (!confirm(`${label}으로 전환할까요?`)) return;
                          const res = await fetch(`/api/subscriptions/${sub.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ selectionMode: next }),
                          });
                          if (res.ok) {
                            setSubs((prev) =>
                              prev.map((s) => (s.id === sub.id ? { ...s, selectionMode: next } : s)),
                            );
                          } else {
                            alert("전환에 실패했습니다. 잠시 후 다시 시도해주세요.");
                          }
                        }}
                        className="px-3 py-1.5 rounded-full bg-white border border-[#1D9E75]/30 text-[#1D9E75] text-xs font-semibold hover:bg-[#1D9E75]/5 transition"
                      >
                        {sub.selectionMode === "AUTO" ? "맞춤으로" : "알아서로"}
                      </button>
                    </div>
                  )}

                  {/* 액션 버튼 */}
                  <div className="flex gap-2 pt-3 border-t border-[#1D9E75]/10">
                    <Link
                      href={`/mypage/subscription/${sub.id}`}
                      className="flex-1 text-center text-sm text-[#1D9E75] font-medium border border-[#1D9E75]/20 hover:bg-[#1D9E75]/5 rounded-xl py-2.5 transition"
                    >
                      상세 관리
                    </Link>
                    {sub.status === "ACTIVE" && (
                      <Link
                        href={`/subscribe/next?subscriptionId=${sub.id}`}
                        className="flex-1 text-center text-sm text-white font-medium bg-[#1D9E75] hover:bg-[#167A5B] rounded-xl py-2.5 transition"
                      >
                        다음 배송 메뉴
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
