"use client";

import { useState } from "react";

const defaultSettings = {
  shopName: "W2O SALADA",
  companyName: "",
  ownerName: "",
  phone: "053-721-7794",
  email: "dahamfood@dahamfood.co.kr",
  address: "대구광역시 달서구",
  businessNumber: "000-00-00000",
  mailOrderNumber: "", // 통신판매업 신고번호 — 전자상거래법 필수 표기, 간편결제 심사에서 확인하는 항목
  refundFeePercent: "30", // 구독 해지·크레딧 환불 시 공제하는 취소 수수료율(%) — 약관 6조·환불 승인 모달에 반영
  cutoffTime: "14:00",
  deliveryStart: "03:00",
  deliveryEnd: "06:00",
  freeShippingMin: "11000",
  deliveryFee: "0",
  deliveryAreas: "대구 전역",
  // 배송 권역 (시/도 전역 → 허용 동 → 센터 반경 순 판정)
  deliveryCenterName: "본사",
  deliveryCenterAddress: "대구 달서구 성서공단로 332-10",
  deliveryCenterLat: "",
  deliveryCenterLng: "",
  deliveryRadiusKm: "10",
  deliveryAllowedSido: "대구",
  deliveryAllowedDongs: "",
  orderConfirm: "true",
  deliveryStart_noti: "true",
  deliveryDone: "true",
  subscriptionPayment: "true",
  paymentFail: "true",
  subscriptionRenew: "true",
  "inquiry.notifyPhones": "",
};

