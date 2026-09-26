"use client";

export type SavedCardInfo = { subscriptionId: string; cardCompany: string | null; cardNumber: string | null; label: string };
export type PayMethod = "saved" | "window";

/**
 * 결제 수단 선택 — 등록된 카드(빌링키)가 있을 때만 렌더링.
 * "등록 카드로 바로 결제"는 결제창 없이 서버가 즉시 청구하고, "다른 방법"은 기존 토스 결제창을 연다.
 */
export default function SavedCardChoice({
  card,
  value,
  onChange,
  theme = "dark",
  autoRenewNote = false,
}: {
  card: SavedCardInfo | null;
  value: PayMethod;
  onChange: (v: PayMethod) => void;
  theme?: "dark" | "light";
  /** 자동 갱신 구독을 이 카드로 시작한다는 안내를 붙일지 */
  autoRenewNote?: boolean;
}) {
  if (!card) return null;
  const dark = theme === "dark";

  const box = (on: boolean) =>
    `w-full text-left px-3.5 py-3 rounded-xl border transition flex items-center gap-3 ${
      on
        ? dark ? "border-brand-green bg-brand-green/10" : "border-[#1D9E75] bg-[#1D9E75]/5"
        : dark ? "border-white/10 hover:border-white/30" : "border-gray-200 hover:border-gray-300"
    }`;
  const radio = (on: boolean) =>
    `w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
      on ? "border-[#1D9E75]" : dark ? "border-white/30" : "border-gray-300"
    }`;
  const title = dark ? "text-white" : "text-[#0A1A0F]";
  const sub = dark ? "text-gray-400" : "text-gray-500";

  return (
    <div className="space-y-2">
      <p className={`text-xs font-semibold ${dark ? "text-gray-300" : "text-gray-600"}`}>결제 수단</p>
      <button type="button" onClick={() => onChange("saved")} className={box(value === "saved")}>
        <span className={radio(value === "saved")}>
          {value === "saved" && <span className="w-2 h-2 rounded-full bg-[#1D9E75]" />}
        </span>
        <span className="material-symbols-outlined text-[20px] text-[#1D9E75]">credit_card</span>
        <span className="min-w-0">
          <span className={`block text-sm font-semibold ${title}`}>등록된 카드로 바로 결제</span>
          <span className={`block text-xs ${sub}`}>
            {card.label} · 카드 입력 없이 즉시 결제
            {autoRenewNote && " · 이 카드로 자동 갱신"}
          </span>
        </span>
      </button>
      <button type="button" onClick={() => onChange("window")} className={box(value === "window")}>
        <span className={radio(value === "window")}>
          {value === "window" && <span className="w-2 h-2 rounded-full bg-[#1D9E75]" />}
        </span>
        <span className={`material-symbols-outlined text-[20px] ${sub}`}>open_in_new</span>
        <span className="min-w-0">
          <span className={`block text-sm font-semibold ${title}`}>다른 카드로 결제</span>
          <span className={`block text-xs ${sub}`}>카드 결제창에서 카드사·앱카드 선택</span>
        </span>
      </button>
    </div>
  );
}
