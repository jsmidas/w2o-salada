"use client";

import { signIn, getSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PasswordToggle from "../components/PasswordToggle";

const SAVED_KEY = "w2o_saved_login";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saveLogin, setSaveLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 저장된 아이디 불러오기
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_KEY);
      if (saved) {
        const { username: u } = JSON.parse(saved);
        setUsername(u);
        setSaveLogin(true);
      }
    } catch {}
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
    } else {
      // 아이디 저장 처리 (비밀번호는 저장하지 않음)
      if (saveLogin) {
        localStorage.setItem(SAVED_KEY, JSON.stringify({ username }));
      } else {
        localStorage.removeItem(SAVED_KEY);
      }
      // role에 따라 라우팅
      const session = await getSession();
      const role = (session?.user as { role?: string })?.role;
      if (role === "ADMIN") {
        router.push("/admin/dashboard");
      } else if (role === "DRIVER") {
        router.push("/driver");
      } else {
        router.push("/");
      }
      router.refresh();
    }
  };

  const handleSocial = (provider: string) => {
    signIn(provider, { callbackUrl: "/" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A1A0F] via-[#122a1a] to-[#0A1A0F] flex items-center justify-center px-4 relative overflow-hidden">
      {/* 배경 장식 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#1D9E75]/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#1D9E75]/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* 로고 */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="text-3xl font-black text-[#1D9E75]">W2O</span>
            <span className="text-lg text-[#1D9E75]/60 tracking-widest">
              SALADA
            </span>
          </Link>
          <p className="text-white/40 text-sm mt-3">
            일어나면 이미 준비된 하루
          </p>
        </div>

        {/* 로그인 카드 */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/10 shadow-2xl">
          {/* 아이디/비밀번호 로그인 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2">아이디</label>
              <input
                type="text"
                placeholder="아이디를 입력하세요"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="auth-input w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-[#1D9E75]/50 focus:ring-1 focus:ring-[#1D9E75]/25 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2">비밀번호</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="비밀번호를 입력하세요"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-[#1D9E75]/50 focus:ring-1 focus:ring-[#1D9E75]/25 transition"
                />
                <PasswordToggle shown={showPassword} onToggle={() => setShowPassword(!showPassword)} />
              </div>
            </div>

            {/* 아이디/비밀번호 저장 */}
            <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveLogin}
                onChange={(e) => {
                  setSaveLogin(e.target.checked);
                  if (!e.target.checked) localStorage.removeItem(SAVED_KEY);
                }}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#1D9E75] focus:ring-[#1D9E75]/25 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-sm text-white/40">아이디 저장</span>
            </label>
            <Link href="/find-account" className="text-sm text-white/40 hover:text-[#5DCAA5] transition">
              아이디·비밀번호 찾기
            </Link>
            </div>

            {error && (
              <div className="text-red-400 text-sm text-center bg-red-400/10 rounded-lg px-4 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#1D9E75] text-white rounded-xl font-semibold hover:bg-[#178a64] transition disabled:opacity-50 shadow-lg shadow-[#1D9E75]/20"
            >
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </form>

          {/* 구분선 */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/30 text-xs">간편 로그인</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* 소셜 로그인 */}
          <div className="flex gap-3">
            <button
              onClick={() => handleSocial("kakao")}
              className="flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 bg-[#FEE500] text-[#3C1E1E] hover:brightness-95 transition"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#3C1E1E"><path d="M12 3C6.5 3 2 6.58 2 11c0 2.84 1.87 5.33 4.68 6.74l-.96 3.56c-.07.26.23.46.45.31L10.3 18.8c.55.07 1.12.1 1.7.1 5.5 0 10-3.58 10-8s-4.5-8-10-8z"/></svg>
              카카오
            </button>
            <button
              onClick={() => handleSocial("naver")}
              className="flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 bg-[#03C75A] text-white hover:brightness-95 transition"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="white"><path d="M13.5 12.74L10.24 7.5H7v9h3.5v-5.24L13.76 16.5H17v-9h-3.5z"/></svg>
              네이버
            </button>
            <button
              onClick={() => handleSocial("google")}
              className="flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 bg-white text-gray-700 hover:bg-gray-50 transition"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Google
            </button>
          </div>

          {/* 회원가입 링크 */}
          <p className="text-center text-white/30 text-sm mt-6">
            아직 회원이 아니신가요?{" "}
            <Link href="/signup" className="text-[#1D9E75] hover:underline font-medium">
              회원가입
            </Link>
          </p>
        </div>

        {/* 하단 */}
        <p className="text-center text-white/15 text-xs mt-8">
          &copy; 2026 다함푸드. All rights reserved.
        </p>
      </div>
    </div>
  );
}
