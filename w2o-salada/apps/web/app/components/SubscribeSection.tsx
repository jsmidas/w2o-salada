import Link from "next/link";

const plans = [
  {
    name: "맛보기",
    desc: "처음이라면 한 번 체험해보세요",
    highlight: "1회 체험",
    composition: "샐러드 × 2개",
    originalPrice: "15,000원",
    priceLabel: "13,800원",
    priceDetail: "6,900원 × 2개",
    features: [
      "오늘의 샐러드 2개 배송",
      "새벽 6시 전 도착",
      "가입 없이 간편 주문",
    ],
    popular: false,
    badge: null,
    href: "/subscribe?plan=trial",
    cta: "맛보기 주문하기",
    color: "amber" as const,
  },
  {
    name: "정기구독",
    desc: "꾸준한 건강 관리의 시작",
    highlight: "주 2회 배송",
    composition: "샐러드 × 2개 × 주 2회 × 4주",
    originalPrice: "120,000원",
    priceLabel: "월 94,400원",
    priceDetail: "5,900원 × 2개 × 주 2회 × 4주",
    features: [
      "매 배송 셰프 엄선 샐러드 2개",
      "새벽 6시 전 도착",
      "개당 1,600원 할인 (21%↓)",
      "1개월 단위 자동 결제",
      "언제든 일시정지·해지 가능",
    ],
    popular: true,
    badge: "BEST",
    href: "/subscribe?plan=subscription",
    cta: "구독 신청하기",
    color: "green" as const,
  },
  {
    name: "혼합신청",
    desc: "샐러드 + 간편식을 함께",
    highlight: "자유 조합",
    composition: "샐러드 + 간편식 × 주 2회 × 4주",
    originalPrice: null,
    priceLabel: "메뉴에 따라 변동",
    priceDetail: "선택한 조합에 따라 결제 금액 결정",
    features: [
      "샐러드·간편식 자유 조합",
      "새벽 6시 전 도착",
      "샐러드 구독 할인 동일 적용",
      "간편식은 메뉴별 단가 적용",
      "1개월 단위 자동 결제",
    ],
    popular: false,
    badge: "NEW",
    href: "/subscribe?plan=mixed",
    cta: "혼합 신청하기",
    color: "amber" as const,
  },
];

export default function SubscribeSection() {
  return (
    <section id="subscribe" className="py-20 bg-gradient-to-b from-[#d4edda] to-[#e8f5ee]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="text-[#1D9E75] text-xs tracking-[0.3em] uppercase font-medium">
            SUBSCRIPTION
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0A1A0F] mt-3">
            나에게 맞는 방법으로<br />시작하세요
          </h2>
          <p className="text-[#4a7a5e] mt-3 text-sm md:text-base">
            매일 셰프가 엄선한 샐러드·간편식을 새벽에 배달합니다
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`rounded-2xl p-7 border transition-all hover:scale-[1.02] relative ${
                plan.popular
                  ? "bg-white border-[#1D9E75] shadow-lg shadow-[#1D9E75]/15"
                  : "bg-white/80 border-[#1D9E75]/15"
              }`}
            >
              {plan.badge && (
                <span className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-white text-xs font-bold rounded-full ${
                  plan.badge === "BEST" ? "bg-brand-amber" : "bg-[#1D9E75]"
                }`}>
                  {plan.badge}
                </span>
              )}
              <div className="mb-4">
                <h3 className="text-[#0A1A0F] text-xl font-bold">{plan.name}</h3>
                <p className="text-[#4a7a5e] text-sm mt-1">{plan.desc}</p>
              </div>
              <div className="mb-1">
                <span className="text-3xl font-black text-[#0A1A0F]">{plan.highlight}</span>
              </div>
              {/* 구성 */}
              <p className="text-[#1D9E75] text-sm font-semibold mb-3">{plan.composition}</p>
              {/* 가격 */}
              <div className="mb-6">
                {plan.originalPrice ? (
                  <>
                    <span className="text-gray-400 text-base line-through mr-2">{plan.originalPrice}</span>
                    <span className="text-2xl font-bold text-[#1D9E75]">{plan.priceLabel}</span>
                    <span className="ml-2 px-2 py-0.5 bg-red-50 text-red-500 text-xs font-bold rounded">21%</span>
                  </>
                ) : (
                  <span className="text-2xl font-bold text-[#EF9F27]">{plan.priceLabel}</span>
                )}
                <p className="text-[#7aaa90] text-xs mt-1">{plan.priceDetail}</p>
              </div>
              <ul className="space-y-2.5 mb-8">
                {plan.features.map((f, fi) => (
                  <li key={fi} className="flex items-center gap-2 text-[#2d5a3f] text-sm">
                    <span className="material-symbols-outlined text-[#1D9E75] text-lg">
                      check_circle
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className="block text-center py-3 rounded-full font-semibold transition bg-[#1D9E75] text-white hover:bg-[#167A5B]"
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* 간편식 안내 */}
        <div className="mt-8 max-w-5xl mx-auto bg-white/60 backdrop-blur-sm rounded-xl border border-[#EF9F27]/20 p-5 flex items-start gap-4">
          <span className="material-symbols-outlined text-[#EF9F27] text-2xl shrink-0 mt-0.5">info</span>
          <div>
            <p className="text-[#0A1A0F] font-semibold text-sm">간편식(샌드위치, 핫도그 등) 선택 시</p>
            <p className="text-[#4a7a5e] text-sm mt-1">
              간편식은 메뉴에 따라 단가가 다를 수 있으며, 선택한 메뉴 조합에 따라 결제 금액이 변동됩니다.
              식단 선택 화면에서 정확한 금액을 확인하실 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
