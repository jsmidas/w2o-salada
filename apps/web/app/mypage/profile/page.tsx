"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Profile = {
  id: string;
  username: string | null;
  email: string;
  name: string;
  phone: string | null;
  provider: string | null;
  createdAt: string;
};

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?redirect=/mypage/profile");
      return;
    }
    if (status !== "authenticated") return;

    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setProfile(data);
          setName(data.name ?? "");
          setPhone(data.phone ?? "");
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, router]);

  const handleSaveBasic = async () => {
    if (!name.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "저장 실패");
        return;
      }
      const updated = await res.json();
      setProfile((prev) => (prev ? { ...prev, ...updated } : prev));
      await update({ name }); // 세션 갱신
      alert("저장되었습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !newPw2) {
      alert("모든 비밀번호 필드를 입력해주세요.");
      return;
    }
    if (newPw !== newPw2) {
      alert("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    if (newPw.length < 6) {
      alert("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "변경 실패");
        return;
      }
      setCurrentPw("");
      setNewPw("");
      setNewPw2("");
      alert("비밀번호가 변경되었습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || !session) return null;

  const providerLabels: Record<string, string> = {
    kakao: "카카오",
    naver: "네이버",
    google: "구글",
    email: "이메일",
  };

  const isSocial = profile?.provider && profile.provider !== "email";

  return (
    <div className="min-h-screen bg-brand-dark">
      <header className="sticky top-0 z-50 bg-brand-deep/95 backdrop-blur border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/mypage"
            className="flex items-center gap-1 text-gray-400 hover:text-white transition"
          >
            <span className="material-symbols-outlined text-xl">chevron_left</span>
            <span className="text-sm">마이페이지</span>
          </Link>
          <h1 className="text-white font-bold">프로필</h1>
          <div className="w-20" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {loading || !profile ? (
          <p className="text-gray-400 text-center py-12">로딩 중...</p>
        ) : (
          <>
            {/* 기본 정보 */}
            <section className="bg-white/5 rounded-xl p-5 border border-white/10">
              <h2 className="text-white font-bold mb-4">기본 정보</h2>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">이메일</label>
                  <input
                    type="text"
                    value={profile.email}
                    readOnly
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-gray-400 text-sm"
                  />
                </div>

                {profile.username && (
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">아이디</label>
                    <input
                      type="text"
                      value={profile.username}
                      readOnly
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-gray-400 text-sm"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs text-gray-400 block mb-1">가입 방식</label>
                  <p className="text-white text-sm">
                    {providerLabels[profile.provider ?? "email"] ?? "이메일"}
                  </p>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">이름 *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">전화번호</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green"
                    placeholder="010-0000-0000"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveBasic}
                disabled={saving}
                className="w-full mt-4 py-2.5 bg-brand-green text-white rounded-lg font-semibold hover:bg-brand-mint transition text-sm disabled:opacity-50"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </section>

            {/* 비밀번호 변경 */}
            {!isSocial && (
              <section className="bg-white/5 rounded-xl p-5 border border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-bold">비밀번호 변경</h2>
                  {/* 입력한 값을 확인할 수 있게 보기/숨기기 토글 — 임시 비밀번호처럼 긴 값을 옮겨 적을 때 필요 */}
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition"
                  >
                    <span className="material-symbols-outlined text-base">
                      {showPw ? "visibility_off" : "visibility"}
                    </span>
                    {showPw ? "숨기기" : "비밀번호 보기"}
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">현재 비밀번호</label>
                    <input
                      type={showPw ? "text" : "password"}
                      value={currentPw}
                      onChange={(e) => setCurrentPw(e.target.value)}
                      autoComplete="current-password"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">새 비밀번호</label>
                    <input
                      type={showPw ? "text" : "password"}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      autoComplete="new-password"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green"
                      placeholder="6자 이상"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">새 비밀번호 확인</label>
                    <input
                      type={showPw ? "text" : "password"}
                      value={newPw2}
                      onChange={(e) => setNewPw2(e.target.value)}
                      autoComplete="new-password"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green"
                    />
                    {newPw2 && newPw !== newPw2 && (
                      <p className="text-xs text-red-400 mt-1">새 비밀번호가 서로 다릅니다.</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={saving}
                  className="w-full mt-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition text-sm disabled:opacity-50"
                >
                  비밀번호 변경
                </button>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
