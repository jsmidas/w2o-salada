"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useCart } from "../../store/cart";

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const paymentKey = searchParams.get("paymentKey");
  const amount = searchParams.get("amount");
  const { clearCart, removeLines } = useCart();

  // 배송일별로 나눠 결제한 경우 이번에 결제한 라인만 지운다. 기록이 없으면(구버전 탭 등) 전체 비우기
  const clearPaidLines = () => {
    try {
      const raw = localStorage.getItem("w2o_paid_lines");
      localStorage.removeItem("w2o_paid_lines");
      const lines = raw ? (JSON.parse(raw) as { productId: string; deliveryDate?: string | null }[]) : null;
      if (Array.isArray(lines) && lines.length > 0) {
        removeLines(lines);
        return;
      }
    } catch {
      // 저장해 둔 결제 내역을 읽지 못하면 아래 기본 흐름으로 간다
    }
    clearCart();
  };

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [orderNo, setOrderNo] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const billing = searchParams.get("billing");
    const authKey = searchParams.get("authKey");
    const customerKey = searchParams.get("customerKey");
    const billingAmount = searchParams.get("amount");
    const billingOrderNo = searchParams.get("orderNo");
    const subscriptionId = searchParams.get("subscriptionId");

    // 빌링키 발급 성공 → 첫 결제 처리
    if (billing === "true" && authKey && customerKey) {
      const processBilling = async () => {
        try {
          const res = await fetch("/api/subscribe/billing", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              authKey,
              customerKey,
              orderId,
              amount: Number(billingAmount),
              orderNo: billingOrderNo,
              subscriptionId,
            }),
          });
          const data = await res.json();

          if (res.ok) {
            setStatus("success");
            setOrderNo(data.orderNo ?? null);
          } else {
            setStatus("error");
            setErrorMsg(data.error ?? "구독 결제에 실패했습니다.");
          }
        } catch {
          setStatus("error");
          setErrorMsg("구독 결제 처리 중 오류가 발생했습니다.");
        }
      };
      processBilling();
      return;
    }

    // 등록 카드로 서버에서 즉시 결제된 경우 — 승인 호출 없이 완료 처리
    if (searchParams.get("paid") === "saved") {
      setStatus("success");
      setOrderNo(searchParams.get("orderNo"));
      clearPaidLines();
      try {
        localStorage.removeItem("w2o_checkout_draft");
      } catch {
        // 임시 저장분을 지우지 못해도 결제 완료에는 지장이 없다
      }
      return;
    }

    if (!paymentKey || !orderId || !amount) {
      // 결제 파라미터 없이 직접 들어온 경우 — "주문 완료" 로 오해하지 않게 안내
      setStatus("error");
      setErrorMsg("결제 정보가 없습니다. 주문 내역은 마이페이지에서 확인해주세요.");
      return;
    }

    confirmPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 결제 승인 (네트워크/404/5xx 에러만 재시도, 4xx 비즈니스 에러는 즉시 실패)
  async function confirmPayment() {
    if (!paymentKey || !orderId || !amount) return;
    setStatus("loading");
    setRetrying(false);

    const delays = [0, 600, 1500, 3000]; // 총 4회 시도 (초회 + 3회 재시도)
    let lastErr = "결제 승인 중 오류가 발생했습니다.";

    for (let i = 0; i < delays.length; i++) {
      if (delays[i]! > 0) {
        setRetrying(true);
        await new Promise((r) => setTimeout(r, delays[i]!));
      }
      try {
        const res = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
        });

        // 200: 성공 (또는 멱등 응답 alreadyPaid=true)
        if (res.ok) {
          const data = await res.json();
          setStatus("success");
          setOrderNo(data.order?.orderNo ?? null);
          clearPaidLines();
          // 결제 성공했으니 입력 중이던 draft 제거
          try {
            localStorage.removeItem("w2o_checkout_draft");
          } catch {
            // 지우지 못해도 결제 완료에는 지장이 없다
          }
          return;
        }

        // 4xx: 비즈니스 에러 → 즉시 실패, 재시도하지 않음 (중복 결제 방지)
        if (res.status >= 400 && res.status < 500 && res.status !== 404) {
          const data = await res.json().catch(() => ({}));
          setStatus("error");
          setErrorMsg(data?.error ?? "결제 승인에 실패했습니다.");
          setRetrying(false);
          return;
        }

        // 404 / 5xx: 일시적 장애 → 재시도
        const data = await res.json().catch(() => ({}));
        lastErr = data?.error ?? `서버 응답 ${res.status}`;
      } catch (e) {
        // 네트워크 오류 → 재시도
        lastErr = e instanceof Error ? e.message : "네트워크 오류";
      }
    }

    // 모든 재시도 실패
    setStatus("error");
    setErrorMsg(lastErr);
    setRetrying(false);
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-brand-dark flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-brand-green border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">
            {retrying ? "일시적 장애로 재시도 중입니다…" : "결제를 확인하고 있습니다..."}
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-brand-dark flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-red-400 text-4xl">error</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">결제 승인 실패</h1>
          <p className="text-gray-400 mb-4">{errorMsg}</p>
          {/* 주문번호·결제키 — 수동 확인/고객센터 연락 시 필요 */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-6 text-xs text-left space-y-1">
            {orderId && (
              <div className="flex gap-2">
                <span className="text-gray-500 shrink-0">주문번호</span>
                <span className="text-white break-all">{orderId}</span>
              </div>
            )}
            {paymentKey && (
              <div className="flex gap-2">
                <span className="text-gray-500 shrink-0">결제키</span>
                <span className="text-white break-all">{paymentKey}</span>
              </div>
            )}
            <p className="text-gray-500 mt-2 pt-2 border-t border-white/10">
              결제는 완료되었으나 주문 상태 업데이트에 실패했을 수 있습니다. 재시도하거나 고객센터에 위 번호를 알려주세요.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={confirmPayment}
              className="w-full py-3 bg-brand-green text-white rounded-xl font-semibold hover:bg-brand-mint transition flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">refresh</span>
              결제 확인 재시도
            </button>
            <Link
              href="/cart"
              className="w-full py-3 border border-white/20 text-white rounded-xl font-semibold text-center hover:bg-white/5 transition"
            >
              장바구니로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-brand-green/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-brand-green text-4xl">check_circle</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">주문 완료!</h1>
        <p className="text-gray-400 mb-2">결제가 성공적으로 완료되었습니다.</p>
        {orderNo && (
          <p className="text-gray-500 text-sm mb-8">주문번호: {orderNo}</p>
        )}

        <div className="bg-white/5 rounded-xl p-5 border border-white/10 mb-8 text-left">
          <div className="flex items-center gap-3 text-sm">
            <span className="material-symbols-outlined text-brand-green">local_shipping</span>
            <span className="text-gray-300">내일 새벽 6시 전 문 앞에 도착합니다</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            href="/"
            className="flex-1 py-3 border border-white/20 text-white rounded-xl font-semibold text-center hover:bg-white/5 transition"
          >
            홈으로
          </Link>
          <Link
            href="/mypage"
            className="flex-1 py-3 bg-brand-green text-white rounded-xl font-semibold text-center hover:bg-brand-mint transition"
          >
            주문 내역
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-dark flex items-center justify-center text-gray-400">결제 확인 중...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
