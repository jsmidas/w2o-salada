"use client";

import { useState } from "react";
import Link from "next/link";

const defaultSettings = {
  shopName: "W2O SALADA",
  companyName: "",
  ownerName: "",
  phone: "053-721-7794",
  email: "dahamfood@dahamfood.co.kr",
  address: "대구광역시 달서구",
  businessNumber: "000-00-00000",
  mailOrderNumber: "", // 통신판매업 신고번호 — 전자상거래법 필수 표기, 간편결제 심사에서 확인하는 항목
  refundFeePercent: "10", // 구독 해지·크레딧 환불 시 공제하는 취소 수수료율(%) — 약관 6조·환불 승인 모달에 반영
                          // 계속거래 위약금 상한(통상 10%)을 넘기면 조항이 무효가 된다 — lib/refund-policy.ts 참고
  cutoffTime: "14:00",
  deliveryStart: "03:00",
  deliveryEnd: "06:00",
  freeShippingMin: "11000",
  deliveryFee: "0",
  deliveryAreas: "대구 전역",
  // 배송 권역 (시/도 전역 → 허용 동 → 센터 반경 순 판정)
  deliveryZoneMode: "LEGACY", // LEGACY = 기존 규칙(권역 밖도 보류 접수) / ZONES = 권역 테이블(권역 밖 결제 차단)
  adminAlertPhone: "", // 권역 때문에 구독 자동결제가 보류되면 SMS 1건을 받을 관리자 번호 (비우면 화면 목록 + Sentry 만)
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

  // 주소가 많으면 한 요청으로 다 못 돈다 (건마다 외부 지오코딩 → 타임아웃).
  // 서버가 커서를 돌려주므로 끝날 때까지 이어서 호출하고, 진행 상황을 그때그때 보여준다.
  const backfillAddresses = async () => {
    setAreaBusy("backfill");
    setAreaMsg("재판정 준비 중...");
    try {
      let cursor: string | null = null;
      let total = 0, inRange = 0, outOfRange = 0, unknown = 0, geocodeFailed = 0, released = 0;

      for (let guard = 0; guard < 500; guard++) {
        const res: Response = await fetch("/api/admin/delivery-area", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "backfill", cursor }),
        });
        const data = await res.json();
        if (!res.ok) { setAreaMsg(data.error ?? "실패"); return; }

        total += data.processed ?? 0;
        inRange += data.inRange ?? 0;
        outOfRange += data.outOfRange ?? 0;
        unknown += data.unknown ?? 0;
        geocodeFailed += data.geocodeFailed ?? 0;
        released += data.released ?? 0;

        if (data.done || !data.nextCursor) break;
        cursor = data.nextCursor as string;
        setAreaMsg(`재판정 중... ${total}건 처리`);
      }

      setAreaMsg(
        `주소 ${total}건 재판정 — 권역 내 ${inRange} · 반경 밖 ${outOfRange} · 좌표 미확인 ${unknown}` +
          (geocodeFailed ? ` (지오코딩 실패 ${geocodeFailed})` : "") +
          (released ? ` · 보류 해제 ${released}건` : ""),
      );
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
            {" "}권역 목록·예외·날짜별 중지 관리 →{" "}
            <Link href="/admin/delivery-zones" className="text-[#1D9E75] hover:underline">/admin/delivery-zones</Link>
          </p>
          <div className="space-y-4">
            {/* 판정 모드 — 권역 데이터 검증 전에 ZONES 로 바꾸면 기존 고객이 결제에서 막히므로 기본은 LEGACY */}
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">권역 판정 모드</label>
              <select value={settings.deliveryZoneMode} onChange={(e) => update("deliveryZoneMode", e.target.value)} className={inputClass}>
                <option value="LEGACY">기존 규칙 — 시/도·동·반경으로 판정, 권역 밖은 보류 접수</option>
                <option value="ZONES">권역 테이블 — /admin/delivery-zones 에 등록된 권역만 배송, 권역 밖은 결제 차단 + 오픈 알림 신청</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">권역 데이터를 넣고 검증한 뒤 ZONES 로 바꾸세요. 예외 규칙(차단)은 두 모드 모두 적용됩니다.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">관리자 알림 휴대폰 (선택)</label>
              <input type="text" value={settings.adminAlertPhone} onChange={(e) => update("adminAlertPhone", e.target.value)} placeholder="예: 010-0000-0000" className={inputClass} />
              <p className="text-xs text-gray-400 mt-1">권역 때문에 구독 자동결제가 보류되면 이 번호로 SMS 1건을 보냅니다. 비우면 화면 목록과 Sentry 만.</p>
            </div>
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
              onClick={() => handleSave("area", ["deliveryZoneMode", "adminAlertPhone", "deliveryCenterName", "deliveryCenterAddress", "deliveryCenterLat", "deliveryCenterLng", "deliveryRadiusKm", "deliveryAllowedSido", "deliveryAllowedDongs"])}
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
