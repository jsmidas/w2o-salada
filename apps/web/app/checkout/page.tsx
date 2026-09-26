"use client";

import { useEffect, useState, useCallback } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "../store/cart";
import AreaCheckNotice from "../components/address/AreaCheckNotice";
import DeliveryDetailFields from "../components/address/DeliveryDetailFields";
import {
  emptyDeliveryDetails, formatAddressLine, loadDaumPostcode, openDaumPostcode,
  type DeliveryDetails, type DropLocationValue, type PickedAddress,
} from "../components/address/daum";

const SAVED_ADDRESSES_KEY = "w2o_saved_addresses";
const DRAFT_KEY = "w2o_checkout_draft";
const MEMO_PRESETS = [
  "문 앞에 놓아주세요",
  "경비실에 맡겨주세요",
  "배송 전 연락 부탁드려요",
  "부재 시 문 앞에 놓아주세요",
  "벨 누르지 말아주세요",
  "직접 입력",
];

/** 저장된 배송지 (DB 또는 비회원 localStorage) */
interface SavedAddress {
  id: string;
  dbId?: string;          // DB 배송지면 원본 id — 주문에 addressId 로 연결
  label: string;
  name: string;
  phone: string;
  zipCode?: string;
  address1: string;
  address2: string;
  source?: "local" | "db";
  isDefault?: boolean;
  picked?: PickedAddress | null;
  details?: DeliveryDetails;
  deliveryMemo?: string;
  areaStatus?: "UNKNOWN" | "IN_RANGE" | "OUT_OF_RANGE";
}

/** 입력 중인 배송지 */
type CheckoutAddress = {
  dbId: string | null;      // 저장된 배송지를 그대로 쓰는 경우
  name: string;
  phone: string;
  zipCode: string;
  address1: string;
  address2: string;
  deliveryMemo: string;
  picked: PickedAddress | null;  // 다음 API 원본 필드 (행정구역·단지명·아파트 여부)
  details: DeliveryDetails;      // 출입·수령 정보 — 배송지마다 다르다
};

const emptyAddress: CheckoutAddress = {
  dbId: null, name: "", phone: "", zipCode: "", address1: "", address2: "", deliveryMemo: "",
  picked: null, details: emptyDeliveryDetails,
};

type DbAddressRow = {
  id: string; label: string | null; name: string; phone: string; zipCode: string; address1: string; address2: string | null;
  isDefault: boolean; deliveryMemo: string | null; roadAddress: string | null; jibunAddress: string | null;
  sido: string | null; sigungu: string | null; bname: string | null; buildingName: string | null; isApartment: boolean;
  areaStatus: "UNKNOWN" | "IN_RANGE" | "OUT_OF_RANGE";
  entranceMethod: string | null; entrancePassword: string | null; floor: string | null; dropLocation: DropLocationValue; dropNote: string | null;
};

function dbRowToSaved(a: DbAddressRow): SavedAddress {
  return {
    id: `db-${a.id}`,
    dbId: a.id,
    label: a.label || (a.isDefault ? "기본 배송지" : "배송지"),
    name: a.name,
    phone: a.phone,
    zipCode: a.zipCode,
    address1: a.address1,
    address2: a.address2 ?? "",
    source: "db",
    isDefault: a.isDefault,
    areaStatus: a.areaStatus,
    deliveryMemo: a.deliveryMemo ?? "",
    picked: {
      zipCode: a.zipCode, address1: a.address1, roadAddress: a.roadAddress, jibunAddress: a.jibunAddress,
      sido: a.sido, sigungu: a.sigungu, bname: a.bname, buildingName: a.buildingName, isApartment: a.isApartment,
    },
    details: {
      label: a.label ?? "", entranceMethod: a.entranceMethod ?? "", entrancePassword: a.entrancePassword ?? "",
      floor: a.floor ?? "", dropLocation: a.dropLocation ?? "DOOR", dropNote: a.dropNote ?? "",
    },
  };
}

