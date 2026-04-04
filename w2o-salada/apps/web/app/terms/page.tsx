import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "이용약관 - W2O SALADA",
  description: "W2O SALADA 서비스 이용약관",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          홈으로 돌아가기
        </Link>

        {/* Title */}
        <h1 className="mb-2 text-3xl font-bold tracking-tight">이용약관</h1>
        <p className="mb-10 text-sm text-gray-500">시행일: 2026년 4월 5일</p>

        <div className="space-y-10 text-[15px] leading-relaxed text-gray-700">
          {/* 제1조 목적 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">제1조 (목적)</h2>
            <p>
              이 약관은 주식회사 다함푸드(이하 &quot;회사&quot;)가 운영하는 W2O SALADA(더블유 투 오
              샐러다) 서비스(이하 &quot;서비스&quot;)의 이용과 관련하여 회사와 이용자 간의 권리·의무 및
              책임 사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          {/* 제2조 용어 정의 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">제2조 (용어의 정의)</h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                <strong>&quot;서비스&quot;</strong>란 회사가 운영하는 웹사이트(https://w2o.co.kr) 및
                관련 애플리케이션을 통해 제공하는 샐러드 새벽배송, 정기구독, 상품 판매 등 일체의
                서비스를 말합니다.
              </li>
              <li>
                <strong>&quot;이용자&quot;</strong>란 이 약관에 따라 회사가 제공하는 서비스를 이용하는
                회원 및 비회원을 말합니다.
              </li>
              <li>
                <strong>&quot;회원&quot;</strong>이란 회사에 개인정보를 제공하여 회원등록을 한 자로서,
                서비스를 계속적으로 이용할 수 있는 자를 말합니다.
              </li>
              <li>
                <strong>&quot;정기구독&quot;</strong>이란 회원이 선택한 구독 플랜에 따라 정해진
                주기(매일/격일/주 3회 등)로 상품을 자동 결제·배송받는 서비스를 말합니다.
              </li>
              <li>
                <strong>&quot;새벽배송&quot;</strong>이란 전날 마감 시간(오후 11시) 이전에 주문된 상품을
                익일 이른 아침(오전 7시 이전)까지 배송하는 서비스를 말합니다.
              </li>
              <li>
                <strong>&quot;빌링키&quot;</strong>란 정기구독 자동결제를 위해 결제대행사(토스페이먼츠)를
                통해 발급받은 카드 인증 정보를 말합니다.
              </li>
            </ol>
          </section>

          {/* 제3조 약관의 효력 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              제3조 (약관의 효력 및 변경)
            </h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                이 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이
                발생합니다.
              </li>
              <li>
                회사는 관련 법령을 위배하지 않는 범위에서 이 약관을 변경할 수 있으며, 변경 시
                적용일자 및 변경 사유를 명시하여 현행 약관과 함께 서비스 초기 화면에 적용일자 7일
                전부터 공지합니다. 다만, 이용자에게 불리한 약관 변경의 경우 30일 전부터 공지합니다.
              </li>
              <li>
                이용자가 변경된 약관에 동의하지 않는 경우 서비스 이용을 중단하고 회원 탈퇴를 할 수
                있습니다. 변경된 약관의 효력 발생일 이후에도 서비스를 계속 이용하는 경우 변경된
                약관에 동의한 것으로 봅니다.
              </li>
            </ol>
          </section>

          {/* 제4조 서비스 이용 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">제4조 (서비스의 제공)</h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                회사는 다음의 서비스를 제공합니다.
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>샐러드 및 건강식 상품의 판매</li>
                  <li>새벽배송 서비스</li>
                  <li>정기구독(자동결제·자동배송) 서비스</li>
                  <li>상품 정보 제공 및 주문·배송 관련 알림 서비스</li>
                  <li>기타 회사가 정하는 서비스</li>
                </ul>
              </li>
              <li>
                서비스는 연중무휴, 1일 24시간 제공을 원칙으로 합니다. 다만, 시스템 점검 등의
                필요에 의한 경우 사전 공지 후 일시적으로 중단할 수 있습니다.
              </li>
              <li>
                새벽배송 서비스는 회사가 지정한 배송 가능 지역에 한하여 제공되며, 배송 가능 지역은
                서비스 내에서 확인할 수 있습니다.
              </li>
            </ol>
          </section>

          {/* 제5조 회원가입 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              제5조 (회원가입 및 탈퇴)
            </h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                이용자는 회사가 정한 양식에 따라 회원정보를 기입하고 이 약관에 동의한다는 의사표시를
                함으로써 회원가입을 신청합니다.
              </li>
              <li>
                회원가입은 이메일 가입 또는 소셜 로그인(카카오, 네이버, 구글)을 통해 할 수 있습니다.
              </li>
              <li>
                회사는 다음 각 호에 해당하는 경우 회원가입을 거절하거나 회원 자격을 제한·상실시킬 수
                있습니다.
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>타인의 명의를 이용한 경우</li>
                  <li>허위 정보를 기재한 경우</li>
                  <li>이 약관을 위반하여 회원 자격을 상실한 적이 있는 경우</li>
                  <li>기타 회원으로 등록하는 것이 서비스 운영에 현저히 지장을 초래하는 경우</li>
                </ul>
              </li>
              <li>
                회원은 언제든지 서비스 내 마이페이지 또는 고객센터를 통해 탈퇴를 요청할 수 있으며,
                회사는 즉시 회원 탈퇴를 처리합니다.
              </li>
              <li>
                회원 탈퇴 시 진행 중인 주문이 있는 경우 해당 주문의 배송이 완료된 후 탈퇴가
                처리됩니다. 활성화된 정기구독이 있는 경우 구독을 먼저 해지한 후 탈퇴할 수 있습니다.
              </li>
            </ol>
          </section>

          {/* 제6조 주문 및 결제 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">제6조 (주문 및 결제)</h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                이용자는 서비스에서 다음의 방법으로 주문할 수 있습니다.
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>상품 선택 후 장바구니 담기</li>
                  <li>배송지 정보 입력</li>
                  <li>결제수단 선택 및 결제</li>
                </ul>
              </li>
              <li>
                결제는 토스페이먼츠를 통해 처리되며, 신용카드, 체크카드 등 회사가 정한 결제수단을
                이용할 수 있습니다.
              </li>
              <li>
                주문 확인 후 회사는 카카오 알림톡 또는 SMS를 통해 주문 접수 사실을 통지합니다.
              </li>
              <li>
                회사는 다음 각 호에 해당하는 경우 주문을 거절할 수 있습니다.
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>결제가 정상적으로 이루어지지 않은 경우</li>
                  <li>배송 불가 지역으로의 주문인 경우</li>
                  <li>재고 부족 등으로 상품 공급이 어려운 경우</li>
                </ul>
              </li>
            </ol>
          </section>

          {/* 제7조 환불 및 취소 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              제7조 (주문 취소 및 환불)
            </h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                이용자는 상품이 &quot;상품 준비 중&quot; 상태로 전환되기 전까지 주문을 취소할 수
                있습니다.
              </li>
              <li>
                새벽배송 특성상, 당일 오후 11시(주문 마감) 이후에는 이미 조리·포장이 시작되므로
                주문 취소가 불가할 수 있습니다.
              </li>
              <li>
                주문 취소 시 결제 금액은 원래 결제수단으로 환불되며, 환불 소요 기간은 결제수단에
                따라 다를 수 있습니다(카드 결제: 취소 후 3~5 영업일).
              </li>
              <li>
                상품 하자(파손, 변질 등)가 있는 경우, 배송 완료 후 24시간 이내에 사진과 함께
                고객센터로 연락하시면 교환 또는 환불 처리해 드립니다.
              </li>
              <li>
                신선식품 특성상 단순 변심에 의한 반품·환불은 불가합니다. 다만, 상품이 표시·광고
                내용과 다르거나 계약 내용과 다르게 이행된 경우에는 수령일로부터 3개월 이내,
                그 사실을 안 날로부터 30일 이내에 환불을 요청할 수 있습니다.
              </li>
            </ol>
          </section>

          {/* 제8조 배송 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">제8조 (배송)</h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                새벽배송은 오후 11시 이전 주문 건에 대해 익일 오전 7시 이전 배송을 원칙으로 합니다.
              </li>
              <li>
                배송은 회사가 지정한 배송 가능 지역에 한하며, 자세한 배송 가능 지역은 서비스 내에서
                확인할 수 있습니다.
              </li>
              <li>
                천재지변, 폭설, 폭우, 도로 통제 등 불가항력적인 사유로 인해 배송이 지연될 수
                있으며, 이 경우 회사는 이용자에게 사전에 안내합니다.
              </li>
              <li>
                배송은 문 앞 배송을 원칙으로 하며, 이용자는 주문 시 배송 메모(공동현관 비밀번호,
                배송 위치 지정 등)를 기재할 수 있습니다.
              </li>
              <li>
                배송 완료 후 이용자의 부재, 잘못된 주소 기재, 공동현관 출입 불가 등의 사유로 인한
                상품 변질·분실에 대해서는 회사가 책임지지 않습니다.
              </li>
              <li>
                배송 상태는 서비스 내 마이페이지에서 확인할 수 있으며, 배송 출발 및 완료 시 카카오
                알림톡으로 안내합니다.
              </li>
            </ol>
          </section>

          {/* 제9조 정기구독 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">제9조 (정기구독)</h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                정기구독은 회원이 선택한 구독 플랜(메뉴 구성, 배송 주기, 배송 요일 등)에 따라
                자동으로 결제 및 배송이 이루어지는 서비스입니다.
              </li>
              <li>
                정기구독 신청 시 토스페이먼츠를 통해 빌링키가 발급되며, 이를 통해 예정된 결제일에
                자동결제가 이루어집니다.
              </li>
              <li>
                자동결제는 매 결제일 오전 9시에 실행됩니다. 결제 실패 시 4시간 간격으로 최대 3회
                재시도하며, 3회 모두 실패할 경우 해당 구독은 일시정지됩니다.
              </li>
              <li>
                회원은 언제든지 정기구독의 메뉴 구성, 배송 주기를 변경하거나, 구독을 일시정지·해지할
                수 있습니다. 단, 이미 결제가 완료된 건에 대해서는 변경이 적용되지 않습니다.
              </li>
              <li>
                결제 카드 변경은 서비스 내 구독 관리 페이지에서 새로운 카드를 등록하여 변경할 수
                있습니다.
              </li>
              <li>
                구독 해지 시 이미 결제된 잔여 배송분은 정상 배송되며, 다음 결제일부터 자동결제가
                중지됩니다.
              </li>
            </ol>
          </section>

          {/* 제10조 서비스 중단 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              제10조 (서비스의 변경 및 중단)
            </h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                회사는 운영상·기술상 필요에 의해 제공하고 있는 서비스의 전부 또는 일부를 변경하거나
                중단할 수 있습니다.
              </li>
              <li>
                서비스의 내용, 이용방법, 이용시간에 대하여 변경이 있는 경우에는 변경 사유, 변경될
                서비스의 내용 및 제공일자 등을 변경 전 서비스 초기 화면에 게시합니다.
              </li>
              <li>
                회사는 무료로 제공되는 서비스의 일부 또는 전부를 회사의 정책 및 운영의 필요상
                수정, 중단, 변경할 수 있으며, 이에 대하여 관련 법령에 특별한 규정이 없는 한
                이용자에게 별도의 보상을 하지 않습니다.
              </li>
            </ol>
          </section>

          {/* 제11조 이용자의 의무 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              제11조 (이용자의 의무)
            </h2>
            <p>이용자는 다음 행위를 하여서는 안 됩니다.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>회원가입 또는 변경 시 허위 내용을 등록하는 행위</li>
              <li>타인의 정보를 도용하는 행위</li>
              <li>회사가 게시한 정보를 변경하는 행위</li>
              <li>회사가 정한 정보 이외의 정보를 송신하거나 게시하는 행위</li>
              <li>회사 및 기타 제3자의 저작권 등 지적재산권을 침해하는 행위</li>
              <li>회사 및 기타 제3자의 명예를 손상시키거나 업무를 방해하는 행위</li>
              <li>
                서비스를 이용하여 얻은 정보를 회사의 사전 승낙 없이 복제, 유통, 상업적으로
                이용하는 행위
              </li>
              <li>부정한 방법으로 할인, 쿠폰, 적립금 등을 취득·사용하는 행위</li>
            </ul>
          </section>

          {/* 제12조 면책 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">제12조 (면책)</h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                회사는 천재지변, 전쟁, 기간통신사업자의 서비스 중지 등 불가항력적인 사유로 인하여
                서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임이 면제됩니다.
              </li>
              <li>
                회사는 이용자의 귀책사유로 인한 서비스 이용의 장애에 대하여는 책임을 지지 않습니다.
              </li>
              <li>
                회사는 이용자가 서비스를 통해 기대하는 수익을 얻지 못하거나 서비스 자료에 대한
                취사선택 또는 이용으로 발생하는 손해에 대해서는 책임을 지지 않습니다.
              </li>
              <li>
                회사는 이용자가 게재한 정보, 자료, 사실의 신뢰도, 정확성 등의 내용에 관해서는
                책임을 지지 않습니다.
              </li>
            </ol>
          </section>

          {/* 제13조 분쟁 해결 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">제13조 (분쟁 해결)</h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                회사는 이용자가 제기하는 정당한 의견이나 불만을 반영하고, 그 피해를 보상 처리하기
                위하여 고객센터를 운영합니다.
              </li>
              <li>
                회사와 이용자 간에 발생한 분쟁에 관한 소송은 대한민국 법을 적용하며, 회사의
                본사 소재지를 관할하는 법원을 전속 관할 법원으로 합니다.
              </li>
              <li>
                회사와 이용자 간에 제기된 소송에는 대한민국 법을 적용합니다.
              </li>
            </ol>
          </section>

          {/* 부칙 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">부칙</h2>
            <p>이 약관은 2026년 4월 5일부터 시행합니다.</p>
          </section>

          {/* 고객센터 안내 */}
          <section className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-sm">
            <p className="mb-2 font-semibold text-gray-900">고객센터</p>
            <ul className="space-y-1 text-gray-600">
              <li>상호: 주식회사 다함푸드</li>
              <li>브랜드: W2O SALADA (더블유 투 오 샐러다)</li>
              <li>대표: OOO</li>
              <li>사업자등록번호: 452-87-02160</li>
              <li>소재지: 대구광역시 달서구 성서공단로 332-10, 2층</li>
              <li>전화: 053-721-7794</li>
              <li>이메일: hello@w2osalada.co.kr</li>
              <li>웹사이트: <a href="https://w2o.co.kr" className="text-emerald-600 underline" target="_blank" rel="noopener noreferrer">https://w2o.co.kr</a></li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
