export default function HeroSection() {
  return (
    <section id="hero" className="relative flex w-full items-center justify-center overflow-hidden bg-brand-dark">
      {/* 배경 블러 백드롭 - 데스크톱에서만 여백을 영상 분위기로 채움 */}
      <video
        className="absolute inset-0 hidden h-full w-full scale-110 object-cover opacity-60 blur-2xl md:block"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden
      >
        <source src="/videos/hero.mp4" type="video/mp4" />
      </video>
      {/* 블러 위 살짝 어두운 오버레이 - 메인 영상 가독성 확보 */}
      <div className="absolute inset-0 hidden bg-brand-dark/40 md:block" aria-hidden />

      {/* 메인 영상 */}
      <div className="relative aspect-video w-full md:h-[75vh] md:w-auto">
        <video
          className="w-full h-full object-contain"
          autoPlay
          muted
          loop
          playsInline
        >
          <source src="/videos/hero.mp4" type="video/mp4" />
        </video>
      </div>
    </section>
  );
}
