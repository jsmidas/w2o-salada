"use client";

import { useEffect, useRef, useState } from "react";

const days = [
  { label: "월", short: "MON", delivery: false },
  { label: "화", short: "TUE", delivery: true },
  { label: "수", short: "WED", delivery: false },
  { label: "목", short: "THU", delivery: true },
  { label: "금", short: "FRI", delivery: false },
  { label: "토", short: "SAT", delivery: false },
  { label: "일", short: "SUN", delivery: false },
];

function SaladIcon({ delay }: { delay: number }) {
  return (
    <div
      className="flex flex-col items-center gap-0.5 md:gap-1 animate-bounce-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="w-7 h-7 md:w-11 md:h-11 rounded-full bg-gradient-to-br from-[#1D9E75] to-[#5DCAA5] flex items-center justify-center shadow-lg shadow-[#1D9E75]/30">
        <span className="material-symbols-outlined text-white text-sm md:text-xl">
          lunch_dining
        </span>
      </div>
      <div className="w-7 h-7 md:w-11 md:h-11 rounded-full bg-gradient-to-br from-[#1D9E75] to-[#5DCAA5] flex items-center justify-center shadow-lg shadow-[#1D9E75]/30">
        <span className="material-symbols-outlined text-white text-sm md:text-xl">
          lunch_dining
        </span>
      </div>
    </div>
  );
}

export default function WeeklyTimeline() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="py-16 md:py-20 bg-gradient-to-b from-[#e8f5ee] to-[#d4edda]">
      <div className="max-w-4xl mx-auto px-6">
        {/* 헤더 */}
        <div className="text-center mb-10 md:mb-14">
          <span className="text-[#1D9E75] text-xs tracking-[0.3em] uppercase font-medium">
            WEEKLY DELIVERY
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0A1A0F] mt-3">
            1주일의 W2O
          </h2>
          <p className="text-[#4a7a5e] mt-3 text-sm md:text-base">
            매주 <strong className="text-[#1D9E75]">화요일</strong>과{" "}
            <strong className="text-[#1D9E75]">목요일</strong>, 새벽에 신선한 샐러드{" "}
            <strong className="text-[#EF9F27]">2개</strong>가 문 앞에 도착합니다
          </p>
        </div>

        {/* 타임라인 */}
        <div className="relative">
          {/* 연결선 */}
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-[#1D9E75]/15 -translate-y-1/2 hidden md:block" />
          <div
            className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-[#1D9E75] to-[#5DCAA5] -translate-y-1/2 hidden md:block transition-all duration-1000 ease-out"
            style={{ width: visible ? "100%" : "0%" }}
          />

          <div className="grid grid-cols-7 gap-1 md:gap-3">
            {days.map((day, i) => {
              const stagger = i * 100;
              return (
                <div
                  key={day.short}
                  className="flex flex-col items-center gap-2 md:gap-3"
                  style={{
                    opacity: visible ? 1 : 0,
                    transform: visible ? "translateY(0)" : "translateY(30px)",
                    transition: `all 0.5s ease-out ${stagger}ms`,
                  }}
                >
                  {/* 배송일 샐러드 아이콘 or 빈 공간 */}
                  <div className="h-16 md:h-28 flex items-end justify-center">
                    {day.delivery && visible && (
                      <SaladIcon delay={stagger + 400} />
                    )}
                  </div>

                  {/* 노드 */}
                  <div className="relative z-10">
                    <div
                      className={`w-6 h-6 md:w-10 md:h-10 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                        day.delivery
                          ? "bg-[#1D9E75] border-[#1D9E75] shadow-lg shadow-[#1D9E75]/30 scale-110"
                          : "bg-white border-[#1D9E75]/20"
                      }`}
                      style={{ transitionDelay: `${stagger}ms` }}
                    >
                      {day.delivery && (
                        <span className="material-symbols-outlined text-white text-xs md:text-base">
                          local_shipping
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 요일 */}
                  <div className="text-center">
                    <p
                      className={`text-sm md:text-lg font-bold ${
                        day.delivery ? "text-[#1D9E75]" : "text-[#0A1A0F]/30"
                      }`}
                    >
                      {day.label}
                    </p>
                    <p
                      className={`hidden md:block text-xs tracking-wider ${
                        day.delivery ? "text-[#1D9E75]/70" : "text-[#0A1A0F]/20"
                      }`}
                    >
                      {day.short}
                    </p>
                    {day.delivery && (
                      <p className="text-[9px] md:text-xs text-[#EF9F27] font-bold mt-0.5 md:mt-1">
                        AM 6:00
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 하단 요약 카드 */}
        <div
          className="mt-10 md:mt-14 grid grid-cols-1 md:grid-cols-3 gap-4"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.6s ease-out 800ms",
          }}
        >
          {[
            {
              icon: "event_repeat",
              title: "매주 2회",
              desc: "화·목 고정 배송으로\n규칙적인 식단 관리",
              color: "green" as const,
            },
            {
              icon: "takeout_dining",
              title: "2개 이상",
              desc: "매 배송마다 셰프 엄선\n샐러드 2개 이상 구성",
              color: "amber" as const,
            },
            {
              icon: "all_inclusive",
              title: "정기구독",
              desc: "자동 결제·배송으로\n신경 쓸 일 제로",
              color: "green" as const,
            },
          ].map((card, i) => (
            <div
              key={i}
              className="group bg-white/80 backdrop-blur-sm rounded-2xl border border-[#1D9E75]/10 p-5 md:p-6 text-center hover:bg-white hover:shadow-lg hover:shadow-[#1D9E75]/10 hover:border-[#1D9E75]/25 hover:-translate-y-1 transition-all duration-300"
            >
              <div
                className={`w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center ${
                  card.color === "green"
                    ? "bg-gradient-to-br from-[#1D9E75] to-[#5DCAA5]"
                    : "bg-gradient-to-br from-[#EF9F27] to-[#f5c164]"
                } shadow-md group-hover:scale-110 transition-transform duration-300`}
              >
                <span className="material-symbols-outlined text-white text-2xl">
                  {card.icon}
                </span>
              </div>
              <h3 className="text-xl font-black text-[#0A1A0F] mb-1">{card.title}</h3>
              <p className="text-[#4a7a5e] text-sm whitespace-pre-line leading-relaxed">
                {card.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
