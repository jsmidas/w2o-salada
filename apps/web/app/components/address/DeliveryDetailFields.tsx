"use client";

import { DROP_OPTIONS, type DeliveryDetails } from "./daum";

/**
 * 배송지별 출입·수령 정보 입력 — 배송지마다 다르므로 주소 폼 안에 붙인다.
 * 부모님 댁·사무실처럼 여러 곳에 보내는 회원을 위해 별칭도 여기서 받는다.
 */
export default function DeliveryDetailFields({
  value,
  onChange,
  theme = "dark",
  showLabel = true,
}: {
  value: DeliveryDetails;
  onChange: (next: DeliveryDetails) => void;
  theme?: "dark" | "light";
  showLabel?: boolean;
}) {
  const dark = theme === "dark";
  const input = dark
    ? "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-brand-green"
    : "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]";
  const label = dark ? "text-xs text-gray-400 block mb-1" : "text-xs font-medium text-gray-500 block mb-1";
  const chipOn = dark ? "bg-brand-green/20 border-brand-green/50 text-white" : "bg-[#1D9E75]/10 border-[#1D9E75]/40 text-[#0A1A0F]";
  const chipOff = dark ? "bg-white/5 border-white/10 text-gray-400 hover:border-white/30" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300";

  const set = (k: keyof DeliveryDetails, v: string) => onChange({ ...value, [k]: v } as DeliveryDetails);

  return (
    <div className="space-y-3">
      {showLabel && (
        <div>
          <label className={label}>배송지 이름 <span className="opacity-60">(선택)</span></label>
          <input type="text" value={value.label} onChange={(e) => set("label", e.target.value)} placeholder="예: 집, 부모님 댁, 사무실" className={input} />
        </div>
      )}

      <div>
        <label className={label}>갖다둘 곳</label>
        <div className="flex flex-wrap gap-2">
          {DROP_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => set("dropLocation", o.value)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${value.dropLocation === o.value ? chipOn : chipOff}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {(value.dropLocation === "PARCEL_BOX" || value.dropLocation === "OTHER") && (
          <input
            type="text"
            value={value.dropNote}
            onChange={(e) => set("dropNote", e.target.value)}
            placeholder={value.dropLocation === "PARCEL_BOX" ? "택배함 번호·비밀번호" : "어디에 두면 될까요?"}
            className={`${input} mt-2`}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>공동현관 출입</label>
          <input type="text" value={value.entranceMethod} onChange={(e) => set("entranceMethod", e.target.value)} placeholder="예: 비밀번호 / 경비실 호출 / 자유 출입" className={input} />
        </div>
        <div>
          <label className={label}>출입 비밀번호</label>
          <input type="text" inputMode="numeric" value={value.entrancePassword} onChange={(e) => set("entrancePassword", e.target.value)} placeholder="#1234*" className={input} autoComplete="off" />
        </div>
      </div>

      <div>
        <label className={label}>층수 <span className="opacity-60">(엘리베이터 없는 건물이면 꼭)</span></label>
        <input type="text" value={value.floor} onChange={(e) => set("floor", e.target.value)} placeholder="예: 3층, 지하1층" className={`${input} max-w-[12rem]`} />
      </div>

      <p className={`text-[11px] ${dark ? "text-gray-500" : "text-gray-400"}`}>
        새벽 3~6시 사이에 배송됩니다. 출입 정보는 배송 기사에게만 전달되고, 벨은 누르지 않습니다.
      </p>
    </div>
  );
}
