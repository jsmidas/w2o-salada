"use client";

import { useEffect, useRef } from "react";

export default function HeroSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const blurVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // 일부 모바일 브라우저는 autoplay가 차단되므로 명시적으로 play() 호출
    const tryPlay = (v: HTMLVideoElement | null) => {
      if (!v) return;
      v.muted = true;
      v.playsInline = true;
      const p = v.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          // 사용자 인터랙션 후 다시 시도
          const onTouch = () => {
            v.play().catch(() => {});
            window.removeEventListener("touchstart", onTouch);
            window.removeEventListener("click", onTouch);
          };
          window.addEventListener("touchstart", onTouch, { once: true });
          window.addEventListener("click", onTouch, { once: true });
        });
      }
    };

    tryPlay(videoRef.current);
    tryPlay(blurVideoRef.current);
  }, []);

  return (
    <section id="hero" className="relative flex w-full items-center justify-center overflow-hidden bg-brand-dark">
      {/* 배경 블러 백드롭 - 데스크톱에서만 여백을 영상 분위기로 채움 */}
      <video
        ref={blurVideoRef}
        className="absolute inset-0 hidden h-full w-full scale-110 object-cover opacity-60 blur-2xl md:block"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden
      >
        <source src="/videos/hero.mp4" type="video/mp4" />
      </video>
      {/* 블러 위 살짝 어두운 오버레이 - 메인 영상 가독성 확보 */}
      <div className="absolute inset-0 hidden bg-brand-dark/40 md:block" aria-hidden />

      {/* 메인 영상 + 모바일 카피 영역 (모바일에서 카피가 영상 아래로 약간 내려가도록 pb 추가) */}
      <div className="relative w-full md:h-[75vh] md:w-auto pb-5 md:pb-0">
        <div className="aspect-video w-full md:h-full">
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
          >
            <source src="/videos/hero.mp4" type="video/mp4" />
          </video>
        </div>

        {/* 모바일 전용 오버레이 — 영상 하단에 카피 한 줄 */}
        <MobileOverlay />
      </div>
    </section>
  );
}

/**
 * 모바일 전용 오버레이
 * 영상 맨 아래(마퀴 배너 바로 위)에 핵심 카피만 노출.
 */
function MobileOverlay() {
  const copy = ["샐러드,", "반찬,", "간편식을", "문앞에서"];

  return (
    <div className="md:hidden absolute inset-0 pointer-events-none">
      {/* 카피 영역 가독성용 그라데이션 (영상 맨 하단만 살짝) */}
      <div className="absolute inset-x-0 bottom-0 h-[28%] bg-gradient-to-t from-brand-dark via-brand-dark/55 to-transparent" />

      {/* 카피 — 영상 맨 아래 (마퀴 배너 바로 위) */}
      <div className="absolute inset-x-0 bottom-0 px-5 pb-2 text-center">
        <h1 className="text-white text-[22px] sm:text-[26px] font-black leading-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
          {copy.map((word, i) => (
            <span
              key={i}
              className="inline-block animate-copy-pop mr-1.5"
              style={{ animationDelay: `${0.3 + i * 0.1}s` }}
            >
              {word === "문앞에서" ? (
                <span className="text-brand-amber">{word}</span>
              ) : (
                word
              )}
            </span>
          ))}
        </h1>
      </div>
    </div>
  );
}
