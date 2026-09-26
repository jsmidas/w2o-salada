const steps = [
  { icon: "shopping_cart", time: "전날 PM 2:00", label: "주문 마감", desc: "배송 전날 오후 2시" },
  { icon: "blender", time: "전날 오후", label: "신선 조리", desc: "조리·포장 후 냉장 보관" },
  { icon: "local_shipping", time: "AM 3:00", label: "냉장 출발", desc: "냉장 차량 배송 시작" },
  { icon: "home", time: "AM 6:00", label: "문 앞 도착", desc: "문 앞에서 만나요" },
];

export default function DeliverySection() {
  return (
    <section id="delivery" className="py-10 bg-gradient-to-b from-[#f0faf4] to-[#e2f5ea]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-[#0A1A0F] inline-flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1D9E75] text-3xl">local_shipping</span>
            새벽배송 프로세스
          </h3>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-3">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex items-center gap-4 bg-white rounded-xl px-6 py-4 shadow-sm border border-[#1D9E75]/10 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1D9E75] to-[#5DCAA5] flex items-center justify-center shrink-0 shadow shadow-[#1D9E75]/20">
                  <span className="material-symbols-outlined text-white text-2xl">{step.icon}</span>
                </div>
                <div>
                  <div className="text-[#EF9F27] font-extrabold text-xl leading-tight">{step.time}</div>
                  <div className="text-[#0A1A0F] font-semibold text-sm">{step.label}</div>
                </div>
              </div>
              {i < steps.length - 1 && (
                <span className="material-symbols-outlined text-[#1D9E75]/40 text-xl hidden md:block">arrow_forward</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
