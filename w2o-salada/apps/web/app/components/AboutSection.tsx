"use client";

import { useEffect, useState, useRef, useCallback } from "react";

const TYPING_TEXTS = [
  "맵시를 다함 !",
  "건강관리 Let's Start",
  "새벽의 신선함을 깨웁니다.",
];

function useTypingEffect(texts: string[], speed = 100, pause = 2000) {
  const [display, setDisplay] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    let textIdx = 0;
    let charIdx = 0;
    let isDeleting = false;
    let timeout: NodeJS.Timeout;

    const tick = () => {
      const current = texts[textIdx]!;
      if (!isDeleting) {
        setDisplay(current.slice(0, charIdx + 1));
        charIdx++;
        if (charIdx === current.length) {
          timeout = setTimeout(() => { isDeleting = true; tick(); }, pause);
          return;
        }
        timeout = setTimeout(tick, speed);
      } else {
        setDisplay(current.slice(0, charIdx - 1));
        charIdx--;
        if (charIdx === 0) {
          isDeleting = false;
          textIdx = (textIdx + 1) % texts.length;
          timeout = setTimeout(tick, 300);
          return;
        }
        timeout = setTimeout(tick, speed / 2);
      }
    };
    tick();
    const cursorInterval = setInterval(() => setShowCursor((v) => !v), 530);
    return () => { clearTimeout(timeout); clearInterval(cursorInterval); };
  }, [texts, speed, pause]);

  return { display, showCursor };
}

function useCountUp(target: number, duration = 2000) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  const start = useCallback(() => {
    if (started) return;
    setStarted(true);
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration, started]);

  return { count, start };
}

function FeatureCard({ icon, title, desc, stat, statLabel, delay }: {
  icon: string; title: string; desc: string; stat: number; statLabel: string; delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { count, start } = useCountUp(stat, 1500);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => { setVisible(true); start(); }, delay);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay, start]);

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative group cursor-pointer"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible
          ? hovered ? "translateY(-12px) scale(1.03)" : "translateY(0) scale(1)"
          : "translateY(40px) scale(0.95)",
        transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
        transitionDelay: visible ? "0ms" : `${delay}ms`,
      }}
    >
      {/* 배경 글로우 */}
      <div
        className="absolute -inset-1 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"
        style={{ background: "radial-gradient(circle, rgba(29,158,117,0.25) 0%, transparent 70%)" }}
      />

      <div className="relative bg-white/90 backdrop-blur-sm border border-[#1D9E75]/15 rounded-2xl p-7 text-center overflow-hidden group-hover:bg-white group-hover:shadow-2xl group-hover:shadow-[#1D9E75]/15 group-hover:border-[#1D9E75]/30 transition-all duration-500">
        {/* 장식 원 */}
        <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-[#1D9E75]/5 group-hover:bg-[#1D9E75]/10 group-hover:scale-150 transition-all duration-700" />
        <div className="absolute -bottom-6 -left-6 w-16 h-16 rounded-full bg-[#EF9F27]/5 group-hover:bg-[#EF9F27]/10 group-hover:scale-150 transition-all duration-700" />

        {/* 아이콘 */}
        <div className="relative z-10 w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#1D9E75] to-[#5DCAA5] flex items-center justify-center shadow-lg shadow-[#1D9E75]/20 group-hover:shadow-xl group-hover:shadow-[#1D9E75]/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
          <span className="material-symbols-outlined text-white text-3xl" style={{
            animation: hovered ? "iconPulse 0.6s ease-in-out" : "none",
          }}>
            {icon}
          </span>
        </div>

        {/* 숫자 카운트업 */}
        <div className="relative z-10 text-3xl font-black text-[#1D9E75] mb-1 tabular-nums">
          {count.toLocaleString()}{statLabel}
        </div>

        {/* 타이틀 */}
        <h3 className="relative z-10 text-[#0A1A0F] font-bold text-lg mb-2 group-hover:text-[#1D9E75] transition-colors duration-300">
          {title}
        </h3>

        {/* 설명 */}
        <p className="relative z-10 text-[#4a7a5e] text-sm leading-relaxed">
          {desc}
        </p>

        {/* 하단 바 */}
        <div className="mt-5 h-1 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#1D9E75] to-[#5DCAA5] transition-all duration-1000 ease-out"
            style={{ width: visible ? "100%" : "0%" }}
          />
        </div>
      </div>

    </div>
  );
}

const features = [
  { icon: "eco", title: "100% 신선 재료", desc: "매일 아침 산지에서 직송한 유기농 채소와 과일로 만듭니다.", stat: 100, statLabel: "%" },
  { icon: "dark_mode", title: "새벽 배송", desc: "밤사이 준비해서 아침 6시 전 문 앞에 도착합니다.", stat: 6, statLabel: "시 전 도착" },
  { icon: "restaurant_menu", title: "간편하고 다양한 한 끼", desc: "세척·손질 없이 바로 즐기는 매주 새로운 메뉴 구성입니다.", stat: 30, statLabel: "+ 메뉴" },
  { icon: "savings", title: "정기구독 할인", desc: "구독할수록 더 합리적인 가격, 꾸준한 건강 관리를 도와드립니다.", stat: 25, statLabel: "% 할인" },
];

export default function AboutSection() {
  const { display, showCursor } = useTypingEffect(TYPING_TEXTS);

  return (
    <section id="about" className="pt-6 pb-20 bg-gradient-to-b from-[#e8f5ee] to-[#d4edda]">
      <div className="max-w-7xl mx-auto px-6">
        {/* 히어로 텍스트 */}
        <div className="text-center mb-16">
          <span className="text-[#1D9E75] text-xs tracking-[0.3em] uppercase font-medium">
            WHY W2O SALADA
          </span>
          <p className="text-[#EF9F27] text-lg mt-4 mb-2">Wake up 2 go Out !</p>
          <h2 className="text-4xl md:text-5xl font-bold text-[#0A1A0F] min-h-[1.3em]">
            {display}
            <span className={`text-[#1D9E75] transition-opacity ${showCursor ? "opacity-100" : "opacity-0"}`}>
              |
            </span>
          </h2>
          <p className="text-[#2d5a3f] mt-4">새벽의 신선함을 깨웁니다.</p>
          <div className="mt-8 flex justify-center gap-4 flex-wrap">
            <a href="#menu" className="px-8 py-3 bg-[#1D9E75] text-white rounded-full font-semibold hover:bg-[#167A5B] hover:shadow-lg hover:shadow-[#1D9E75]/30 hover:-translate-y-0.5 transition-all duration-300">
              메뉴 보기
            </a>
            <a href="#subscribe" className="px-8 py-3 bg-[#EF9F27] text-white rounded-full font-semibold hover:bg-[#D48A1E] hover:shadow-lg hover:shadow-[#EF9F27]/30 hover:-translate-y-0.5 transition-all duration-300">
              건강관리 Let&apos;s Start
            </a>
          </div>
        </div>

        {/* 특장점 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <FeatureCard key={i} {...f} delay={i * 150} />
          ))}
        </div>
      </div>
    </section>
  );
}
