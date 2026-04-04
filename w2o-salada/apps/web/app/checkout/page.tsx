"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "../store/cart";

declare global {
  interface Window {
    daum: { Postcode: new (opts: { oncomplete: (data: DaumAddr) => void }) => { open: () => void } };
  }
}
interface DaumAddr { address: string; zonecode: string; buildingName: string; }

const SAVED_ADDRESSES_KEY = "w2o_saved_addresses";
const MEMO_PRESETS = [
  "문 앞에 놓아주세요",
  "경비실에 맡겨주세요",
  "배송 전 연락 부탁드려요",
  "부재 시 문 앞에 놓아주세요",
  "벨 누르지 말아주세요",
  "직접 입력",
];

interface SavedAddress {
  id: string;
  label: string;
  name: string;
  phone: string;
  address1: string;
  address2: string;
}

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { items, totalPrice, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [address, setAddress] = useState({ name: "", phone: "", address1: "", address2: "", deliveryMemo: "" });
  const [memoOpen, setMemoOpen] = useState(false);
  const [customMemo, setCustomMemo] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [saveThisAddress, setSaveThisAddress] = useState(false);
  const [addressLabel, setAddressLabel] = useState("");

  const deliveryFee = totalPrice() >= 15000 ? 0 : 3000;
  const finalTotal = totalPrice() + deliveryFee;
  const inputCls = "w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-green text-sm transition";

  useEffect(() => { setMounted(true); }, []);

  // 저장된 배송지 불러오기
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_ADDRESSES_KEY);
      if (saved) setSavedAddresses(JSON.parse(saved));
    } catch {}
  }, []);

  // 다음 주소검색 스크립트 로드
  useEffect(() => {
    if (document.getElementById("daum-postcode")) return;
    const script = document.createElement("script");
    script.id = "daum-postcode";
    script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?redirect=/checkout");
  }, [status, router]);

  useEffect(() => {
    if (mounted && items.length === 0) router.push("/cart");
  }, [mounted, items, router]);

  const openAddressSearch = useCallback(() => {
    if (!window.daum) { alert("주소 검색을 불러오는 중입니다. 잠시 후 다시 시도해주세요."); return; }
    new window.daum.Postcode({
      oncomplete: (data: DaumAddr) => {
        const addr = data.buildingName ? `${data.address} (${data.buildingName})` : data.address;
        setAddress((prev) => ({ ...prev, address1: addr }));
        // 상세주소 input으로 포커스
        setTimeout(() => { document.getElementById("address2-input")?.focus(); }, 100);
      },
    }).open();
  }, []);

  const selectSavedAddress = (saved: SavedAddress) => {
    setAddress((prev) => ({ ...prev, name: saved.name, phone: saved.phone, address1: saved.address1, address2: saved.address2 }));
    setShowSaved(false);
  };

  const saveAddress = () => {
    if (!address.name || !address.address1) return;
    const newAddr: SavedAddress = {
      id: String(Date.now()),
      label: addressLabel || "배송지",
      name: address.name,
      phone: address.phone,
      address1: address.address1,
      address2: address.address2,
    };
    const updated = [...savedAddresses, newAddr];
    setSavedAddresses(updated);
    localStorage.setItem(SAVED_ADDRESSES_KEY, JSON.stringify(updated));
    setSaveThisAddress(false);
    setAddressLabel("");
  };

  const deleteSavedAddress = (id: string) => {
    const updated = savedAddresses.filter((a) => a.id !== id);
    setSavedAddresses(updated);
    localStorage.setItem(SAVED_ADDRESSES_KEY, JSON.stringify(updated));
  };

  const selectMemo = (memo: string) => {
    if (memo === "직접 입력") {
      setCustomMemo(true);
      setAddress((prev) => ({ ...prev, deliveryMemo: "" }));
    } else {
      setCustomMemo(false);
      setAddress((prev) => ({ ...prev, deliveryMemo: memo }));
    }
    setMemoOpen(false);
  };

  const handleOrder = async () => {
    if (!session?.user) return;
    if (!address.name || !address.phone || !address.address1) {
      alert("수령인, 전화번호, 주소를 입력해주세요.");
      return;
    }
    setLoading(true);

    // 배송지 저장 체크됐으면 저장
    if (saveThisAddress) saveAddress();

    const orderRes = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: (session.user as { id?: string }).id,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      }),
    });
    const order = await orderRes.json();
    if (!orderRes.ok) { alert("주문 생성에 실패했습니다."); setLoading(false); return; }

    const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
    if (!TOSS_CLIENT_KEY) { alert("결제 키가 설정되지 않았습니다."); setLoading(false); return; }

    try {
      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      const userId = (session.user as { id?: string }).id ?? "guest";
      const payment = tossPayments.payment({ customerKey: userId });
      const orderName = items.length > 1 ? `${items[0]!.name} 외 ${items.length - 1}건` : items[0]!.name;

      await payment.requestPayment({
        method: "CARD",
        amount: { value: finalTotal, currency: "KRW" },
        orderId: order.orderNo,
        orderName,
        customerName: address.name || session.user?.name || "고객",
        successUrl: `${window.location.origin}/checkout/success?orderId=${order.id}`,
        failUrl: `${window.location.origin}/checkout/fail?orderId=${order.id}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "결제 중 오류가 발생했습니다.";
      if (msg !== "사용자가 결제를 취소했습니다.") alert(msg);
      setLoading(false);
    }
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-brand-dark">
      <header className="sticky top-0 z-50 bg-brand-deep/95 backdrop-blur border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/cart" className="text-white/70 hover:text-white flex items-center gap-1">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="text-white font-bold">주문하기</h1>
          <div className="w-8" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* 배송지 정보 */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold">배송지 정보</h3>
            {savedAddresses.length > 0 && (
              <button onClick={() => setShowSaved(!showSaved)} className="text-brand-green text-sm font-medium hover:underline">
                {showSaved ? "닫기" : "저장된 배송지"}
              </button>
            )}
          </div>

          {/* 저장된 배송지 목록 */}
          {showSaved && (
            <div className="mb-4 space-y-2">
              {savedAddresses.map((s) => (
                <div key={s.id} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3 border border-white/10">
                  <button onClick={() => selectSavedAddress(s)} className="text-left flex-1">
                    <span className="text-brand-green text-xs font-bold">{s.label}</span>
                    <p className="text-white text-sm">{s.name} · {s.phone}</p>
                    <p className="text-gray-400 text-xs">{s.address1} {s.address2}</p>
                  </button>
                  <button onClick={() => deleteSavedAddress(s.id)} className="text-gray-500 hover:text-red-400 ml-2">
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="수령인" value={address.name} onChange={(e) => setAddress({ ...address, name: e.target.value })} className={inputCls} />
              <input type="tel" placeholder="전화번호" value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} className={inputCls} />
            </div>

            {/* 주소 검색 */}
            <div className="flex gap-2">
              <input type="text" placeholder="주소를 검색하세요" value={address.address1} readOnly onClick={openAddressSearch} className={`${inputCls} cursor-pointer flex-1`} />
              <button onClick={openAddressSearch} className="px-4 py-3 bg-brand-green text-white rounded-xl text-sm font-semibold hover:bg-brand-mint transition shrink-0">
                주소 검색
              </button>
            </div>

            <input id="address2-input" type="text" placeholder="상세주소 (동/호수)" value={address.address2} onChange={(e) => setAddress({ ...address, address2: e.target.value })} className={inputCls} />

            {/* 배송 메모 */}
            <div className="relative">
              <button
                onClick={() => setMemoOpen(!memoOpen)}
                className={`${inputCls} text-left flex items-center justify-between cursor-pointer`}
              >
                <span className={address.deliveryMemo ? "text-white" : "text-gray-500"}>
                  {address.deliveryMemo || "배송 메모를 선택하세요"}
                </span>
                <span className="material-symbols-outlined text-gray-500 text-lg">expand_more</span>
              </button>
              {memoOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-[#1a2a1f] border border-white/10 rounded-xl overflow-hidden z-10 shadow-xl">
                  {MEMO_PRESETS.map((memo) => (
                    <button key={memo} onClick={() => selectMemo(memo)} className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition">
                      {memo}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {customMemo && (
              <input type="text" placeholder="배송 메모를 입력하세요" value={address.deliveryMemo} onChange={(e) => setAddress({ ...address, deliveryMemo: e.target.value })} className={inputCls} autoFocus />
            )}

            {/* 배송지 저장 */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={saveThisAddress} onChange={(e) => setSaveThisAddress(e.target.checked)} className="w-4 h-4 rounded border-white/20 bg-white/5 text-brand-green focus:ring-brand-green/25" />
                <span className="text-sm text-gray-400">이 배송지 저장</span>
              </label>
              {saveThisAddress && (
                <input type="text" placeholder="배송지 이름 (예: 집, 회사)" value={addressLabel} onChange={(e) => setAddressLabel(e.target.value)} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 text-xs w-40 focus:outline-none focus:border-brand-green" />
              )}
            </div>
          </div>
        </div>

        {/* 주문 상품 */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10 mb-6">
          <h3 className="text-white font-bold mb-4">주문 상품</h3>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.productId} className="flex justify-between items-center">
                <div>
                  <p className="text-white text-sm">{item.name}</p>
                  <p className="text-gray-500 text-xs">수량: {item.quantity}</p>
                </div>
                <p className="text-white text-sm font-medium">{(item.price * item.quantity).toLocaleString()}원</p>
              </div>
            ))}
          </div>
        </div>

        {/* 결제 요약 */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h3 className="text-white font-bold mb-4">결제 요약</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">상품 금액</span>
              <span className="text-white">{totalPrice().toLocaleString()}원</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">배송비</span>
              <span className={deliveryFee === 0 ? "text-brand-green" : "text-white"}>
                {deliveryFee === 0 ? "무료" : `${deliveryFee.toLocaleString()}원`}
              </span>
            </div>
            <div className="pt-3 border-t border-white/10 flex justify-between">
              <span className="text-white font-bold">총 결제 금액</span>
              <span className="text-brand-amber text-xl font-black">{finalTotal.toLocaleString()}원</span>
            </div>
          </div>

          <button onClick={handleOrder} disabled={loading || !address.name || !address.address1}
            className="w-full mt-6 py-4 bg-brand-amber text-white rounded-xl font-bold text-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? "처리 중..." : `${finalTotal.toLocaleString()}원 결제하기`}
          </button>
        </div>
      </div>
    </div>
  );
}
