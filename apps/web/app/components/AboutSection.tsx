"use client";

import { useEffect, useState, useRef, useCallback } from "react";

const TYPING_TEXTS = [
  "우리 집 식탁을 차립니다.",
  "샐러드·간편식·반찬, 한 번에.",
  "매주 두 번, 새벽에 도착합니다.",
  "배송비, 가입비 없는 실속 소비 시작.",
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

// 초기값은 최종 숫자다 — 서버 렌더·JS 실행 전·스크롤 진입 전에도 "24시간", "6시 전"이 그대로 보인다.
// 카운트업은 화면에 들어올 때만 0에서 다시 올라가는 부가 효과다.
function useCountUp(target: number, duration = 2000) {
  const [count, setCount] = useState(target);
  const [started, setStarted] = useState(false);

  const start = useCallback(() => {
    if (started) return;
    setStarted(true);
    setCount(0);
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
  // null = 아직 관찰 전(서버 렌더·JS 실행 전) — 이때는 숨기지 않고 그대로 보여준다.
  // 마운트 후 화면 밖에 있을 때만 false 로 숨겼다가, 들어오면 true 로 페이드인한다.
  const [visible, setVisible] = useState<boolean | null>(null);
  const [hovered, setHovered] = useState(false);
  const { count, start } = useCountUp(stat, 1500);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setTimeout(() => { setVisible(true); start(); }, delay);
          observer.disconnect();
        } else {
          setVisible(false);
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
        opacity: visible === false ? 0 : 1,
        transform: visible === false
          ? "translateY(40px) scale(0.95)"
          : hovered ? "translateY(-12px) scale(1.03)" : "translateY(0) scale(1)",
        transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
        transitionDelay: visible === false ? `${delay}ms` : "0ms",
      }}
    >
      {/* 배경 글로우 */}
      <div
        className="absolute -inset-1 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"
        style={{ background: "radial-gradient(circle, rgba(29,158,117,0.25) 0%, transparent 70%)" }}
      />

      <div className="relative bg-white/90 backdrop-blur-sm border border-[#1D9E75]/15 rounded-2xl p-4 sm:p-7 text-center overflow-hidden group-hover:bg-white group-hover:shadow-2xl group-hover:shadow-[#1D9E75]/15 group-hover:border-[#1D9E75]/30 transition-all duration-500">
        {/* 장식 원 */}
        <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-[#1D9E75]/5 group-hover:bg-[#1D9E75]/10 group-hover:scale-150 transition-all duration-700" />
        <div className="absolute -bottom-6 -left-6 w-16 h-16 rounded-full bg-[#EF9F27]/5 group-hover:bg-[#EF9F27]/10 group-hover:scale-150 transition-all duration-700" />

        {/* 아이콘 */}
        <div className="relative z-10 w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2 sm:mb-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#1D9E75] to-[#5DCAA5] flex items-center justify-center shadow-lg shadow-[#1D9E75]/20 group-hover:shadow-xl group-hover:shadow-[#1D9E75]/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
          <span className="material-symbols-outlined text-white text-2xl sm:text-3xl" style={{
            animation: hovered ? "iconPulse 0.6s ease-in-out" : "none",
          }}>
            {icon}
          </span>
        </div>

        {/* 숫자 카운트업 */}
        <div className="relative z-10 text-2xl sm:text-3xl font-black text-[#1D9E75] mb-0.5 sm:mb-1 tabular-nums">
          {count.toLocaleString()}{statLabel}
        </div>

        {/* 타이틀 */}
        <h3 className="relative z-10 text-[#0A1A0F] font-bold text-base sm:text-lg mb-1 sm:mb-2 group-hover:text-[#1D9E75] transition-colors duration-300">
          {title}
        </h3>

        {/* 설명 */}
        <p className="relative z-10 text-[#4a7a5e] text-xs sm:text-sm leading-relaxed">
          {desc}
        </p>

        {/* 하단 바 */}
        <div className="mt-3 sm:mt-5 h-1 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#1D9E75] to-[#5DCAA5] transition-all duration-1000 ease-out"
            style={{ width: visible === false ? "0%" : "100%" }}
          />
        </div>
      </div>

    </div>
  );
}

const features = [
  { icon: "eco", title: "신선한 재료", desc: "배송 전날 당일 조리·포장해 냉장 상태 그대로 새벽에 전해드립니다.", stat: 24, statLabel: "시간 내 조리·배송" },
  { icon: "restaurant_menu", title: "가정식 풀라인업", desc: "샐러드·간편식·반찬·국까지 한 번에 우리 집 식탁으로.", stat: 4, statLabel: "종 카테고리" },
  { icon: "dark_mode", title: "새벽 배송", desc: "밤사이 준비해서 아침 6시 전 문 앞에 도착합니다.", stat: 6, statLabel: "시 전 도착" },
  { icon: "savings", title: "상시 할인가", desc: "구독하지 않아도 정가보다 싸게, 구독하면 배송 고정·자동 결제까지 편하게.", stat: 21, statLabel: "% 할인" },
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
          <p className="text-[#EF9F27] text-lg mt-4 mb-2">Weekly 2 Order · 매주 두 번, 우리 집 식탁으로</p>
          <h2 className="text-4xl md:text-5xl font-bold text-[#0A1A0F] min-h-[1.3em]">
            {display}
            <span className={`text-[#1D9E75] transition-opacity ${showCursor ? "opacity-100" : "opacity-0"}`}>
              |
            </span>
          </h2>
          <p className="text-[#2d5a3f] mt-4">
            샐러드·간편식·반찬까지, 가정의 한 끼를 매주 화·목 새벽 문 앞으로.
          </p>
          <p className="text-[#1D9E75] font-semibold mt-2">
            배송비, 가입비 없는 실속 소비 시작
          </p>
          <div className="mt-6 inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/70 border border-[#1D9E75]/20 backdrop-blur-sm">
            <span className="text-[#1D9E75] font-black text-sm tracking-widest">W2O</span>
            <span className="w-px h-4 bg-[#1D9E75]/30" />
            <span className="text-[#2d5a3f] text-sm">
              <b className="text-[#1D9E75]">W</b>eekly <b className="text-[#1D9E75]">2</b> <b className="text-[#1D9E75]">O</b>rder
            </span>
          </div>
          <div className="mt-8 flex justify-center gap-4 flex-wrap">
            <a href="/subscribe" className="px-8 py-3 bg-[#1D9E75] text-white rounded-full font-semibold hover:bg-[#167A5B] hover:shadow-lg hover:shadow-[#1D9E75]/30 hover:-translate-y-0.5 transition-all duration-300">
              구독 신청하기
            </a>
            <a href="#weekly-menu" className="px-8 py-3 bg-[#EF9F27] text-white rounded-full font-semibold hover:bg-[#D48A1E] hover:shadow-lg hover:shadow-[#EF9F27]/30 hover:-translate-y-0.5 transition-all duration-300">
              이번 주 식단 보기
            </a>
          </div>
        </div>

        {/* 특장점 카드 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {features.map((f, i) => (
            <FeatureCard key={i} {...f} delay={i * 150} />
          ))}
        </div>
      </div>
    </section>
  );
}
