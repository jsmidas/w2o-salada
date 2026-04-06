"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Header() {
  const { data: session } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-brand-green ${
                scrolled ? "text-gray-700" : "text-white/90"
              }`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTA + 로그인 */}
        <div className="hidden md:flex items-center gap-3">
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
                onClick={() => signOut()}
                className={`text-sm ${scrolled ? "text-gray-500 hover:text-gray-700" : "text-white/60 hover:text-white"} transition`}
              >
                로그아웃
              </button>
              <Link
                href="/subscribe?plan=subscription"
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
                href="/subscribe?plan=subscription"
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
              <a
                key={link.href}
                href={link.href}
                className="text-gray-800 font-medium py-2"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
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
              href="/subscribe?plan=subscription"
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
