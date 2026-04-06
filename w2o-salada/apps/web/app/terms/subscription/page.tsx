import Link from "next/link";

export default function SubscriptionTermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5">
            <span className="text-lg font-black text-[#1D9E75]">W2O</span>
            <span className="text-xs text-gray-400 tracking-widest">SALADA</span>
          </Link>
          <Link href="/" className="text-gray-400 text-sm hover:text-gray-600 transition">닫기</Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">구독 서비스 이용약관</h1>
        <p className="text-gray-400 text-sm mb-8">최종 수정일: 2026년 4월 7일</p>

        <div className="prose prose-sm prose-gray max-w-none space-y-8">
          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">제1조 (목적)</h2>
            <p className="text-gray-600 leading-relaxed">
              본 약관은 W2O SALADA(이하 &quot;회사&quot;)가 제공하는 정기구독 서비스(이하 &quot;서비스&quot;)의
              이용 조건 및 절차, 회사와 이용자의 권리·의무를 규정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">제2조 (구독 유형 및 조건)</h2>
            <ol className="list-decimal pl-5 space-y-2 text-gray-600">
              <li>
                <strong>정기구독 / 혼합신청:</strong> 6주 이내 최소 8회 이상 배송을 주문하여야 구독 할인 단가가 적용됩니다.
              </li>
              <li>
                <strong>맛보기:</strong> 1회 이상 단건 주문이며, 맛보기 단가(개당 6,900원)가 적용됩니다.
              </li>
              <li>
                구독 할인 단가는 샐러드 기준 개당 5,900원이며, 간편식은 메뉴별 단가가 적용됩니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">제3조 (결제)</h2>
            <ol className="list-decimal pl-5 space-y-2 text-gray-600">
              <li>정기구독 및 혼합신청은 월 단위 자동결제로 진행됩니다.</li>
              <li>결제일은 구독 시작일 기준이며, 매월 동일일에 자동 청구됩니다.</li>
              <li>결제 수단은 신용카드(빌링키) 방식이며, 카드 변경은 마이페이지에서 가능합니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">제4조 (배송)</h2>
            <ol className="list-decimal pl-5 space-y-2 text-gray-600">
              <li>배송은 주 2회(화·목) 새벽 배송으로 진행되며, 오전 6시 이전 도착을 목표로 합니다.</li>
              <li>주문 마감은 배송일 전일(24시간 전)이며, 마감 이후에는 해당 배송일 주문을 변경할 수 없습니다.</li>
              <li>이용자는 특정 배송일을 건너뛸 수 있으며, 건너뛴 배송일은 결제 금액에서 제외됩니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">제5조 (구독 일시정지 및 재개)</h2>
            <ol className="list-decimal pl-5 space-y-2 text-gray-600">
              <li>이용자는 마이페이지에서 언제든 구독을 일시정지할 수 있습니다.</li>
              <li>일시정지 중에는 자동결제가 중단되며, 배송도 중단됩니다.</li>
              <li>재개 시 다음 결제 주기부터 서비스가 다시 시작됩니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">제6조 (중도해지 및 환불)</h2>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-3">
              <p className="text-red-700 text-sm font-semibold mb-1">중도해지 시 정가 기준 정산</p>
              <p className="text-red-600 text-sm">
                구독 기간 중 해지하는 경우, 이미 배송 완료된 상품은 정가(개당 7,500원) 기준으로 재정산하며,
                기결제 금액과의 차액을 공제한 후 잔액을 환불합니다.
              </p>
            </div>
            <ol className="list-decimal pl-5 space-y-2 text-gray-600">
              <li>이용자는 언제든 구독을 해지할 수 있습니다.</li>
              <li>
                중도해지 시, 배송 완료된 상품은 정가(샐러드 기준 개당 7,500원)로 재정산합니다.
                <br />
                <span className="text-xs text-gray-500">
                  예시: 구독 단가 5,900원으로 4회 배송(2개씩) 후 해지 시<br />
                  → 정가 정산: 8개 × 7,500원 = 60,000원<br />
                  → 이미 결제: 8개 × 5,900원 = 47,200원<br />
                  → 차액 12,800원 공제 후 나머지 환불
                </span>
              </li>
              <li>배송 전 상품에 대해서는 전액 환불됩니다.</li>
              <li>환불은 결제 수단으로 7영업일 이내 처리됩니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">제7조 (메뉴 선택 및 변경)</h2>
            <ol className="list-decimal pl-5 space-y-2 text-gray-600">
              <li>&quot;직접 골라먹기&quot; 이용자는 각 배송일의 메뉴를 직접 선택합니다.</li>
              <li>&quot;알아서 배송&quot; 이용자는 회사가 엄선한 메뉴로 자동 구성됩니다.</li>
              <li>메뉴 선택/변경은 해당 배송일 마감(전일 24시) 전까지 가능합니다.</li>
              <li>마감 시까지 메뉴를 선택하지 않은 배송일은 회사가 자동 배정합니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">제8조 (알림)</h2>
            <ol className="list-decimal pl-5 space-y-2 text-gray-600">
              <li>회사는 주문 종료 7일 전 카카오 알림톡을 통해 메뉴 선택을 안내합니다.</li>
              <li>결제 완료, 배송 출발, 배송 완료 시 알림톡이 발송됩니다.</li>
              <li>결제 실패 시 알림톡 및 SMS로 안내하며, 3회 실패 시 구독이 자동 일시정지됩니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">제9조 (면책)</h2>
            <ol className="list-decimal pl-5 space-y-2 text-gray-600">
              <li>천재지변, 기상 악화 등 불가항력 사유로 배송이 지연될 수 있습니다.</li>
              <li>이용자의 부정확한 배송지 정보로 인한 배송 실패는 회사가 책임지지 않습니다.</li>
            </ol>
          </section>

          <section className="border-t pt-6">
            <p className="text-gray-400 text-xs">
              본 약관은 2026년 4월 7일부터 시행됩니다.<br />
              문의: admin@w2o.kr | 다함푸드 주식회사
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
