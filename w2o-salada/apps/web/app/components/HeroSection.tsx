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

        {/* CTA 오버레이 */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-10 md:pb-16 bg-gradient-to-t from-black/60 via-transparent to-transparent">
          <p className="text-white/80 text-sm md:text-base mb-4 tracking-wide">
            매일 새벽, 신선한 2종이 문 앞에 도착합니다
          </p>
          <div className="flex gap-3">
            <a
              href="/subscribe?plan=subscription"
              className="px-6 py-3 md:px-8 md:py-3.5 bg-brand-green text-white rounded-full font-semibold text-sm md:text-base hover:bg-[#167A5B] hover:shadow-lg hover:shadow-brand-green/30 hover:-translate-y-0.5 transition-all duration-300"
            >
              구독 신청하기
            </a>
            <a
              href="/subscribe?plan=trial"
              className="px-6 py-3 md:px-8 md:py-3.5 bg-white/20 backdrop-blur-sm text-white border border-white/30 rounded-full font-semibold text-sm md:text-base hover:bg-white/30 hover:-translate-y-0.5 transition-all duration-300"
            >
              맛보기 주문
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
