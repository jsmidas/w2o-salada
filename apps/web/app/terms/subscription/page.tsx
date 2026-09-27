import Link from "next/link";
import { getRefundFeePercent } from "../../lib/refund-policy";

export const dynamic = "force-dynamic";

export default async function SubscriptionTermsPage() {
  const feePercent = await getRefundFeePercent();
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
        <p className="text-gray-400 text-sm mb-8">최종 수정일: 2026년 9월 28일</p>

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
              <li>이용자는 마이페이지에서 언제든 구독을 일시정지할 수 있으며, 일시정지 중에는 자동결제와 배송이 중단됩니다.</li>
              <li>
                일시정지 시점에 이미 결제되었으나 아직 주문 마감(배송 전날 오후 2시)이 지나지 않은 배송분(이하 &quot;남은 배송분&quot;)은
                이용자가 다음 중 하나를 선택합니다.
                <ul className="list-disc pl-5 mt-1 space-y-1 text-sm">
                  <li><strong>크레딧 적립:</strong> 남은 배송분 금액을 크레딧으로 적립하고, 재개 후 다음 자동결제 금액에서 차감합니다.</li>
                  <li><strong>주기 연장:</strong> 남은 배송분을 그대로 두고, 재개 시 정지 기간 동안 받지 못한 횟수만큼 배송일을 구독 주기 뒤로 이어 붙입니다. 이 경우 다음 결제일도 같은 기간만큼 연기됩니다.</li>
                </ul>
              </li>
              <li>주문 마감이 지난 배송분은 이미 조리·포장에 들어간 것으로 정상 배송되며, 정산 대상에 포함되지 않습니다.</li>
              <li>크레딧은 현금으로 지급되지 않으며 다음 자동결제에서만 차감됩니다. 다만 구독 해지 시에는 제6조에 따라 환불 신청에 포함됩니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">제6조 (중도해지 및 환불)</h2>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-3">
              <p className="text-amber-800 text-sm font-semibold mb-1">환불은 신청 → 담당자 검토 → 처리 순으로 진행됩니다</p>
              <p className="text-amber-700 text-sm">
                해지 시 남은 배송분과 크레딧은 자동으로 환불되지 않고 환불 신청으로 접수됩니다. 담당자가 신청 내용을 확인한 뒤
                아래 수수료를 공제한 금액을 결제 수단으로 환불합니다.
              </p>
            </div>
            <ol className="list-decimal pl-5 space-y-2 text-gray-600">
              <li>이용자는 언제든 구독을 해지할 수 있으며, 해지 시 해지 사유를 선택합니다. 해지 즉시 남은 배송분의 배송과 자동결제가 중단됩니다.</li>
              <li>
                <strong>환불 대상 금액</strong>은 해지 시점의 남은 배송분(주문 마감 전 배송분) 금액과 보유 크레딧의 합계입니다.
                주문 마감이 지난 배송분은 정상 배송되며 환불 대상이 아닙니다.
              </li>
              <li>
                <strong>취소 수수료:</strong> 회사는 환불 대상 금액의 <strong>{feePercent}%</strong>를 취소 수수료로 공제하고 나머지를 환불합니다.
                수수료에는 결제대행사(PG) 취소 수수료와 결제 취소 처리 비용이 포함됩니다.
                <br />
                <span className="text-xs text-gray-500">
                  예시: 환불 대상 금액 47,200원 → 수수료 {feePercent}% {Math.round((47200 * feePercent) / 100).toLocaleString()}원 공제 → {(47200 - Math.round((47200 * feePercent) / 100)).toLocaleString()}원 환불
                </span>
                <br />
                공제된 수수료와 환불액은 마이페이지 환불 신청 현황에서 확인할 수 있습니다.
              </li>
              <li>회사는 신청일로부터 7영업일 이내에 검토를 마치고, 승인된 금액을 결제 수단으로 환불합니다. 카드사 사정에 따라 실제 입금은 3~5영업일이 더 걸릴 수 있습니다.</li>
              <li>상품 하자, 배송 누락 등 회사의 책임으로 인한 환불은 수수료 없이 전액 환불하며, 이 경우 고객센터로 접수해 주시기 바랍니다.</li>
              <li>환불 신청이 거절되는 경우 회사는 그 사유를 마이페이지 환불 신청 현황에 기재합니다.</li>
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
              문의: dahamfood@dahamfood.co.kr | 다함푸드 주식회사
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
