"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useInstallPWA } from "./InstallPWA";

type DockItem = {
  href?: string;
  onClick?: () => void;
  icon: string;
  label: string;
  accent?: "primary" | "amber" | "kakao" | "default";
  external?: boolean;
};

type Faq = {
  id: string;
  q: string;
  a: string;
  href?: string;
};

type SidebarConfig = {
  hero: { line1: string; line2: string; subtitle: string; href: string };
  support: { kakaoUrl: string; phone: string };
  faqs: Faq[];
};

const DEFAULT_CONFIG: SidebarConfig = {
  hero: { line1: "새벽배송", line2: "안내", subtitle: "W2O SALADA", href: "/about-service" },
  support: { kakaoUrl: "https://pf.kakao.com/_xfLLuX/chat", phone: "053-721-7794" },
  faqs: [
    { id: "area", q: "배송 지역", a: "서울 전 지역, 인천 일부, 경기 주요 신도시(판교·분당·일산·수원·용인)에 새벽배송 가능합니다.", href: "/about-service" },
    { id: "cutoff", q: "주문 마감", a: "매일 밤 11시까지 주문하시면 다음날 새벽 6시 이전에 도착합니다.", href: "/about-service" },
    { id: "fee", q: "배송비", a: "3만원 이상 주문 시 무료 배송, 미만 시 3,000원. 정기구독은 전 상품 무료배송.", href: "/about-service" },
    { id: "pack", q: "신선 포장", a: "친환경 보냉팩 + 드라이아이스로 0~4도 콜드체인 유지.", href: "/about-service" },
  ],
};

