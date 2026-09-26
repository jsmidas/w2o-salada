"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useCart } from "../store/cart";

export default function Header() {
  const { data: session } = useSession();
  const items = useCart((s) => s.items);
  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // "메뉴 소개" 드롭다운에 띄울 카테고리 — DB 기준이라 추가하면 자동으로 나타난다
  const [categories, setCategories] = useState<{ name: string; slug: string }[]>([]);
  const [menuHover, setMenuHover] = useState(false);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setCategories(d); })
      .catch(() => {});
  }, []);

  useEffect(() => { setMounted(true); }, []);
  const showCart = mounted && cartCount > 0;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "#about", label: "서비스 소개" },
    { href: "/menu", label: "메뉴 소개" },
    { href: "#subscribe", label: "구독 안내" },
    { href: "#weekly-menu", label: "이번 주 식단" },
    { href: "#reviews", label: "후기" },
  ];

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-md shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* 로고 */}
        <Link href="/" className="flex items-center gap-1.5">
          <span
            className={`text-xl font-black tracking-tight ${
              scrolled ? "text-brand-green" : "text-white"
            }`}
          >
            W2O
          </span>
          <span
            className={`text-xl font-medium ml-2 ${
              scrolled ? "text-gray-400" : "text-white/50"
            }`}
          >
            더블유 투 오
          </span>
          <span
            className={`text-sm font-medium tracking-widest ${
              scrolled ? "text-brand-green/70" : "text-white/70"
            }`}
          >
            SALADA
          </span>
        </Link>

        {/* 데스크톱 네비 */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => {
            const linkClass = `text-sm font-medium transition-colors hover:text-brand-green ${
              scrolled ? "text-gray-700" : "text-white/90"
            }`;

            // 메뉴 소개: 호버하면 카테고리 목록을 펼친다
            if (link.href === "/menu" && categories.length > 0) {
              return (
                <div
                  key={link.href}
                  className="relative"
                  onMouseEnter={() => setMenuHover(true)}
                  onMouseLeave={() => setMenuHover(false)}
                >
                  <Link href={link.href} className={`${linkClass} flex items-center gap-0.5`}>
                    {link.label}
                    <span className="material-symbols-outlined text-base leading-none">
                      {menuHover ? "expand_less" : "expand_more"}
                    </span>
                  </Link>
                  {menuHover && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3">
                      <div className="bg-white rounded-xl shadow-xl border border-gray-100 py-2 min-w-[150px]">
                        {categories.map((c) => (
                          <Link
                            key={c.slug}
                            href={`/menu?category=${c.slug}`}
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-[#1D9E75]/8 hover:text-brand-green transition whitespace-nowrap"
                          >
                            {c.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <a key={link.href} href={link.href} className={linkClass}>
                {link.label}
              </a>
            );
          })}
        </nav>

        {/* CTA + 로그인 */}
        <div className="hidden md:flex items-center gap-3">
          {/* 장바구니 — 담긴 게 있으면 amber로 강조 */}
          <Link
            href="/cart"
            aria-label={showCart ? `장바구니 ${cartCount}개 — 주문하러 가기` : "장바구니"}
            className={`relative flex items-center gap-1.5 px-3 py-2 rounded-full font-semibold text-sm transition ${
              showCart
                ? "bg-brand-amber text-white shadow-lg shadow-[#EF9F27]/30 hover:opacity-90"
                : scrolled
                ? "text-gray-600 hover:text-brand-green hover:bg-brand-green/10"
                : "text-white/80 hover:text-white hover:bg-white/10"
            }`}
          >
            <span className="material-symbols-outlined text-xl">shopping_cart</span>
            {showCart && (
              <>
                <span>주문하기</span>
                <span className="ml-0.5 min-w-[20px] h-5 px-1.5 bg-white text-brand-amber text-[11px] font-black rounded-full flex items-center justify-center">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              </>
            )}
          </Link>
          {session ? (
            <>
              {(session.user as { role?: string })?.role === "ADMIN" && (
                <Link
                  href="/admin/dashboard"
                  className={`text-sm font-medium transition ${scrolled ? "text-[#1D9E75] hover:text-[#167A5B]" : "text-[#5DCAA5] hover:text-white"}`}
                >
                  관리자
                </Link>
              )}
              <span className={`text-sm ${scrolled ? "text-gray-600" : "text-white/70"}`}>
                {session.user?.name}님
              </span>
              <button
                type="button"
                onClick={() => signOut()}
                className={`text-sm ${scrolled ? "text-gray-500 hover:text-gray-700" : "text-white/60 hover:text-white"} transition`}
              >
                로그아웃
              </button>
              <Link
                href="/subscribe"
                className="px-5 py-2 bg-brand-green text-white text-sm font-semibold rounded-full hover:bg-brand-mint transition"
              >
                구독 신청
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={`text-sm font-medium transition ${scrolled ? "text-gray-600 hover:text-gray-800" : "text-white/80 hover:text-white"}`}
              >
                로그인
              </Link>
              <Link
                href="/subscribe"
                className="px-5 py-2 bg-brand-green text-white text-sm font-semibold rounded-full hover:bg-brand-mint transition"
              >
                구독 신청
              </Link>
            </>
          )}
        </div>

        {/* 햄버거 */}
        <button
          className="md:hidden flex flex-col gap-1.5"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="메뉴"
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`block w-6 h-0.5 transition-all ${
                scrolled ? "bg-gray-800" : "bg-white"
              }`}
            />
          ))}
        </button>
      </div>

      {/* 모바일 메뉴 */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t">
          <nav className="flex flex-col p-6 gap-4">
            {navLinks.map((link) => (
              <div key={link.href}>
                <a
                  href={link.href}
                  className="block text-gray-800 font-medium py-2"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
                {link.href === "/menu" && categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 pl-3 pb-1">
                    {categories.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/menu?category=${c.slug}`}
                        className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium"
                        onClick={() => setMobileOpen(false)}
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {session && (session.user as { role?: string })?.role === "ADMIN" && (
              <Link
                href="/admin/dashboard"
                className="text-[#1D9E75] font-medium py-2"
                onClick={() => setMobileOpen(false)}
              >
                관리자 페이지
              </Link>
            )}
            <Link
              href="/cart"
              className={`font-medium py-2 px-3 rounded-full flex items-center gap-2 transition ${
                showCart ? "bg-brand-amber text-white shadow-lg shadow-[#EF9F27]/30" : "text-gray-800"
              }`}
              onClick={() => setMobileOpen(false)}
            >
              <span className="material-symbols-outlined text-lg">shopping_cart</span>
              {showCart ? "장바구니에서 주문하기" : "장바구니"}
              {showCart && (
                <span className="ml-1 min-w-[20px] h-5 px-1.5 bg-white text-brand-amber text-[11px] font-black rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
            <Link
              href="/subscribe"
              className="mt-2 px-6 py-3 bg-brand-green text-white text-center rounded-full font-semibold"
              onClick={() => setMobileOpen(false)}
            >
              구독 신청
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
