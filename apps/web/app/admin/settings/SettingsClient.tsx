"use client";

import { useState } from "react";

const defaultSettings = {
  shopName: "W2O SALADA",
  companyName: "",
  ownerName: "",
  phone: "053-721-7794",
  email: "hello@w2osalada.co.kr",
  address: "대구광역시 달서구",
  businessNumber: "000-00-00000",
  cutoffTime: "14:00",
  deliveryStart: "03:00",
  deliveryEnd: "06:00",
  freeShippingMin: "11000",
  deliveryFee: "0",
  deliveryAreas: "대구 달서구, 달성군 일부",
  orderConfirm: "true",
  deliveryStart_noti: "true",
  deliveryDone: "true",
  subscriptionPayment: "true",
  paymentFail: "true",
  subscriptionRenew: "true",
  "inquiry.notifyPhones": "",
  tossClientKey: "",
  tossSecretKey: "",
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
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={() => handleSave("basic", ["shopName", "companyName", "ownerName", "phone", "email", "address", "businessNumber"])}
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

        {/* 결제 설정 */}
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h3 className="font-bold text-gray-700 mb-4">결제 설정 (토스페이먼츠)</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">Client Key</label>
              <input type="text" value={settings.tossClientKey} onChange={(e) => update("tossClientKey", e.target.value)} placeholder="test_ck_..." className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">Secret Key</label>
              <input type="password" value={settings.tossSecretKey} onChange={(e) => update("tossSecretKey", e.target.value)} placeholder="test_sk_..." className={inputClass} />
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={() => handleSave("payment", ["tossClientKey", "tossSecretKey"])}
              className="px-5 py-2 bg-[#1D9E75] text-white text-sm font-medium rounded-lg hover:bg-[#178a64] transition"
            >
              저장
            </button>
            {saved === "payment" && <span className="text-sm text-[#1D9E75] font-medium">저장되었습니다 ✓</span>}
          </div>
        </div>

      </div>
    </div>
  );
}
