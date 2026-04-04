import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보 처리방침 - W2O SALADA",
  description: "W2O SALADA 개인정보 처리방침",
};

export default function PrivacyPolicyPage() {
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
        <h1 className="mb-2 text-3xl font-bold tracking-tight">개인정보 처리방침</h1>
        <p className="mb-10 text-sm text-gray-500">시행일: 2026년 4월 5일</p>

        <div className="space-y-10 text-[15px] leading-relaxed text-gray-700">
          <p>
            주식회사 다함푸드(이하 &quot;회사&quot;)는 W2O SALADA(더블유 투 오 샐러다) 서비스(이하
            &quot;서비스&quot;)를 운영함에 있어 「개인정보 보호법」 등 관련 법령을 준수하며, 이용자의
            개인정보를 보호하기 위해 다음과 같이 개인정보 처리방침을 수립·공개합니다.
          </p>

          {/* 1. 수집 및 이용 목적 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              1. 개인정보의 수집 및 이용 목적
            </h2>
            <p>회사는 다음의 목적을 위해 개인정보를 수집·이용합니다.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>회원가입 및 본인 확인, 서비스 이용자 식별</li>
              <li>상품 주문, 결제, 배송(새벽배송 포함) 서비스 제공</li>
              <li>정기구독 서비스 제공 및 자동결제 처리</li>
              <li>고객 상담 및 불만 처리, 공지사항 전달</li>
              <li>주문·배송 관련 알림(카카오 알림톡, SMS) 발송</li>
              <li>서비스 이용 통계 분석 및 서비스 개선</li>
              <li>부정 이용 방지 및 비인가 사용 탐지</li>
            </ul>
          </section>

          {/* 2. 수집 항목 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              2. 수집하는 개인정보 항목
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200 bg-gray-50 text-left">
                    <th className="px-4 py-3 font-semibold text-gray-900">구분</th>
                    <th className="px-4 py-3 font-semibold text-gray-900">수집 항목</th>
                    <th className="px-4 py-3 font-semibold text-gray-900">수집 시점</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-4 py-3 font-medium text-gray-900">필수</td>
                    <td className="px-4 py-3">이름, 이메일, 아이디, 비밀번호</td>
                    <td className="px-4 py-3">회원가입 시</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">선택</td>
                    <td className="px-4 py-3">전화번호, 배송지 주소(수령인명, 주소, 상세주소, 공동현관 비밀번호)</td>
                    <td className="px-4 py-3">주문·배송지 등록 시</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-gray-900">소셜 로그인</td>
                    <td className="px-4 py-3">이메일, 닉네임, 프로필 이미지 (카카오/네이버/구글 계정 연동 시 제공받는 정보)</td>
                    <td className="px-4 py-3">소셜 로그인 시</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">결제</td>
                    <td className="px-4 py-3">
                      카드정보(카드번호, 유효기간 등)
                      <br />
                      <span className="text-xs text-gray-500">
                        ※ 결제정보는 토스페이먼츠를 통해 처리되며, 당사는 카드정보를 직접 보관하지 않습니다.
                        정기구독의 빌링키는 암호화하여 저장합니다.
                      </span>
                    </td>
                    <td className="px-4 py-3">결제·구독 등록 시</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-gray-900">자동 수집</td>
                    <td className="px-4 py-3">접속 IP, 쿠키, 서비스 이용 기록, 접속 일시, 기기 정보, 브라우저 종류</td>
                    <td className="px-4 py-3">서비스 이용 시 자동</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 3. 보유 및 이용기간 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              3. 개인정보의 보유 및 이용기간
            </h2>
            <p>
              회사는 원칙적으로 개인정보 수집·이용 목적이 달성된 후에는 해당 정보를 지체 없이
              파기합니다. 단, 관련 법령에 의해 보존할 필요가 있는 경우 아래와 같이 일정 기간 보관합니다.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200 bg-gray-50 text-left">
                    <th className="px-4 py-3 font-semibold text-gray-900">보존 근거</th>
                    <th className="px-4 py-3 font-semibold text-gray-900">보존 항목</th>
                    <th className="px-4 py-3 font-semibold text-gray-900">보존 기간</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-4 py-3">전자상거래법</td>
                    <td className="px-4 py-3">계약·청약철회 기록</td>
                    <td className="px-4 py-3">5년</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-3">전자상거래법</td>
                    <td className="px-4 py-3">대금결제·재화 공급 기록</td>
                    <td className="px-4 py-3">5년</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">전자상거래법</td>
                    <td className="px-4 py-3">소비자 불만·분쟁 처리 기록</td>
                    <td className="px-4 py-3">3년</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-3">통신비밀보호법</td>
                    <td className="px-4 py-3">접속 로그, IP 등</td>
                    <td className="px-4 py-3">3개월</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              회원 탈퇴 시, 위 법령에 따른 보존 기간이 경과하지 않은 정보를 제외하고 즉시 파기합니다.
            </p>
          </section>

          {/* 4. 제3자 제공 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              4. 개인정보의 제3자 제공
            </h2>
            <p>
              회사는 원칙적으로 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 다만,
              다음의 경우에는 예외로 합니다.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200 bg-gray-50 text-left">
                    <th className="px-4 py-3 font-semibold text-gray-900">제공받는 자</th>
                    <th className="px-4 py-3 font-semibold text-gray-900">제공 항목</th>
                    <th className="px-4 py-3 font-semibold text-gray-900">제공 목적</th>
                    <th className="px-4 py-3 font-semibold text-gray-900">보유 기간</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-4 py-3">토스페이먼츠</td>
                    <td className="px-4 py-3">주문정보, 결제정보</td>
                    <td className="px-4 py-3">결제 처리 및 정기결제</td>
                    <td className="px-4 py-3">결제 서비스 제공 목적 달성 시까지</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-3">배송업체</td>
                    <td className="px-4 py-3">수령인명, 연락처, 배송지 주소</td>
                    <td className="px-4 py-3">상품 배송(새벽배송)</td>
                    <td className="px-4 py-3">배송 완료 후 파기</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              그 외 법령에 특별한 규정이 있는 경우, 수사 목적으로 법령에 정해진 절차와 방법에 따라
              수사기관의 요구가 있는 경우에 한하여 제공할 수 있습니다.
            </p>
          </section>

          {/* 5. 위탁 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              5. 개인정보 처리의 위탁
            </h2>
            <p>회사는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리를 위탁하고 있습니다.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200 bg-gray-50 text-left">
                    <th className="px-4 py-3 font-semibold text-gray-900">수탁업체</th>
                    <th className="px-4 py-3 font-semibold text-gray-900">위탁 업무</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-4 py-3">주식회사 토스페이먼츠</td>
                    <td className="px-4 py-3">전자결제 대행 및 정기결제(빌링) 처리</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-3">NHN Cloud</td>
                    <td className="px-4 py-3">카카오 알림톡·SMS 발송</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              회사는 위탁 계약 시 개인정보 보호 관련 법규의 준수, 개인정보에 관한 비밀유지,
              제3자 제공 금지, 사고 시 손해배상 등의 내용을 계약서에 명시하고, 수탁업체가
              개인정보를 안전하게 처리하도록 관리·감독합니다.
            </p>
          </section>

          {/* 6. 정보주체 권리 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              6. 정보주체의 권리·의무 및 행사 방법
            </h2>
            <p>이용자(정보주체)는 언제든지 다음의 권리를 행사할 수 있습니다.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>개인정보 열람 요구</li>
              <li>개인정보 정정·삭제 요구</li>
              <li>개인정보 처리정지 요구</li>
              <li>회원 탈퇴(서비스 내 마이페이지 또는 고객센터를 통해 가능)</li>
            </ul>
            <p className="mt-3">
              위 권리 행사는 서비스 내 설정 메뉴, 이메일(hello@w2osalada.co.kr), 전화(053-721-7794)를
              통해 하실 수 있으며, 회사는 지체 없이 필요한 조치를 취하겠습니다.
            </p>
            <p className="mt-2">
              이용자는 개인정보를 최신 상태로 정확하게 유지할 의무가 있으며, 부정확한 정보 입력으로
              발생하는 문제의 책임은 이용자에게 있습니다. 타인의 개인정보를 도용하여 회원가입 등을
              한 경우 회원 자격을 상실하거나 관련 법령에 의해 처벌받을 수 있습니다.
            </p>
          </section>

          {/* 7. 파기 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              7. 개인정보의 파기
            </h2>
            <p>
              회사는 개인정보 보유기간의 경과, 처리 목적 달성 등 개인정보가 불필요하게 되었을 때에는
              지체 없이 해당 개인정보를 파기합니다.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>전자적 파일:</strong> 복원이 불가능한 방법으로 영구 삭제
              </li>
              <li>
                <strong>서면 자료:</strong> 분쇄기로 분쇄하거나 소각하여 파기
              </li>
            </ul>
            <p className="mt-2">
              법령에 따라 보존이 필요한 경우, 해당 개인정보를 별도의 데이터베이스(DB)로 옮기거나
              보관장소를 달리하여 보존합니다.
            </p>
          </section>

          {/* 8. 개인정보보호 책임자 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              8. 개인정보보호 책임자
            </h2>
            <p>
              회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 이용자의 개인정보 관련
              불만 처리 및 피해 구제를 위하여 아래와 같이 개인정보보호 책임자를 지정하고 있습니다.
            </p>
            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-5 text-sm">
              <p className="font-semibold text-gray-900">개인정보보호 책임자</p>
              <ul className="mt-2 space-y-1">
                <li>성명: OOO</li>
                <li>직위: 대표이사</li>
                <li>이메일: hello@w2osalada.co.kr</li>
                <li>전화: 053-721-7794</li>
              </ul>
            </div>
            <p className="mt-3">
              기타 개인정보 침해에 대한 신고나 상담이 필요한 경우, 아래 기관에 문의하실 수 있습니다.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              <li>개인정보침해신고센터: (국번없이) 118, <a href="https://privacy.kisa.or.kr" className="text-emerald-600 underline" target="_blank" rel="noopener noreferrer">privacy.kisa.or.kr</a></li>
              <li>개인정보분쟁조정위원회: 1833-6972, <a href="https://www.kopico.go.kr" className="text-emerald-600 underline" target="_blank" rel="noopener noreferrer">kopico.go.kr</a></li>
              <li>대검찰청 사이버수사과: (국번없이) 1301, <a href="https://www.spo.go.kr" className="text-emerald-600 underline" target="_blank" rel="noopener noreferrer">spo.go.kr</a></li>
              <li>경찰청 사이버수사국: (국번없이) 182, <a href="https://ecrm.police.go.kr" className="text-emerald-600 underline" target="_blank" rel="noopener noreferrer">ecrm.police.go.kr</a></li>
            </ul>
          </section>

          {/* 9. 쿠키 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              9. 개인정보 자동 수집 장치의 설치·운영 및 거부에 관한 사항
            </h2>
            <p>
              회사는 이용자에게 개별적인 맞춤 서비스를 제공하기 위해 쿠키(Cookie)를 사용합니다.
            </p>
            <h3 className="mt-4 mb-2 font-semibold text-gray-900">쿠키의 사용 목적</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>로그인 상태 유지 및 인증 처리</li>
              <li>이용자의 서비스 이용 패턴 분석을 통한 서비스 개선</li>
              <li>장바구니 정보 유지 (비로그인 시)</li>
            </ul>
            <h3 className="mt-4 mb-2 font-semibold text-gray-900">쿠키 설정 거부 방법</h3>
            <p>
              이용자는 웹 브라우저의 설정을 통해 쿠키 저장을 거부할 수 있습니다. 다만, 쿠키 저장을
              거부할 경우 로그인이 필요한 일부 서비스 이용에 어려움이 있을 수 있습니다.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              <li>Chrome: 설정 &gt; 개인정보 및 보안 &gt; 쿠키 및 기타 사이트 데이터</li>
              <li>Safari: 환경설정 &gt; 개인정보 보호 &gt; 쿠키 및 웹사이트 데이터 관리</li>
              <li>Edge: 설정 &gt; 쿠키 및 사이트 권한 &gt; 쿠키 및 사이트 데이터</li>
            </ul>
          </section>

          {/* 10. 안전성 확보 조치 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              10. 개인정보의 안전성 확보 조치
            </h2>
            <p>회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>비밀번호 암호화 저장 (bcrypt 등 단방향 해시)</li>
              <li>정기구독 빌링키 AES-256-GCM 암호화 저장</li>
              <li>SSL/TLS를 통한 네트워크 구간 암호화</li>
              <li>개인정보 접근 권한 최소화 및 접근 통제</li>
              <li>개인정보 접근 기록 보관 및 위·변조 방지</li>
            </ul>
          </section>

          {/* 시행일 및 변경 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              11. 개인정보 처리방침의 변경
            </h2>
            <p>
              이 개인정보 처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경 내용의 추가,
              삭제 및 정정이 있는 경우에는 변경 사항의 시행 7일 전부터 웹사이트 공지사항을 통하여
              고지합니다.
            </p>
          </section>

          {/* 회사 정보 */}
          <section className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-sm">
            <p className="mb-2 font-semibold text-gray-900">사업자 정보</p>
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

          <p className="text-sm text-gray-500">본 방침은 2026년 4월 5일부터 시행합니다.</p>
        </div>
      </div>
    </div>
  );
}