export default function SettingsClient({
  initialSettings,
}: {
  initialSettings: Record<string, string>;
}) {
  const [settings, setSettings] = useState({ ...defaultSettings, ...initialSettings });
  const [saved, setSaved] = useState<string | null>(null);

  const update = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (section: string, keys: string[]) => {
    const data: Record<string, string> = {};
    for (const key of keys) {
      data[key] = settings[key as keyof typeof settings];
    }

    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      setSaved(section);
      setTimeout(() => setSaved(null), 2000);
    }
  };

  const inputClass = "px-4 py-2.5 border border-gray-200 rounded-lg text-sm w-full max-w-md focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75] transition";

  // ── 배송 권역: 센터 좌표 찾기 / 기존 주소 좌표 보정 ──
  const [areaBusy, setAreaBusy] = useState<string | null>(null);
  const [areaMsg, setAreaMsg] = useState<string | null>(null);

  const geocodeCenter = async () => {
    setAreaBusy("center");
    setAreaMsg(null);
    try {
      const res = await fetch("/api/admin/delivery-area", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "geocodeCenter", address: settings.deliveryCenterAddress }),
      });
      const data = await res.json();
      if (!res.ok) { setAreaMsg(data.error ?? "좌표를 찾지 못했습니다."); return; }
      update("deliveryCenterLat", String(data.lat));
      update("deliveryCenterLng", String(data.lng));
      setAreaMsg(`좌표 확인: ${data.lat.toFixed(5)}, ${data.lng.toFixed(5)} — 저장을 눌러 반영하세요`);
    } finally {
      setAreaBusy(null);
    }
  };

  const backfillAddresses = async () => {
    setAreaBusy("backfill");
    setAreaMsg(null);
    try {
      const res = await fetch("/api/admin/delivery-area", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "backfill" }),
      });
      const data = await res.json();
      if (!res.ok) { setAreaMsg(data.error ?? "실패"); return; }
      setAreaMsg(`주소 ${data.total}건 재판정 — 권역 내 ${data.inRange} · 반경 밖 ${data.outOfRange} · 좌표 미확인 ${data.unknown}${data.geocodeFailed ? ` (지오코딩 실패 ${data.geocodeFailed})` : ""}`);
    } finally {
      setAreaBusy(null);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">설정</h2>
      <div className="space-y-6">

        {/* 기본 설정 */}
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h3 className="font-bold text-gray-700 mb-4">쇼핑몰 기본 설정</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">쇼핑몰 이름 (브랜드)</label>
              <input type="text" value={settings.shopName} onChange={(e) => update("shopName", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">회사명 (법인명)</label>
              <input type="text" value={settings.companyName} onChange={(e) => update("companyName", e.target.value)} placeholder="예: 주식회사 다함푸드" className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">대표자명</label>
              <input type="text" value={settings.ownerName} onChange={(e) => update("ownerName", e.target.value)} placeholder="예: 홍길동" className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">대표 전화번호</label>
              <input type="text" value={settings.phone} onChange={(e) => update("phone", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">이메일</label>
              <input type="email" value={settings.email} onChange={(e) => update("email", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">주소</label>
              <input type="text" value={settings.address} onChange={(e) => update("address", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">사업자등록번호</label>
              <input type="text" value={settings.businessNumber} onChange={(e) => update("businessNumber", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">통신판매업 신고번호</label>
              <input type="text" value={settings.mailOrderNumber} onChange={(e) => update("mailOrderNumber", e.target.value)} placeholder="예: 2026-대구달서-0000" className={inputClass} />
              <p className="text-xs text-gray-400 mt-1">회사명·대표자·사업자등록번호·신고번호는 사이트 하단에 표시됩니다. 카카오페이·삼성페이 등 간편결제 심사에서 이 표기를 확인합니다.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">환불 취소 수수료율 (%)</label>
              <input type="number" min="0" max="100" step="0.5" value={settings.refundFeePercent} onChange={(e) => update("refundFeePercent", e.target.value)} className={inputClass} />
              <p className="text-xs text-gray-400 mt-1">구독 해지·크레딧 환불 시 환불 대상 금액에서 공제하는 비율. 구독 약관 제6조와 고객 해지 화면, 환불 승인 모달의 기본 수수료에 그대로 반영됩니다.</p>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={() => handleSave("basic", ["shopName", "companyName", "ownerName", "phone", "email", "address", "businessNumber", "mailOrderNumber", "refundFeePercent"])}
              className="px-5 py-2 bg-[#1D9E75] text-white text-sm font-medium rounded-lg hover:bg-[#178a64] transition"
            >
              저장
            </button>
            {saved === "basic" && <span className="text-sm text-[#1D9E75] font-medium">저장되었습니다 ✓</span>}
          </div>
        </div>

        {/* 배송 설정 */}
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h3 className="font-bold text-gray-700 mb-4">배송 설정</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">주문 마감 시간</label>
              <input type="time" value={settings.cutoffTime} onChange={(e) => update("cutoffTime", e.target.value)} className={inputClass} />
            </div>
            <div className="flex gap-4 max-w-md">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-600 block mb-1">배송 시작</label>
                <input type="time" value={settings.deliveryStart} onChange={(e) => update("deliveryStart", e.target.value)} className={inputClass} />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-600 block mb-1">배송 종료</label>
                <input type="time" value={settings.deliveryEnd} onChange={(e) => update("deliveryEnd", e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">배송비 (원)</label>
              <input type="number" value={settings.deliveryFee} onChange={(e) => update("deliveryFee", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">무료배송 최소금액 (원)</label>
              <input type="number" value={settings.freeShippingMin} onChange={(e) => update("freeShippingMin", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">배송 가능 지역</label>
              <input type="text" value={settings.deliveryAreas} onChange={(e) => update("deliveryAreas", e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={() => handleSave("delivery", ["cutoffTime", "deliveryStart", "deliveryEnd", "deliveryFee", "freeShippingMin", "deliveryAreas"])}
              className="px-5 py-2 bg-[#1D9E75] text-white text-sm font-medium rounded-lg hover:bg-[#178a64] transition"
            >
              저장
            </button>
            {saved === "delivery" && <span className="text-sm text-[#1D9E75] font-medium">저장되었습니다 ✓</span>}
          </div>
        </div>

        {/* 배송 권역 — 센터 반경으로 배송 가능 여부를 판정한다 */}
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h3 className="font-bold text-gray-700 mb-1">배송 권역</h3>
          <p className="text-xs text-gray-400 mb-4">
            판정 순서: <b>전역 배송 시/도</b> → 허용 동 → 센터 반경. 전역 시/도 안이면 좌표와 무관하게 자동 수용하고,
            그 밖은 센터 거리로 판정해 반경 밖이면 접수 후 &quot;배송지 확인&quot; 큐로 보냅니다.
          </p>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">전역 배송하는 시/도 (쉼표 구분)</label>
              <input type="text" value={settings.deliveryAllowedSido} onChange={(e) => update("deliveryAllowedSido", e.target.value)} placeholder="예: 대구" className={inputClass} />
              <p className="text-xs text-gray-400 mt-1">&quot;대구&quot;·&quot;대구광역시&quot; 모두 인식합니다. 비우면 반경 판정만 남습니다. 저장 후 &quot;재판정&quot;을 눌러 기존 배송지에 반영하세요.</p>
            </div>
            <div className="flex gap-4 max-w-md">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-600 block mb-1">센터 이름</label>
                <input type="text" value={settings.deliveryCenterName} onChange={(e) => update("deliveryCenterName", e.target.value)} className={inputClass} />
              </div>
              <div className="w-32">
                <label className="text-sm font-medium text-gray-600 block mb-1">반경 (km)</label>
                <input type="number" step="0.5" min="1" value={settings.deliveryRadiusKm} onChange={(e) => update("deliveryRadiusKm", e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">센터 주소</label>
              <div className="flex gap-2 max-w-md">
                <input type="text" value={settings.deliveryCenterAddress} onChange={(e) => update("deliveryCenterAddress", e.target.value)} className={inputClass} />
                <button
                  type="button"
                  onClick={geocodeCenter}
                  disabled={areaBusy !== null}
                  className="shrink-0 px-3 py-2 border border-[#1D9E75] text-[#1D9E75] text-sm rounded-lg hover:bg-[#1D9E75]/5 transition disabled:opacity-50"
                >
                  {areaBusy === "center" ? "찾는 중..." : "좌표 찾기"}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                좌표: {settings.deliveryCenterLat && settings.deliveryCenterLng ? `${settings.deliveryCenterLat}, ${settings.deliveryCenterLng}` : "없음 — 좌표 찾기를 누르세요"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">반경 밖이라도 배송하는 동 (쉼표 구분)</label>
              <input type="text" value={settings.deliveryAllowedDongs} onChange={(e) => update("deliveryAllowedDongs", e.target.value)} placeholder="예: 상인동, 월성동" className={inputClass} />
              <p className="text-xs text-gray-400 mt-1">법정동 이름 그대로. 코스가 생겨 열어둘 지역이나 반경 경계에 걸친 동에 씁니다.</p>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => handleSave("area", ["deliveryCenterName", "deliveryCenterAddress", "deliveryCenterLat", "deliveryCenterLng", "deliveryRadiusKm", "deliveryAllowedSido", "deliveryAllowedDongs"])}
              className="px-5 py-2 bg-[#1D9E75] text-white text-sm font-medium rounded-lg hover:bg-[#178a64] transition"
            >
              저장
            </button>
            <button
              type="button"
              onClick={backfillAddresses}
              disabled={areaBusy !== null}
              className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              title="저장된 모든 배송지의 좌표를 채우고 현재 반경으로 다시 판정합니다"
            >
              {areaBusy === "backfill" ? "재판정 중..." : "기존 배송지 좌표 보정·재판정"}
            </button>
            {saved === "area" && <span className="text-sm text-[#1D9E75] font-medium">저장되었습니다 ✓</span>}
            {areaMsg && <span className="text-sm text-gray-600">{areaMsg}</span>}
          </div>
        </div>

        {/* 알림 설정 */}
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h3 className="font-bold text-gray-700 mb-4">알림 설정</h3>
          <div className="space-y-3">
            {[
              { key: "orderConfirm", label: "주문 확인 알림톡" },
              { key: "deliveryStart_noti", label: "배송 출발 알림톡" },
              { key: "deliveryDone", label: "배송 완료 알림톡" },
              { key: "subscriptionPayment", label: "구독 결제 알림톡" },
              { key: "paymentFail", label: "결제 실패 알림 (알림톡+SMS)" },
              { key: "subscriptionRenew", label: "구독 갱신 D-3 알림톡" },
            ].map((item) => (
              <label key={item.key} className="flex items-center justify-between max-w-md cursor-pointer group">
                <span className="text-sm text-gray-700 group-hover:text-gray-900">{item.label}</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={settings[item.key as keyof typeof settings] === "true"}
                    onChange={(e) => update(item.key, e.target.checked ? "true" : "false")}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-gray-200 rounded-full peer-checked:bg-[#1D9E75] transition" />
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full peer-checked:translate-x-5 transition" />
                </div>
              </label>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={() => handleSave("notification", ["orderConfirm", "deliveryStart_noti", "deliveryDone", "subscriptionPayment", "paymentFail", "subscriptionRenew"])}
              className="px-5 py-2 bg-[#1D9E75] text-white text-sm font-medium rounded-lg hover:bg-[#178a64] transition"
            >
              저장
            </button>
            {saved === "notification" && <span className="text-sm text-[#1D9E75] font-medium">저장되었습니다 ✓</span>}
          </div>
        </div>


      </div>
    </div>
  );
}
