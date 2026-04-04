import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "서비스 소개서 - W2O SALADA",
  description: "W2O SALADA 프리미엄 샐러드 새벽배송 서비스 소개서",
};

export default function AboutServicePage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-[800px] px-10 py-16 print:px-0 print:py-0">
        {/* Header */}
        <header className="mb-12 border-b-2 border-gray-800 pb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            서비스 소개서
          </h1>
          <p className="mt-3 text-xl font-semibold text-green-700">
            W2O SALADA (더블유 투 오 샐러다)
          </p>
          <p className="mt-1 text-sm text-gray-500">
            주식회사 다함푸드 | 사업자등록번호 452-87-02160
          </p>
          <p className="mt-1 text-sm text-gray-500">
            작성일: 2026년 4월 5일
          </p>
        </header>

        {/* 1. 서비스 개요 */}
        <Section number={1} title="서비스 개요">
          <p className="mb-4 leading-relaxed">
            <strong>W2O SALADA</strong>는 주식회사 다함푸드에서 운영하는{" "}
            <strong>프리미엄 샐러드 새벽배송 서비스</strong>입니다.
          </p>
          <p className="mb-4 leading-relaxed">
            브랜드 슬로건 <em>&ldquo;Wake up 2 go Out&rdquo;</em> &mdash;
            일어나면 이미 준비된 건강한 하루를 지향하며, 매일 신선하게 조리된
            샐러드를 고객의 문 앞까지 새벽에 배송합니다.
          </p>
          <ul className="ml-5 list-disc space-y-2 text-gray-700">
            <li>
              <strong>주문 마감:</strong> PM 11:00
            </li>
            <li>
              <strong>배송 완료:</strong> AM 6:00 문 앞 도착
            </li>
            <li>
              <strong>서비스 지역:</strong> 대구/경북 지역 새벽배송
            </li>
            <li>
              <strong>서비스 URL:</strong>{" "}
              <a
                href="https://w2o.co.kr"
                className="text-blue-600 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://w2o.co.kr
              </a>
            </li>
          </ul>
        </Section>

        {/* 2. 주요 서비스 */}
        <Section number={2} title="주요 서비스">
          <h3 className="mb-3 text-base font-semibold text-gray-800">
            2-1. 메뉴 구성
          </h3>
          <p className="mb-4 leading-relaxed text-gray-700">
            샐러드, 그레인볼, 프로틴, 주스/음료 등 <strong>30종 이상</strong>의
            다양한 건강 메뉴를 제공합니다. 모든 메뉴는 HACCP 인증 시설에서
            당일 조리하여 신선도를 보장합니다.
          </p>

          <h3 className="mb-3 text-base font-semibold text-gray-800">
            2-2. 주문 방식
          </h3>
          <ul className="mb-4 ml-5 list-disc space-y-1 text-gray-700">
            <li>
              <strong>단건 주문:</strong> 원하는 메뉴를 개별 선택하여 주문
            </li>
            <li>
              <strong>정기구독:</strong> 주 3회 / 주 5회 / 매일 배송 주기 선택
              가능
            </li>
          </ul>

          <h3 className="mb-3 text-base font-semibold text-gray-800">
            2-3. 구독 플랜 및 가격
          </h3>
          <table className="mb-4 w-full border-collapse border border-gray-300 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">
                  플랜
                </th>
                <th className="border border-gray-300 px-4 py-2 text-left">
                  구성
                </th>
                <th className="border border-gray-300 px-4 py-2 text-right">
                  월 가격
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-2 font-medium">
                  라이트
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  주 3회 배송
                </td>
                <td className="border border-gray-300 px-4 py-2 text-right">
                  89,000원
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2 font-medium">
                  레귤러
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  주 5회 배송
                </td>
                <td className="border border-gray-300 px-4 py-2 text-right">
                  139,000원
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2 font-medium">
                  프리미엄
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  매일 배송
                </td>
                <td className="border border-gray-300 px-4 py-2 text-right">
                  189,000원
                </td>
              </tr>
            </tbody>
          </table>

          <h3 className="mb-3 text-base font-semibold text-gray-800">
            2-4. 결제 수단
          </h3>
          <p className="leading-relaxed text-gray-700">
            토스페이먼츠 PG 연동을 통한 온라인 결제(신용카드, 간편결제 등)를
            지원하며, 정기구독의 경우 빌링키 기반 자동결제를 제공합니다.
          </p>
        </Section>

        {/* 3. 카카오 로그인 필요 사유 */}
        <Section number={3} title="카카오 로그인 필요 사유">
          <p className="mb-4 leading-relaxed text-gray-700">
            W2O SALADA는 고객 편의성 향상 및 원활한 서비스 제공을 위해
            카카오 로그인 연동을 필요로 합니다. 구체적인 사유는 다음과
            같습니다.
          </p>
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="w-8 border border-gray-300 px-4 py-2 text-center">
                  #
                </th>
                <th className="border border-gray-300 px-4 py-2 text-left">
                  사유
                </th>
                <th className="border border-gray-300 px-4 py-2 text-left">
                  상세 설명
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  1
                </td>
                <td className="border border-gray-300 px-4 py-2 font-medium">
                  간편 회원가입/로그인
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  별도의 회원가입 절차 없이 카카오 계정으로 간편하게 로그인하여
                  빠른 주문이 가능하도록 고객 편의를 제공합니다.
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2 text-center">
                  2
                </td>
                <td className="border border-gray-300 px-4 py-2 font-medium">
                  카카오톡 알림톡 발송
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  주문 확인, 결제 완료, 배송 출발, 배송 완료 등 주요 단계별
                  알림톡을 통해 고객에게 실시간 배송 정보를 안내합니다.
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  3
                </td>
                <td className="border border-gray-300 px-4 py-2 font-medium">
                  카카오톡 채널 고객 상담
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  카카오톡 채널을 통한 1:1 고객 상담을 제공하여 주문 문의,
                  배송 관련 문의 등을 신속하게 처리합니다.
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2 text-center">
                  4
                </td>
                <td className="border border-gray-300 px-4 py-2 font-medium">
                  배송지 정보 연동
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  카카오 계정에 등록된 배송지 정보를 활용하여 주문 시 배송지
                  자동입력 기능을 제공, 주문 편의를 향상시킵니다.
                </td>
              </tr>
            </tbody>
          </table>
        </Section>

        {/* 4. 수집하는 개인정보 및 이용목적 */}
        <Section number={4} title="수집하는 개인정보 및 이용목적">
          <p className="mb-4 leading-relaxed text-gray-700">
            카카오 로그인 시 아래 항목을 수집하며, 명시된 목적 이외의 용도로는
            사용하지 않습니다. 수집된 개인정보는 「개인정보 보호법」에 따라
            안전하게 관리됩니다.
          </p>
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">
                  수집 항목
                </th>
                <th className="border border-gray-300 px-4 py-2 text-center">
                  필수/선택
                </th>
                <th className="border border-gray-300 px-4 py-2 text-left">
                  이용 목적
                </th>
                <th className="border border-gray-300 px-4 py-2 text-left">
                  보유 기간
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-2 font-medium">
                  이메일
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  필수
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  회원 식별, 주문 확인 메일 발송
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  회원 탈퇴 시까지
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2 font-medium">
                  닉네임(이름)
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  필수
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  배송 수령인 정보, 서비스 내 표시
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  회원 탈퇴 시까지
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2 font-medium">
                  프로필 사진
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  선택
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  서비스 내 프로필 이미지 표시
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  회원 탈퇴 시까지
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2 font-medium">
                  전화번호
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  선택
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  배송 안내, 주문 관련 긴급 연락
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  회원 탈퇴 시까지
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2 font-medium">
                  배송지 정보
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  선택
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  새벽배송 주소 자동입력
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  회원 탈퇴 시까지
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-gray-500">
            ※ 관련 법령에 따라 보존이 필요한 경우 해당 법령에서 정한 기간
            동안 보관합니다. (전자상거래법 등)
          </p>
        </Section>

        {/* 5. 회사 정보 */}
        <Section number={5} title="회사 정보">
          <table className="mb-6 w-full border-collapse border border-gray-300 text-sm">
            <tbody>
              <tr>
                <td className="w-40 border border-gray-300 bg-gray-100 px-4 py-2 font-medium">
                  회사명
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  주식회사 다함푸드
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 bg-gray-100 px-4 py-2 font-medium">
                  서비스명
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  W2O SALADA (더블유 투 오 샐러다)
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 bg-gray-100 px-4 py-2 font-medium">
                  사업자등록번호
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  452-87-02160
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 bg-gray-100 px-4 py-2 font-medium">
                  소재지
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  대구광역시 달서구 성서공단로 332-10, 2층
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 bg-gray-100 px-4 py-2 font-medium">
                  대표 전화
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  053-721-7794
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 bg-gray-100 px-4 py-2 font-medium">
                  서비스 URL
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  <a
                    href="https://w2o.co.kr"
                    className="text-blue-600 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    https://w2o.co.kr
                  </a>
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 bg-gray-100 px-4 py-2 font-medium">
                  모회사 홈페이지
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  <a
                    href="https://dahamfood.co.kr"
                    className="text-blue-600 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    https://dahamfood.co.kr
                  </a>
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 bg-gray-100 px-4 py-2 font-medium">
                  업종
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  식품 제조/유통, 급식/단체급식 전문
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 bg-gray-100 px-4 py-2 font-medium">
                  인증 현황
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  HACCP(식품안전관리인증), ISO 22000(식품안전경영시스템)
                </td>
              </tr>
            </tbody>
          </table>
          <p className="leading-relaxed text-gray-700">
            주식회사 다함푸드는 급식 및 단체급식을 전문으로 하는 식품
            기업으로, 다년간의 식품 제조/유통 경험을 바탕으로 프리미엄 샐러드
            새벽배송 서비스 <strong>W2O SALADA</strong>를 런칭하였습니다.
            HACCP 인증 시설에서 위생적으로 제조하며, 식품 안전과 품질 관리에
            만전을 기하고 있습니다.
          </p>
        </Section>

        {/* 6. 서비스 화면 안내 */}
        <Section number={6} title="서비스 화면 캡처 안내">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-6 py-5">
            <p className="leading-relaxed text-gray-700">
              자세한 서비스 화면은 아래 URL에서 확인하실 수 있습니다.
            </p>
            <p className="mt-3">
              <a
                href="https://w2o.co.kr"
                className="text-lg font-semibold text-blue-600 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://w2o.co.kr
              </a>
            </p>
            <p className="mt-3 text-sm text-gray-500">
              주요 화면: 메인 페이지, 상품 목록, 상품 상세, 장바구니, 결제,
              마이페이지, 정기구독 관리
            </p>
          </div>
        </Section>

        {/* Footer */}
        <footer className="mt-16 border-t-2 border-gray-800 pt-8 text-center">
          <p className="text-sm font-semibold text-gray-700">
            주식회사 다함푸드
          </p>
          <p className="mt-1 text-xs text-gray-500">
            대구광역시 달서구 성서공단로 332-10, 2층 | TEL 053-721-7794
          </p>
          <p className="mt-1 text-xs text-gray-500">
            사업자등록번호 452-87-02160
          </p>
          <p className="mt-4 text-xs text-gray-400">
            본 문서는 카카오 로그인 심사를 위한 서비스 소개서입니다.
          </p>
        </footer>
      </div>
    </div>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 border-b border-gray-300 pb-2 text-lg font-bold text-gray-900">
        {number}. {title}
      </h2>
      {children}
    </section>
  );
}
