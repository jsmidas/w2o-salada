const items = [
  { icon: "calendar_month", text: "매주 2회 배송", accent: true },
  { icon: "lunch_dining", text: "2개 이상 구성", accent: false },
  { icon: "autorenew", text: "정기구독", accent: true },
  { icon: "dark_mode", text: "새벽 6시 전 도착", accent: false },
  { icon: "savings", text: "구독 시 21% 할인", accent: true },
  { icon: "eco", text: "100% 신선 재료", accent: false },
];

function MarqueeTrack({ reverse = false }: { reverse?: boolean }) {
  return (
    <div
      className="flex shrink-0 items-center gap-8 md:gap-12"
      style={{
        animation: `marquee 30s linear infinite${reverse ? " reverse" : ""}`,
      }}
    >
      {/* 2벌 반복해서 이음새 없이 루프 */}
      {[...items, ...items].map((item, i) => (
        <span key={i} className="flex items-center gap-2 whitespace-nowrap select-none">
          <span className="material-symbols-outlined text-xl text-[#5DCAA5]">
            {item.icon}
          </span>
          <span
            className={`text-sm md:text-base font-semibold tracking-wide ${
              item.accent ? "text-white" : "text-white/70"
            }`}
          >
            {item.text}
          </span>
          {/* 구분점 */}
          <span className="text-[#EF9F27] text-lg ml-4">✦</span>
        </span>
      ))}
    </div>
  );
}

export default function MarqueeBanner() {
  return (
    <div className="relative overflow-hidden bg-[#0A1A0F] py-3 md:py-4">
      {/* 좌우 페이드 그라디언트 */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 md:w-24 z-10 bg-gradient-to-r from-[#0A1A0F] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 md:w-24 z-10 bg-gradient-to-l from-[#0A1A0F] to-transparent" />

      <div className="flex gap-8 md:gap-12">
        <MarqueeTrack />
        <MarqueeTrack />
      </div>
    </div>
  );
}
