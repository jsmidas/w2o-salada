"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PasswordToggle from "../components/PasswordToggle";

type Step = "input" | "code" | "result" | "reset" | "done";

interface Account {
  username: string | null;
  email: string;
  provider: string;
  providerLabel: string;
  canResetPassword: boolean;
  joinedAt: string;
}

const inputClass =
  "auth-input w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-[#1D9E75]/50 focus:ring-1 focus:ring-[#1D9E75]/25 transition";
const primaryBtn =
  "w-full py-3 bg-[#1D9E75] text-white rounded-xl font-semibold hover:bg-[#178a64] transition disabled:opacity-50 shadow-lg shadow-[#1D9E75]/20";
const ghostBtn =
  "w-full py-3 bg-white/5 border border-white/10 text-white/70 rounded-xl font-medium hover:bg-white/10 transition disabled:opacity-50";

function maskEmail(email: string) {
  const [id = "", domain] = email.split("@");
  if (!domain) return email;
  const shown = id.slice(0, Math.min(3, id.length));
  return `${shown}${"*".repeat(Math.max(2, id.length - shown.length))}@${domain}`;
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "요청에 실패했습니다.");
  return data;
}

export default function FindAccountPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const run = async (fn: () => Promise<void>) => {
    setError("");
    setLoading(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      const data = await post("/api/auth/find/send-code", { name, phone });
      setCode("");
      setCooldown(60);
      setNotice(
        data.devCode
          ? `개발 모드: 인증번호 ${data.devCode}`
          : "인증번호를 문자로 보냈습니다. 5분 안에 입력해주세요.",
      );
      setStep("code");
    });

  const verify = () =>
    run(async () => {
      const data = await post("/api/auth/find/verify-code", { name, phone, code });
      setToken(data.token);
      setAccounts(data.accounts);
      setNotice("");
      setStep("result");
    });

  const reset = () =>
    run(async () => {
      if (newPassword !== confirm) throw new Error("비밀번호가 서로 다릅니다.");
      await post("/api/auth/find/reset-password", {
        token,
        name,
        phone,
        username: selected,
        newPassword,
      });
      setStep("done");
    });

  const resettable = accounts.filter((a) => a.canResetPassword);

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
          <p className="text-white/40 text-sm mt-3">아이디 · 비밀번호 찾기</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/10 shadow-2xl">
          {/* 1단계: 이름 + 휴대폰 */}
          {step === "input" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendCode();
              }}
              className="space-y-4"
            >
              <p className="text-white/50 text-sm leading-relaxed">
                가입할 때 등록한 이름과 휴대폰 번호를 입력하면 인증번호를 문자로 보내드립니다.
              </p>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-2">이름</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  required
                  autoComplete="name"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-2">휴대폰 번호</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  required
                  inputMode="numeric"
                  autoComplete="tel"
                  className={inputClass}
                />
              </div>
              {error && <ErrorBox>{error}</ErrorBox>}
              <button type="submit" disabled={loading} className={primaryBtn}>
                {loading ? "발송 중..." : "인증번호 받기"}
              </button>
            </form>
          )}

          {/* 2단계: 인증번호 */}
          {step === "code" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                verify();
              }}
              className="space-y-4"
            >
              <p className="text-white/50 text-sm leading-relaxed">
                <span className="text-white/80">{phone}</span> 로 보낸 인증번호 6자리를 입력해주세요.
              </p>
              {notice && (
                <div className="text-[#5DCAA5] text-sm bg-[#1D9E75]/10 rounded-lg px-4 py-2.5">
                  {notice}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-white/50 mb-2">인증번호</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className={`${inputClass} tracking-[0.4em] text-center text-lg font-semibold`}
                />
              </div>
              {error && <ErrorBox>{error}</ErrorBox>}
              <button type="submit" disabled={loading || code.length !== 6} className={primaryBtn}>
                {loading ? "확인 중..." : "확인"}
              </button>
              <button
                type="button"
                disabled={loading || cooldown > 0}
                onClick={sendCode}
                className={ghostBtn}
              >
                {cooldown > 0 ? `재발송 (${cooldown}초)` : "인증번호 재발송"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("input");
                  setError("");
                }}
                className="w-full text-white/30 text-sm hover:text-white/60 transition"
              >
                이름·휴대폰 다시 입력
              </button>
            </form>
          )}

          {/* 3단계: 계정 목록 */}
          {step === "result" && (
            <div className="space-y-4">
              <p className="text-white/50 text-sm">
                인증이 완료되었습니다. 이 휴대폰으로 가입된 계정입니다.
              </p>
              <ul className="space-y-2">
                {accounts.map((a, i) => (
                  <li
                    key={i}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-white font-semibold truncate">
                        {a.username ?? maskEmail(a.email)}
                      </div>
                      <div className="text-white/40 text-xs mt-0.5">
                        {a.providerLabel} · {a.joinedAt} 가입
                      </div>
                    </div>
                    {a.canResetPassword ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(a.username!);
                          setError("");
                          setStep("reset");
                        }}
                        className="shrink-0 text-xs font-semibold text-[#5DCAA5] hover:text-[#1D9E75] transition"
                      >
                        비밀번호 재설정
                      </button>
                    ) : (
                      <span className="shrink-0 text-xs text-white/30">간편 로그인 계정</span>
                    )}
                  </li>
                ))}
              </ul>
              {resettable.length === 0 && (
                <p className="text-white/40 text-xs leading-relaxed">
                  간편 로그인으로 가입된 계정은 비밀번호가 없습니다. 로그인 화면에서 해당 서비스 버튼으로
                  로그인해주세요.
                </p>
              )}
              <button type="button" onClick={() => router.push("/login")} className={primaryBtn}>
                로그인하러 가기
              </button>
            </div>
          )}

          {/* 4단계: 새 비밀번호 */}
          {step === "reset" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                reset();
              }}
              className="space-y-4"
            >
              <p className="text-white/50 text-sm">
                <span className="text-white/80 font-semibold">{selected}</span> 계정의 새 비밀번호를
                입력해주세요.
              </p>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-2">새 비밀번호</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="6자 이상"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className={`${inputClass} pr-12`}
                  />
                  <PasswordToggle shown={showPw} onToggle={() => setShowPw(!showPw)} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-2">새 비밀번호 확인</label>
                <input
                  type={showPw ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="한 번 더 입력"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className={inputClass}
                />
              </div>
              {error && <ErrorBox>{error}</ErrorBox>}
              <button type="submit" disabled={loading} className={primaryBtn}>
                {loading ? "변경 중..." : "비밀번호 변경"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("result");
                  setError("");
                }}
                className="w-full text-white/30 text-sm hover:text-white/60 transition"
              >
                계정 목록으로
              </button>
            </form>
          )}

          {/* 5단계: 완료 */}
          {step === "done" && (
            <div className="space-y-5 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-[#1D9E75]/15 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#5DCAA5] text-3xl">check</span>
              </div>
              <div>
                <p className="text-white font-semibold">비밀번호가 변경되었습니다</p>
                <p className="text-white/40 text-sm mt-1">새 비밀번호로 로그인해주세요.</p>
              </div>
              <button type="button" onClick={() => router.push("/login")} className={primaryBtn}>
                로그인하러 가기
              </button>
            </div>
          )}

          <p className="text-center text-white/30 text-sm mt-6">
            <Link href="/login" className="text-[#1D9E75] hover:underline font-medium">
              로그인
            </Link>
            <span className="mx-2 text-white/15">|</span>
            <Link href="/signup" className="text-[#1D9E75] hover:underline font-medium">
              회원가입
            </Link>
          </p>
        </div>

        <p className="text-center text-white/15 text-xs mt-8">
          &copy; 2026 다함푸드. All rights reserved.
        </p>
      </div>
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-red-400 text-sm text-center bg-red-400/10 rounded-lg px-4 py-2.5 leading-relaxed">
      {children}
    </div>
  );
}
