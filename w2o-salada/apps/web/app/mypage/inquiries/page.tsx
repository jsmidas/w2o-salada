"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "../../lib/fetcher";

type Inquiry = {
  id: string;
  category: string;
  content: string;
  images: string | null;
  status: string;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "답변 대기",
  IN_PROGRESS: "처리중",
  RESOLVED: "답변 완료",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-500/20 text-amber-400",
  IN_PROGRESS: "bg-blue-500/20 text-blue-400",
  RESOLVED: "bg-brand-green/20 text-brand-green",
};

const CATEGORY_LABELS: Record<string, string> = {
  order: "주문",
  delivery: "배송",
  subscription: "구독",
  general: "기타",
};

export default function MyInquiriesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading: loading } = useSWR<Inquiry[]>(
    status === "authenticated" ? "/api/user/inquiries" : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const inquiries = Array.isArray(data) ? data : [];

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?redirect=/mypage/inquiries");
    }
  }, [status, router]);

  if (status === "loading") return null;

  const parsedImages = (img: string | null): string[] => {
    if (!img) return [];
    try { return JSON.parse(img); } catch { return []; }
  };

  return (
    <div className="min-h-screen bg-brand-dark">
      <header className="sticky top-0 z-50 bg-brand-deep/95 backdrop-blur border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/mypage" className="flex items-center gap-1.5 text-gray-400 hover:text-white transition">
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </Link>
          <h1 className="text-white font-bold">문의내역</h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
          </div>
        ) : inquiries.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-5xl text-gray-600 block mb-3">support_agent</span>
            <p className="text-gray-500 mb-1">문의 내역이 없습니다</p>
            <p className="text-gray-600 text-sm">궁금한 점이 있으시면 화면 하단의 문의 버튼을 이용해주세요</p>
          </div>
        ) : (
          <div className="space-y-3">
            {inquiries.map((inq) => {
              const isExpanded = expandedId === inq.id;
              const images = parsedImages(inq.images);

              return (
                <div key={inq.id} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                  {/* 헤더 (클릭으로 펼침/접기) */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : inq.id)}
                    className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-white/[0.03] transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[inq.status] ?? "bg-gray-500/20 text-gray-400"}`}>
                          {STATUS_LABELS[inq.status] ?? inq.status}
                        </span>
                        <span className="text-xs text-gray-500">
                          {CATEGORY_LABELS[inq.category] ?? inq.category}
                        </span>
                      </div>
                      <p className="text-white text-sm truncate">{inq.content}</p>
                      <p className="text-gray-600 text-xs mt-1">
                        {new Date(inq.createdAt).toLocaleDateString("ko-KR", {
                          year: "numeric", month: "long", day: "numeric",
                        })}
                      </p>
                    </div>
                    <span className={`material-symbols-outlined text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                      expand_more
                    </span>
                  </button>

                  {/* 상세 내용 */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-white/5">
                      {/* 문의 내용 */}
                      <div className="pt-4 mb-4">
                        <p className="text-xs text-gray-500 font-medium mb-2">문의 내용</p>
                        <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{inq.content}</p>
                        {images.length > 0 && (
                          <div className="flex gap-2 mt-3">
                            {images.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noreferrer" className="w-16 h-16 rounded-lg overflow-hidden border border-white/10 hover:opacity-80 transition">
                                <img src={url} alt="" className="w-full h-full object-cover" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 답변 */}
                      {inq.reply ? (
                        <div className="bg-brand-green/10 rounded-xl p-4 border border-brand-green/20">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-brand-green text-sm">check_circle</span>
                            <span className="text-brand-green text-xs font-semibold">답변</span>
                            {inq.repliedAt && (
                              <span className="text-gray-500 text-xs">
                                {new Date(inq.repliedAt).toLocaleDateString("ko-KR", {
                                  month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
                                })}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{inq.reply}</p>
                        </div>
                      ) : (
                        <div className="bg-white/5 rounded-xl p-4 border border-white/5 text-center">
                          <span className="material-symbols-outlined text-gray-600 text-2xl block mb-1">hourglass_top</span>
                          <p className="text-gray-500 text-sm">답변을 준비 중입니다</p>
                          <p className="text-gray-600 text-xs mt-0.5">22시 이전에는 10분 내 답변드립니다</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
