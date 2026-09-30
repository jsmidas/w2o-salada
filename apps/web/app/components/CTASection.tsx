import Link from "next/link";

export default function CTASection() {
  return (
    <section className="py-20 bg-brand-dark">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
          다음 배송일 새벽,<br />문 앞에서 만나요
        </h2>
        <p className="text-gray-400 mt-4 text-base md:text-lg">
          화·목 새벽, 신선한 샐러드·간편식·반찬이 문 앞에 도착합니다
        </p>
        <div className="mt-8 flex justify-center gap-4 flex-wrap">
          <Link
            href="/subscribe"
            className="px-10 py-4 bg-brand-green text-white rounded-full font-bold text-lg hover:bg-[#167A5B] hover:shadow-lg hover:shadow-brand-green/30 hover:-translate-y-0.5 transition-all duration-300"
          >
            구독 신청하기
          </Link>
          <Link
            href="/#weekly-menu"
            className="px-10 py-4 bg-brand-amber text-white rounded-full font-bold text-lg hover:opacity-90 hover:-translate-y-0.5 transition-all duration-300"
          >
            이번 주 메뉴 보기
          </Link>
        </div>
      </div>
    </section>
  );
}