function savedToAddress(s: SavedAddress, prev: CheckoutAddress): CheckoutAddress {
  return {
    dbId: s.dbId ?? null,
    name: s.name,
    phone: s.phone,
    zipCode: s.zipCode ?? prev.zipCode,
    address1: s.address1,
    address2: s.address2,
    deliveryMemo: s.deliveryMemo || prev.deliveryMemo,
    picked: s.picked ?? (s.zipCode ? { zipCode: s.zipCode, address1: s.address1, roadAddress: null, jibunAddress: null, sido: null, sigungu: null, bname: null, buildingName: null, isApartment: false } : null),
    details: s.details ?? { ...emptyDeliveryDetails, label: s.source === "local" ? s.label : "" },
  };
}

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { items, totalPrice, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [address, setAddress] = useState<CheckoutAddress>(emptyAddress);
  const [memoOpen, setMemoOpen] = useState(false);
  const [customMemo, setCustomMemo] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [saveThisAddress, setSaveThisAddress] = useState(false);

  // 배송비 정책은 관리자 설정을 따른다 (현재 무료)
  const { data: feeSettings } = useSWR<{ deliveryFee: string; freeShippingMin: string }>(
    "/api/settings/public",
    (url: string) => fetch(url).then((r) => r.json()),
    { revalidateOnFocus: false },
  );
  const baseDeliveryFee = feeSettings ? Number(feeSettings.deliveryFee) : 0;
  const freeShippingMin = feeSettings ? Number(feeSettings.freeShippingMin) : 11000;
  const deliveryFee = totalPrice() >= freeShippingMin ? 0 : baseDeliveryFee;
  const finalTotal = totalPrice() + deliveryFee;
  const inputCls = "w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-green text-sm transition";

  useEffect(() => { setMounted(true); }, []);

  // 저장된 배송지 불러오기 — 로그인: DB Address + 회원 Profile + localStorage 병합, 게스트: localStorage만
  useEffect(() => {
    let cancelled = false;
    const readDraft = (): Partial<CheckoutAddress> | null => {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    };
    const fromDraft = (d: Partial<CheckoutAddress>): CheckoutAddress => ({
      ...emptyAddress,
      ...d,
      dbId: null,
      details: { ...emptyDeliveryDetails, ...(d.details ?? {}) },
    });
    const localList: SavedAddress[] = (() => {
      try {
        const saved = localStorage.getItem(SAVED_ADDRESSES_KEY);
        if (!saved) return [];
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed)
          ? parsed.map((a: SavedAddress) => ({ ...a, source: "local" as const }))
          : [];
      } catch {
        return [];
      }
    })();

    if (status !== "authenticated") {
      setSavedAddresses(localList);
      const draft = readDraft();
      if (draft && (draft.name || draft.address1)) {
        setAddress((prev) => (prev.name || prev.address1 ? prev : fromDraft(draft)));
      }
      return;
    }

    Promise.all([
      fetch("/api/addresses").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch("/api/user/profile").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([dbList, profile]) => {
      if (cancelled) return;

      const mapped: SavedAddress[] = (Array.isArray(dbList) ? dbList : []).map(dbRowToSaved);
      setSavedAddresses([...mapped, ...localList]);
      if (mapped.length > 0) setShowSaved(true);

      // 자동 프리필: 기본배송지 > 첫 DB 주소 > 입력 중이던 draft > 회원 프로필(name/phone만)
      setAddress((prev) => {
        if (prev.name || prev.address1) return prev;
        const defaultAddr = mapped.find((a) => a.isDefault) ?? mapped[0];
        if (defaultAddr) return savedToAddress(defaultAddr, prev);
        const draft = readDraft();
        if (draft && (draft.name || draft.address1)) return fromDraft(draft);
        if (profile && (profile.name || profile.phone)) {
          return { ...prev, name: profile.name ?? prev.name, phone: profile.phone ?? prev.phone };
        }
        return prev;
      });
    });

    return () => { cancelled = true; };
  }, [status]);

  useEffect(() => { loadDaumPostcode(); }, []);

  // 결제 승인 API 워밍업 — /api/payments 를 미리 컴파일 시켜 Toss 리턴 후 cold-compile 404 방지
  useEffect(() => {
    fetch("/api/payments", { method: "GET" }).catch(() => {});
  }, []);

  // 입력 중인 주소 draft 저장 — 결제 취소·이탈 후 재진입 시 그대로 복원되도록 (출입 비밀번호는 저장하지 않는다)
  useEffect(() => {
    if (!mounted) return;
    try {
      const hasContent = address.name || address.phone || address.address1 || address.address2;
      if (hasContent) {
        const { details, ...rest } = address;
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...rest, details: { ...details, entrancePassword: "" } }));
      }
    } catch {
      // localStorage 접근 실패 시 조용히 무시
    }
  }, [address, mounted]);

  useEffect(() => {
    if (mounted && items.length === 0) router.push("/cart");
  }, [mounted, items, router]);

  const openAddressSearch = useCallback(() => {
    const ok = openDaumPostcode((picked) => {
      // 새 주소를 고르면 저장된 배송지와의 연결은 끊는다 (새 배송지로 저장됨)
      setAddress((prev) => ({ ...prev, dbId: null, picked, address1: picked.address1, zipCode: picked.zipCode }));
      setTimeout(() => { document.getElementById("address2-input")?.focus(); }, 100);
    });
    if (!ok) alert("주소 검색을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
  }, []);

  const selectSavedAddress = (saved: SavedAddress) => {
    setAddress((prev) => savedToAddress(saved, prev));
    setShowSaved(false);
  };

  const saveAddressLocally = () => {
    if (!address.name || !address.address1) return;
    const newAddr: SavedAddress = {
      id: String(Date.now()),
      label: address.details.label || "배송지",
      name: address.name,
      phone: address.phone,
      zipCode: address.zipCode,
      address1: address.address1,
      address2: address.address2,
      picked: address.picked,
      details: { ...address.details, entrancePassword: "" },
      deliveryMemo: address.deliveryMemo,
    };
    const updated = [...savedAddresses, newAddr];
    setSavedAddresses(updated);
    localStorage.setItem(SAVED_ADDRESSES_KEY, JSON.stringify(updated.filter((a) => a.source !== "db")));
    setSaveThisAddress(false);
  };

  const deleteSavedAddress = (id: string) => {
    const updated = savedAddresses.filter((a) => a.id !== id);
    setSavedAddresses(updated);
    localStorage.setItem(SAVED_ADDRESSES_KEY, JSON.stringify(updated.filter((a) => a.source !== "db")));
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
    if (!address.name || !address.phone || !address.address1) {
      alert("수령인, 전화번호, 주소를 입력해주세요.");
      return;
    }
    if (!address.zipCode) {
      alert("주소 검색으로 주소를 다시 선택해주세요.");
      return;
    }
    setLoading(true);

    const userId = (session?.user as { id?: string })?.id ?? "guest";

    // 비회원: 브라우저에도 저장 (회원은 서버가 주문과 함께 배송지를 저장한다)
    if (saveThisAddress && userId === "guest") saveAddressLocally();

    // 저장된 배송지를 고른 상태에서 주소를 바꾸지 않았으면 addressId 로, 아니면 입력값 전체로
    const savedRow = address.dbId ? savedAddresses.find((s) => s.dbId === address.dbId) : null;
    const unchanged = savedRow && savedRow.address1 === address.address1 && (savedRow.address2 ?? "") === address.address2;
    const addressPayload = unchanged
      ? { addressId: address.dbId }
      : {
          address: {
            name: address.name,
            phone: address.phone,
            zipCode: address.zipCode,
            address1: address.address1,
            address2: address.address2 || null,
            deliveryMemo: address.deliveryMemo || null,
            ...(address.picked ?? {}),
            ...address.details,
          },
        };

    const orderRes = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        ...addressPayload,
      }),
    });
    const order = await orderRes.json();
    if (!orderRes.ok) {
      alert(order?.message ?? order?.error ?? "주문 생성에 실패했습니다.");
      setLoading(false);
      return;
    }

    // 서버가 계산한 금액을 사용 (위변조 방지)
    const payAmount: number = order.totalAmount ?? finalTotal;

    const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
    if (!TOSS_CLIENT_KEY) { alert("결제 키가 설정되지 않았습니다."); setLoading(false); return; }

    try {
      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      const customerKey = userId !== "guest" ? userId : `GUEST_${Date.now()}`;
      const payment = tossPayments.payment({ customerKey });
      const orderName = items.length > 1 ? `${items[0]!.name} 외 ${items.length - 1}건` : items[0]!.name;

      await payment.requestPayment({
        method: "CARD",
        amount: { value: payAmount, currency: "KRW" },
        orderId: order.orderNo,
        orderName,
        customerName: address.name || session?.user?.name || "고객",
        successUrl: `${window.location.origin}/checkout/success?orderId=${order.id}`,
        failUrl: `${window.location.origin}/checkout/fail?orderId=${order.id}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "결제 중 오류가 발생했습니다.";
      if (msg !== "사용자가 결제를 취소했습니다.") alert(msg);
      setLoading(false);
    }
  };

  if (status === "loading") return null;

  const isGuest = status !== "authenticated";

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
              <button
                type="button"
                onClick={() => setShowSaved(!showSaved)}
                className="text-brand-green text-sm font-medium hover:underline"
              >
                {showSaved ? "목록 닫기" : `저장된 배송지 (${savedAddresses.length})`}
              </button>
            )}
          </div>

          {/* 저장된 배송지 목록 */}
          {showSaved && savedAddresses.length > 0 && (
            <div className="mb-4 space-y-2">
              {savedAddresses.map((s) => {
                const selected = s.dbId
                  ? address.dbId === s.dbId
                  : s.name.trim() === address.name.trim() &&
                    s.address1.trim() === address.address1.trim() &&
                    (s.address2 ?? "").trim() === (address.address2 ?? "").trim();
                return (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between rounded-lg px-4 py-3 border transition ${
                      selected
                        ? "bg-brand-green/15 border-brand-green"
                        : "bg-white/5 border-white/10 hover:border-white/25"
                    }`}
                  >
                    <button type="button" onClick={() => selectSavedAddress(s)} className="text-left flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs font-bold ${s.isDefault ? "text-brand-amber" : "text-brand-green"}`}>
                          {s.isDefault ? `★ ${s.label}` : s.label}
                        </span>
                        {s.areaStatus === "OUT_OF_RANGE" && <span className="text-[10px] text-amber-300">권역 밖 · 확인 필요</span>}
                        {selected && (
                          <span className="text-[10px] font-bold text-brand-green flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-xs">check_circle</span>
                            사용 중
                          </span>
                        )}
                      </div>
                      <p className="text-white text-sm">{s.name} · {s.phone}</p>
                      <p className="text-gray-400 text-xs">
                        {s.zipCode && <span className="mr-1">[{s.zipCode}]</span>}
                        {formatAddressLine(s.address1, s.picked?.buildingName)} {s.address2}
                      </p>
                    </button>
                    {/* 로컬 저장분만 삭제 가능 (DB 주소는 마이페이지에서 관리) */}
                    {s.source !== "db" && (
                      <button
                        type="button"
                        onClick={() => deleteSavedAddress(s.id)}
                        className="text-gray-500 hover:text-red-400 ml-2"
                        title="삭제"
                      >
                        <span className="material-symbols-outlined text-lg">close</span>
                      </button>
                    )}
                  </div>
                );
              })}
              <p className="text-[11px] text-gray-500 mt-2">
                다른 곳으로 보내려면 아래에 새 주소를 검색하세요. 결제하면 배송지 목록에 저장됩니다.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="받는 분" value={address.name} onChange={(e) => setAddress({ ...address, name: e.target.value })} className={inputCls} />
              <input type="tel" placeholder="받는 분 전화번호" value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} className={inputCls} />
            </div>

            {/* 주소 검색 */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="주소를 검색하세요"
                value={formatAddressLine(address.address1, address.picked?.buildingName)}
                readOnly
                onClick={openAddressSearch}
                className={`${inputCls} cursor-pointer flex-1`}
              />
              <button onClick={openAddressSearch} className="px-4 py-3 bg-brand-green text-white rounded-xl text-sm font-semibold hover:bg-brand-mint transition shrink-0">
                주소 검색
              </button>
            </div>

            <input id="address2-input" type="text" placeholder="상세주소 (동/호수)" value={address.address2} onChange={(e) => setAddress({ ...address, address2: e.target.value })} className={inputCls} />

            {/* 배송 가능 여부 — 저장된 배송지는 이미 판정돼 있어 새로 고른 주소만 확인 */}
            {!address.dbId && <AreaCheckNotice picked={address.picked} theme="dark" />}

            {/* 출입·수령 정보 (배송지마다 다르다) */}
            <div className="pt-3 mt-1 border-t border-white/10">
              <DeliveryDetailFields
                value={address.details}
                onChange={(details) => setAddress({ ...address, details })}
                theme="dark"
                showLabel={!address.dbId}
              />
            </div>

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

            {/* 비회원: 브라우저에 배송지 저장 (회원은 자동 저장) */}
            {isGuest && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={saveThisAddress} onChange={(e) => setSaveThisAddress(e.target.checked)} className="w-4 h-4 rounded border-white/20 bg-white/5 text-brand-green focus:ring-brand-green/25" />
                <span className="text-sm text-gray-400">이 브라우저에 배송지 저장</span>
              </label>
            )}
          </div>
        </div>

        {/* 주문 상품 */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10 mb-6">
          <h3 className="text-white font-bold mb-4">주문 상품</h3>
          <div className="space-y-3">
            {items.map((item) => {
              const dateLabel = item.deliveryDate
                ? new Date(item.deliveryDate).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" })
                : null;
              return (
                <div key={`${item.productId}::${item.deliveryDate ?? ""}`} className="flex justify-between items-center">
                  <div>
                    <p className="text-white text-sm">
                      {item.name}
                      {dateLabel && <span className="ml-2 text-[10px] text-[#5DCAA5] font-bold">({dateLabel} 배송)</span>}
                    </p>
                    <p className="text-gray-500 text-xs">수량: {item.quantity}</p>
                  </div>
                  <p className="text-white text-sm font-medium">{(item.price * item.quantity).toLocaleString()}원</p>
                </div>
              );
            })}
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