function DockTile({ item }: { item: DockItem }) {
  const accentClass =
    item.accent === "primary"
      ? "bg-brand-primary text-white hover:bg-brand-primaryDark"
      : item.accent === "amber"
      ? "bg-brand-amber text-brand-dark hover:brightness-110"
      : item.accent === "kakao"
      ? "bg-[#FEE500] text-[#191600] hover:brightness-105"
      : "bg-white text-brand-dark hover:bg-brand-mint/40";

  const inner = (
    <div
      className={`flex w-[84px] flex-col items-center justify-center gap-1 border-b border-black/5 py-3 transition-colors ${accentClass}`}
    >
      <span
        className="material-symbols-outlined text-[22px] leading-none"
        aria-hidden
      >
        {item.icon}
      </span>
      <span className="text-[11px] font-semibold leading-tight">
        {item.label}
      </span>
    </div>
  );

  if (item.href) {
    if (item.external) {
      return (
        <a href={item.href} target="_blank" rel="noopener noreferrer" aria-label={item.label}>
          {inner}
        </a>
      );
    }
    return (
      <Link href={item.href} aria-label={item.label}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={item.onClick} aria-label={item.label} className="block w-full">
      {inner}
    </button>
  );
}

export default function RightDock() {
  const [showTop, setShowTop] = useState(false);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [config, setConfig] = useState<SidebarConfig>(DEFAULT_CONFIG);
  const { canInstall, install, isInstalled } = useInstallPWA();

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    fetch("/api/sidebar-config")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setConfig(data); })
      .catch(() => {});
  }, []);

  const orderItems: DockItem[] = [
    { href: "/cart", icon: "shopping_bag", label: "장바구니" },
    { href: "/mypage/orders", icon: "receipt_long", label: "주문내역" },
    { href: "/mypage/subscription", icon: "autorenew", label: "구독관리" },
  ];

  const supportItems: DockItem[] = [
    { href: config.support.kakaoUrl, icon: "chat_bubble", label: "카톡상담", accent: "kakao", external: true },
    { href: `tel:${config.support.phone.replace(/-/g, "")}`, icon: "call", label: "전화" },
  ];

  const activeFaq = config.faqs.find((f) => f.id === openFaq);

  return (
    <>
      {/* 메인 스택 - 히어로 카드 + FAQ + 주문/장바구니 */}
      <aside
        className="fixed right-0 top-24 z-40 hidden w-[84px] flex-col gap-2 md:flex"
        aria-label="빠른 메뉴"
      >
        {/* 1. 히어로 카드 - 새벽배송 안내 비주얼 */}
        <Link
          href={config.hero.href}
          className="relative overflow-hidden rounded-l-xl shadow-xl"
          aria-label={`${config.hero.line1} ${config.hero.line2}`}
        >
          <div className="relative flex h-[140px] flex-col items-center justify-start bg-gradient-to-br from-brand-amber to-[#F5B54A] px-2 pt-3 text-center text-brand-dark">
            <p className="text-[13px] font-extrabold leading-tight">
              {config.hero.line1}<br />{config.hero.line2}
            </p>
            <p className="mt-1 text-[9px] font-semibold leading-tight text-brand-dark/60">
              {config.hero.subtitle}
            </p>
            {/* 장식 아이콘 */}
            <span
              className="material-symbols-outlined absolute -bottom-2 -right-2 text-[72px] text-brand-dark/15"
              aria-hidden
            >
              local_shipping
            </span>
          </div>
        </Link>

        {/* 2. FAQ 칩 - 자주 묻는 궁금증 + 앱 설치 */}
        <div className="overflow-hidden rounded-l-xl bg-white shadow-xl">
          {config.faqs.map((faq) => {
            const isOpen = openFaq === faq.id;
            return (
              <button
                key={faq.id}
                type="button"
                onClick={() => setOpenFaq(isOpen ? null : faq.id)}
                className={`flex w-full items-center justify-center border-b border-black/5 px-1 py-2.5 text-[11px] font-semibold leading-tight transition-colors ${
                  isOpen
                    ? "bg-brand-mint/60 text-brand-primaryDark"
                    : "text-brand-dark hover:bg-brand-mint/30"
                }`}
              >
                {faq.q}
              </button>
            );
          })}
          {/* 앱 설치 버튼 - FAQ 하단에 이어서 */}
          <button
            type="button"
            onClick={install}
            disabled={isInstalled}
            className="flex w-full flex-col items-center justify-center gap-0.5 border-t border-brand-primary/20 bg-gradient-to-br from-brand-primary to-brand-primaryDark px-1 py-2.5 text-white transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[18px] leading-none" aria-hidden>
              {isInstalled ? "check_circle" : "add_to_home_screen"}
            </span>
            <span className="text-[10px] font-bold leading-tight">
              {isInstalled ? "추가됨" : "바로가기"}
            </span>
          </button>
        </div>

        {/* 3. 주문/장바구니/구독 */}
        <div className="overflow-hidden rounded-l-xl shadow-xl">
          {orderItems.map((item) => (
            <DockTile key={item.label} item={item} />
          ))}
        </div>
      </aside>

      {/* FAQ 답변 패널 - 좌측으로 슬라이드 */}
      {activeFaq && (
        <div
          className="fixed right-[84px] top-24 z-40 hidden w-72 md:block"
          role="dialog"
          aria-label={`${activeFaq.q} 답변`}
        >
          <div className="relative mr-2 rounded-xl bg-white/95 p-4 shadow-2xl ring-1 ring-brand-primary/20 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setOpenFaq(null)}
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-brand-dark/60 hover:bg-brand-mint/40"
              aria-label="닫기"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
            <p className="mb-2 text-xs font-bold text-brand-primary">Q. {activeFaq.q}</p>
            <p className="text-[13px] leading-relaxed text-brand-dark">{activeFaq.a}</p>
            <Link
              href={activeFaq.href || "/about-service"}
              className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-primaryDark hover:underline"
            >
              자세히 보기
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </Link>
          </div>
        </div>
      )}

      {/* 고객지원 - 카톡/전화/TOP (하단 고정) */}
      <aside
        className="fixed right-0 bottom-6 z-40 flex w-[84px] flex-col overflow-hidden rounded-l-xl shadow-xl"
        aria-label="고객지원"
      >
        {supportItems.map((item) => (
          <DockTile key={item.label} item={item} />
        ))}
        {showTop && (
          <DockTile
            item={{
              onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }),
              icon: "keyboard_arrow_up",
              label: "TOP",
            }}
          />
        )}
      </aside>
    </>
  );
}
