import { NextResponse } from "next/server";
import { prisma } from "@repo/db";

const DEFAULT_CONFIG = {
  hero: {
    line1: "새벽배송",
    line2: "안내",
    subtitle: "W2O SALADA",
    href: "/about-service",
  },
  support: {
    kakaoUrl: "https://pf.kakao.com/_xxxxxx/chat",
    phone: "1588-0000",
  },
  faqs: [
    {
      id: "area",
      q: "배송 지역",
      a: "서울 전 지역, 인천 일부, 경기 주요 신도시(판교·분당·일산·수원·용인)에 새벽배송 가능합니다. 우편번호 조회로 정확히 확인하세요.",
      href: "/about-service",
    },
    {
      id: "cutoff",
      q: "주문 마감",
      a: "매일 밤 11시까지 주문하시면 다음날 새벽 6시 이전에 문 앞으로 도착합니다. (일요일 주문 시 화요일 새벽 도착)",
      href: "/about-service",
    },
    {
      id: "fee",
      q: "배송비",
      a: "3만원 이상 주문 시 무료 배송, 미만 시 배송비 3,000원이 추가됩니다. 정기구독은 전 상품 무료배송입니다.",
      href: "/about-service",
    },
    {
      id: "pack",
      q: "신선 포장",
      a: "친환경 보냉팩 + 드라이아이스로 0~4도 콜드체인 유지. 모든 샐러드는 당일 새벽 조리 후 바로 포장됩니다.",
      href: "/about-service",
    },
  ],
};

export async function GET() {
  try {
    const row = await prisma.setting.findUnique({
      where: { key: "sidebar.config" },
    });
    if (!row) {
      return NextResponse.json(DEFAULT_CONFIG);
    }
    try {
      const parsed = JSON.parse(row.value);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json(DEFAULT_CONFIG);
    }
  } catch (err) {
    console.error("GET /api/sidebar-config error:", err);
    return NextResponse.json(DEFAULT_CONFIG);
  }
}
