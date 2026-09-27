import Link from "next/link";
import { prisma } from "@repo/db";

// 어드민 설정(Setting 테이블)에서 사업자 정보를 읽어와 렌더링.
// 부모 페이지의 revalidate 캐시에 자연스럽게 흡수됨.
async function getBusinessInfo() {
  const keys = ["shopName", "companyName", "ownerName", "phone", "email", "address", "businessNumber", "mailOrderNumber"];
  try {
    const rows = await prisma.setting.findMany({
      where: { key: { in: keys } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return {
      shopName: map.shopName ?? "W2O SALADA",
      companyName: map.companyName ?? "",
      ownerName: map.ownerName ?? "",
      phone: map.phone ?? "",
      email: map.email ?? "",
      address: map.address ?? "",
      businessNumber: map.businessNumber ?? "",
      mailOrderNumber: map.mailOrderNumber ?? "",
    };
  } catch {
    return { shopName: "W2O SALADA", companyName: "", ownerName: "", phone: "", email: "", address: "", businessNumber: "", mailOrderNumber: "" };
  }
}

export default async function Footer() {
  const info = await getBusinessInfo();

  return (
    <footer className="bg-[#060D09] border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* 브랜드 */}
          <div>
            <div className="flex items-center gap-1.5 mb-4">
              <span className="text-xl font-black text-brand-green">W2O</span>
              <span className="text-sm font-medium text-brand-green/70 tracking-widest">
                SALADA
              </span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed">
              Weekly 2 Order.
              <br />
              매주 두 번, 우리 집 식탁이 차려집니다.
            </p>
            <p className="text-gray-600 text-xs mt-2">
              샐러드·간편식·반찬 새벽배송 구독
            </p>
          </div>

          {/* 서비스 */}
          <div>
            <h4 className="text-white font-bold mb-4">서비스</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="#subscribe" className="hover:text-gray-300 transition">구독 안내</a></li>
              <li><a href="#weekly-menu" className="hover:text-gray-300 transition">이번 주 식단</a></li>
              <li><a href="#delivery" className="hover:text-gray-300 transition">배송 안내</a></li>
            </ul>
          </div>

          {/* 고객지원 */}
          <div>
            <h4 className="text-white font-bold mb-4">고객지원</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link href="/about-service" className="hover:text-gray-300 transition">자주 묻는 질문</Link></li>
              <li><a href="https://pf.kakao.com/_xfLLuX/chat" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition">카톡 문의</a></li>
              <li><Link href="/terms/subscription" className="hover:text-gray-300 transition">구독 이용약관</Link></li>
              <li><Link href="/terms" className="hover:text-gray-300 transition">이용약관</Link></li>
              <li><Link href="/privacy" className="hover:text-gray-300 transition">개인정보처리방침</Link></li>
            </ul>
          </div>

          {/* 문의 */}
          <div>
            <h4 className="text-white font-bold mb-4">문의</h4>
            <div className="space-y-2 text-sm text-gray-500">
              {info.phone && <p>전화: {info.phone}</p>}
              {info.email && <p>이메일: {info.email}</p>}
              <p>운영시간: 평일 09:00 - 18:00</p>
            </div>
          </div>
        </div>
      </div>

      {/* 사업자 정보 */}
      <div className="border-t border-white/5 bg-black/30">
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-1.5 text-xs text-gray-100 leading-relaxed">
          <p>
            <span className="text-gray-400">상호:</span> {info.shopName}
            {info.companyName && (
              <>
                <span className="text-gray-400 ml-3">회사명:</span> {info.companyName}
              </>
            )}
            {info.ownerName && (
              <>
                <span className="text-gray-400 ml-3">대표:</span> {info.ownerName}
              </>
            )}
            {info.businessNumber && (
              <>
                <span className="text-gray-400 ml-3">사업자등록번호:</span> {info.businessNumber}
              </>
            )}
            {info.mailOrderNumber && (
              <>
                <span className="text-gray-400 ml-3">통신판매업신고:</span> {info.mailOrderNumber}
              </>
            )}
          </p>
          {info.address && (
            <p>
              <span className="text-gray-400">주소:</span> {info.address}
            </p>
          )}
          <p className="pt-2 text-gray-400">&copy; 2026 W2O SALADA. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
