import { prisma } from "@repo/db";
import SidebarConfigClient from "./SidebarConfigClient";

export const dynamic = "force-dynamic";

const DEFAULT_CONFIG = {
  hero: {
    line1: "새벽배송",
    line2: "안내",
    subtitle: "W2O SALADA",
    href: "/about-service",
  },
  support: {
    kakaoUrl: "https://pf.kakao.com/_xfLLuX/chat",
    phone: "053-721-7794",
  },
  faqs: [
    {
      id: "area",
      q: "배송 지역",
      a: "대구 달서구와 달성군 일부 지역에 새벽배송합니다. 주소를 입력하시면 배송 가능 여부를 확인해 드립니다. 서비스 지역은 순차적으로 넓혀갑니다.",
      href: "/about-service",
    },
    {
      id: "cutoff",
      q: "주문 마감",
      a: "화·목 새벽 배송이며, 배송 전날 오후 2시까지 주문하시면 됩니다. (화요일 배송분은 월요일 오후 2시 마감)",
      href: "/about-service",
    },
    {
      id: "fee",
      q: "배송비",
      a: "배송비는 받지 않습니다. 본품(샐러드·간편식·반찬) 합계 11,000원 이상부터 주문하실 수 있습니다.",
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

export default async function SidebarAdminPage() {
  const row = await prisma.setting.findUnique({ where: { key: "sidebar.config" } });

  let initialConfig = DEFAULT_CONFIG;
  if (row) {
    try {
      const parsed = JSON.parse(row.value);
      initialConfig = {
        ...DEFAULT_CONFIG,
        ...parsed,
        support: { ...DEFAULT_CONFIG.support, ...(parsed.support || {}) },
      };
    } catch {
      initialConfig = DEFAULT_CONFIG;
    }
  }

  return <SidebarConfigClient initialConfig={initialConfig} />;
}
