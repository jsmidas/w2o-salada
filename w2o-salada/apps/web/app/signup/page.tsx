"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function SignupPage() {
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", phone: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error);
    } else {
      router.push("/login?registered=true");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A1A0F] via-[#122a1a] to-[#0A1A0F] flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#1D9E75]/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#1D9E75]/5 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="text-3xl font-black text-[#1D9E75]">W2O</span>
            <span className="text-lg text-[#1D9E75]/60 tracking-widest">SALADA</span>
          </Link>
          <p className="text-white/40 text-sm mt-3">신선한 하루의 시작, 회원가입</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/10 shadow-2xl">
          {/* 간편 가입 */}
          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-white text-gray-700 hover:bg-gray-50 transition"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Google로 간편 가입
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => signIn("kakao", { callbackUrl: "/" })}
                className="flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 bg-[#FEE500] text-[#3C1E1E] hover:brightness-95 transition"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#3C1E1E"><path d="M12 3C6.5 3 2 6.58 2 11c0 2.84 1.87 5.33 4.68 6.74l-.96 3.56c-.07.26.23.46.45.31L10.3 18.8c.55.07 1.12.1 1.7.1 5.5 0 10-3.58 10-8s-4.5-8-10-8z"/></svg>
                카카오
              </button>
              <button
                type="button"
                onClick={() => signIn("naver", { callbackUrl: "/" })}
                className="flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 bg-[#03C75A] text-white hover:brightness-95 transition"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="white"><path d="M13.5 12.74L10.24 7.5H7v9h3.5v-5.24L13.76 16.5H17v-9h-3.5z"/></svg>
                네이버
              </button>
            </div>
          </div>

          {/* 구분선 */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/30 text-xs">또는 이메일로 가입</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">이름</label>
            <input
              type="text"
              placeholder="이름을 입력하세요"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-[#1D9E75]/50 focus:ring-1 focus:ring-[#1D9E75]/25 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">아이디</label>
            <input
              type="text"
              placeholder="사용할 아이디를 입력하세요"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              autoComplete="username"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-[#1D9E75]/50 focus:ring-1 focus:ring-[#1D9E75]/25 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">이메일</label>
            <input
              type="email"
              placeholder="이메일 주소 (비밀번호 찾기용)"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-[#1D9E75]/50 focus:ring-1 focus:ring-[#1D9E75]/25 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">비밀번호</label>
            <input
              type="password"
              placeholder="비밀번호 (6자 이상)"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-[#1D9E75]/50 focus:ring-1 focus:ring-[#1D9E75]/25 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">전화번호 (선택)</label>
            <input
              type="tel"
              placeholder="010-0000-0000"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-[#1D9E75]/50 focus:ring-1 focus:ring-[#1D9E75]/25 transition"
            />
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
            {loading ? "가입 중..." : "회원가입"}
          </button>
        </form>

        <p className="text-center text-white/30 text-sm mt-6">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-[#1D9E75] hover:underline font-medium">로그인</Link>
        </p>
        </div>
      </div>
    </div>
  );
}
