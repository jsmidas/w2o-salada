"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

const CATEGORIES = [
  { key: "order", icon: "📦", label: "주문" },
  { key: "delivery", icon: "🚚", label: "배송" },
  { key: "subscription", icon: "🔄", label: "구독" },
  { key: "general", icon: "💬", label: "기타" },
];

const MAX_IMAGES = 3;

export default function InquiryFAB() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("general");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<{ url: string; uploading: boolean }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 로그인 유저 자동 채움
  useEffect(() => {
    if (session?.user) {
      const user = session.user as { name?: string; phone?: string };
      if (user.name) setName(user.name);
    }
  }, [session]);

  // 외부에서 바텀시트 열기 (RightDock에서 사용)
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("openInquiry", handler);
    return () => window.removeEventListener("openInquiry", handler);
  }, []);

  // 어드민 페이지에서는 FAB 숨김
  if (pathname?.startsWith("/admin")) return null;

  const isLoggedIn = !!session?.user;
  const userId = (session?.user as { id?: string })?.id;

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (images.length + files.length > MAX_IMAGES) {
      alert(`사진은 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다.`);
      return;
    }

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name}: 5MB 이하 파일만 첨부할 수 있습니다.`);
        continue;
      }

      const placeholder = { url: URL.createObjectURL(file), uploading: true };
      setImages((prev) => [...prev, placeholder]);

      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload/inquiry", { method: "POST", body: fd });
        const data = await res.json();

        if (res.ok && data.url) {
          setImages((prev) =>
            prev.map((img) => (img.url === placeholder.url ? { url: data.url, uploading: false } : img)),
          );
        } else {
          setImages((prev) => prev.filter((img) => img.url !== placeholder.url));
          alert(data.error ?? "이미지 업로드에 실패했습니다.");
        }
      } catch {
        setImages((prev) => prev.filter((img) => img.url !== placeholder.url));
        alert("이미지 업로드 중 오류가 발생했습니다.");
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (url: string) => {
    setImages((prev) => prev.filter((img) => img.url !== url));
  };

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim() || !content.trim()) {
      alert("이름, 연락처, 내용을 모두 입력해주세요.");
      return;
    }
    if (images.some((img) => img.uploading)) {
      alert("이미지 업로드가 진행 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          category,
          content: content.trim(),
          images: images.map((img) => img.url),
          userId: userId ?? undefined,
        }),
      });
      if (res.ok) {
        setDone(true);
        setTimeout(() => {
          setDone(false);
          setOpen(false);
          setCategory("general");
          setContent("");
          setImages([]);
        }, 2500);
      } else {
        const data = await res.json();
        alert(data.error ?? "문의 접수에 실패했습니다.");
      }
    } catch {
      alert("처리 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* FAB 버튼 */}
      {/* 모바일 전용 FAB (데스크톱은 RightDock에서 트리거) */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed z-[100] bottom-6 right-6 sm:hidden rounded-full bg-brand-green text-white shadow-lg shadow-brand-green/40 flex items-center gap-2 px-5 py-3.5 hover:scale-105 transition-all duration-300 ${
          open ? "scale-0 opacity-0" : "scale-100 opacity-100"
        }`}
        style={{ animation: open ? "none" : "fabPulse 2.5s ease-in-out infinite" }}
        aria-label="문의하기"
      >
        <span className="material-symbols-outlined text-xl">chat_bubble</span>
        <span className="text-sm font-bold">빠른 문의</span>
      </button>

      {/* 바텀시트 */}
      {open && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center sm:justify-center" onClick={() => !submitting && setOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          <div
            className="relative w-full sm:max-w-lg bg-brand-deep rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-hidden flex flex-col animate-[slideUp_0.3s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              /* 완료 화면 */
              <div className="p-10 text-center animate-[fadeIn_0.4s_ease-out]">
                <div className="w-20 h-20 bg-brand-green/20 rounded-full flex items-center justify-center mx-auto mb-5">
                  <span className="material-symbols-outlined text-brand-green text-4xl animate-[checkPop_0.5s_ease-out]">check_circle</span>
                </div>
                <h3 className="text-white text-xl font-bold mb-2">접수 완료!</h3>
                <p className="text-gray-400 text-sm">최대한 빠르게 답변드릴게요</p>
              </div>
            ) : (
              <>
                {/* 헤더 */}
                <div className="px-5 pt-4 pb-3 border-b border-white/10">
                  <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3 sm:hidden" />
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        <span className="material-symbols-outlined text-brand-green">chat_bubble</span>
                        빠른 문의
                      </h3>
                      <p className="text-brand-green text-xs font-semibold mt-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">schedule</span>
                        22시 이전에는 10분 내 답변드립니다
                      </p>
                    </div>
                    <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white p-1">
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-y-auto p-5 space-y-5">
                  {/* 문의 유형 칩 */}
                  <div>
                    <label className="text-white/60 text-xs font-semibold mb-2 block">문의 유형</label>
                    <div className="flex gap-2 flex-wrap">
                      {CATEGORIES.map((c) => (
                        <button
                          key={c.key}
                          onClick={() => setCategory(c.key)}
                          className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                            category === c.key
                              ? "bg-brand-green text-white scale-105 shadow-lg shadow-brand-green/30"
                              : "bg-white/10 text-gray-300 hover:bg-white/20"
                          }`}
                        >
                          {c.icon} {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 이름/연락처 (비로그인) */}
                  {!isLoggedIn ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-white/60 text-xs font-semibold mb-1 block">이름</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="홍길동"
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-brand-green"
                        />
                      </div>
                      <div>
                        <label className="text-white/60 text-xs font-semibold mb-1 block">연락처</label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="010-0000-0000"
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-brand-green"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                        <span className="material-symbols-outlined text-brand-green text-lg">person</span>
                        {name} 님으로 접수됩니다
                      </div>
                      {!phone && (
                        <div>
                          <label className="text-white/60 text-xs font-semibold mb-1 block">연락처</label>
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="답변받을 연락처를 입력해주세요"
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-brand-green"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* 내용 */}
                  <div>
                    <label className="text-white/60 text-xs font-semibold mb-1 block">문의 내용</label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="궁금한 점이나 불편한 점을 알려주세요"
                      rows={4}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-brand-green resize-none"
                    />
                  </div>

                  {/* 사진 첨부 */}
                  <div>
                    <label className="text-white/60 text-xs font-semibold mb-2 block">사진 첨부 (선택, 최대 3장)</label>
                    <div className="flex gap-3 flex-wrap">
                      {images.map((img, i) => (
                        <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10">
                          <img src={img.url} alt="" className="w-full h-full object-cover" />
                          {img.uploading && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                          {!img.uploading && (
                            <button
                              onClick={() => removeImage(img.url)}
                              className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center hover:bg-red-500"
                            >
                              <span className="material-symbols-outlined text-white text-xs">close</span>
                            </button>
                          )}
                        </div>
                      ))}
                      {images.length < MAX_IMAGES && (
                        <label className="w-20 h-20 rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-gray-500 hover:border-brand-green hover:text-brand-green transition cursor-pointer">
                          <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageSelect}
                            className="sr-only"
                          />
                          <span className="material-symbols-outlined text-xl">add_photo_alternate</span>
                          <span className="text-[10px] mt-0.5">사진</span>
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                {/* 보내기 버튼 */}
                <div className="p-5 border-t border-white/10">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !content.trim()}
                    className="w-full py-3.5 rounded-xl bg-brand-green text-white font-bold text-base disabled:opacity-40 hover:bg-brand-mint transition flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        보내는 중...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined">send</span>
                        보내기
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fabPulse {
          0%, 100% { box-shadow: 0 4px 20px -4px rgba(29, 158, 117, 0.4); }
          50% { box-shadow: 0 4px 30px -2px rgba(29, 158, 117, 0.7); }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes checkPop {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
      `}</style>
    </>
  );
}
