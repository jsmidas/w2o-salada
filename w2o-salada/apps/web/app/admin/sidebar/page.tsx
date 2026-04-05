"use client";

import { useEffect, useState } from "react";

type Faq = {
  id: string;
  q: string;
  a: string;
  href: string;
};

type SidebarConfig = {
  hero: {
    line1: string;
    line2: string;
    subtitle: string;
    href: string;
  };
  support: {
    kakaoUrl: string;
    phone: string;
  };
  faqs: Faq[];
};

const DEFAULT_CONFIG: SidebarConfig = {
  hero: { line1: "새벽배송", line2: "안내", subtitle: "W2O SALADA", href: "/about-service" },
  support: { kakaoUrl: "", phone: "" },
  faqs: [],
};

export default function SidebarAdminPage() {
  const [config, setConfig] = useState<SidebarConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/sidebar-config")
      .then((r) => r.json())
      .then((data) => {
        // support 필드가 없을 경우 기본값 병합
        setConfig({
          ...DEFAULT_CONFIG,
          ...data,
          support: { ...DEFAULT_CONFIG.support, ...(data.support || {}) },
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !config) {
    return <div className="text-center py-20 text-gray-400">로딩 중...</div>;
  }

  const updateHero = (key: keyof SidebarConfig["hero"], value: string) => {
    setConfig({ ...config, hero: { ...config.hero, [key]: value } });
  };

  const updateSupport = (key: keyof SidebarConfig["support"], value: string) => {
    setConfig({ ...config, support: { ...config.support, [key]: value } });
  };

  const updateFaq = (index: number, key: keyof Faq, value: string) => {
    const faqs = [...config.faqs];
    faqs[index] = { ...faqs[index], [key]: value };
    setConfig({ ...config, faqs });
  };

  const handleSave = async () => {
    const res = await fetch("/api/admin/sidebar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const inputClass =
    "px-3 py-2 border border-gray-200 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75] transition";
  const labelClass = "text-sm font-medium text-gray-600 block mb-1";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">사이드바 설정</h1>
        <p className="text-sm text-gray-400 mt-1">
          홈페이지 우측 사이드바의 히어로 카드, FAQ, 고객지원 연락처를 편집하세요
        </p>
      </div>

      {/* 히어로 카드 */}
      <div className="bg-white rounded-xl p-6 shadow-sm border mb-6">
        <h2 className="font-bold text-gray-700 mb-4">상단 히어로 카드</h2>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className={labelClass}>1행 텍스트</span>
            <input
              type="text"
              value={config.hero.line1}
              onChange={(e) => updateHero("line1", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>2행 텍스트</span>
            <input
              type="text"
              value={config.hero.line2}
              onChange={(e) => updateHero("line2", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>서브 텍스트</span>
            <input
              type="text"
              value={config.hero.subtitle}
              onChange={(e) => updateHero("subtitle", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>링크 URL</span>
            <input
              type="text"
              value={config.hero.href}
              onChange={(e) => updateHero("href", e.target.value)}
              placeholder="/about-service"
              className={inputClass}
            />
          </label>
        </div>
      </div>

      {/* 고객지원 (카톡/전화) */}
      <div className="bg-white rounded-xl p-6 shadow-sm border mb-6">
        <h2 className="font-bold text-gray-700 mb-4">고객지원 (하단 버튼)</h2>
        <div className="space-y-4">
          <label className="block">
            <span className={labelClass}>카카오 채널 채팅 URL</span>
            <input
              type="text"
              value={config.support.kakaoUrl}
              onChange={(e) => updateSupport("kakaoUrl", e.target.value)}
              placeholder="https://pf.kakao.com/_xxxxxx/chat"
              className={inputClass}
            />
            <span className="text-xs text-gray-400 mt-1 block">
              카카오톡 채널 관리자센터 → 채널 홈 URL 뒤에 /chat 붙이세요
            </span>
          </label>
          <label className="block">
            <span className={labelClass}>대표 전화번호</span>
            <input
              type="text"
              value={config.support.phone}
              onChange={(e) => updateSupport("phone", e.target.value)}
              placeholder="1588-0000"
              className={inputClass}
            />
          </label>
        </div>
      </div>

      {/* FAQ 항목 */}
      <div className="bg-white rounded-xl p-6 shadow-sm border mb-6">
        <h2 className="font-bold text-gray-700 mb-4">FAQ 4개 항목</h2>
        <div className="space-y-6">
          {config.faqs.map((faq, i) => (
            <div key={faq.id} className="border-l-4 border-[#1D9E75]/30 pl-4 py-2">
              <div className="text-xs font-bold text-[#1D9E75] mb-2">FAQ #{i + 1}</div>
              <div className="space-y-3">
                <label className="block">
                  <span className={labelClass}>질문 (사이드바 타일 제목, 짧게)</span>
                  <input
                    type="text"
                    value={faq.q}
                    onChange={(e) => updateFaq(i, "q", e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>답변 (팝업창 내용)</span>
                  <textarea
                    value={faq.a}
                    onChange={(e) => updateFaq(i, "a", e.target.value)}
                    rows={3}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>&quot;자세히 보기&quot; 링크 URL</span>
                  <input
                    type="text"
                    value={faq.href}
                    onChange={(e) => updateFaq(i, "href", e.target.value)}
                    placeholder="/about-service"
                    className={inputClass}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 저장 */}
      <div className="sticky bottom-0 bg-gray-100 py-4 -mx-6 px-6 border-t border-gray-200">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 bg-[#1D9E75] text-white text-sm font-bold rounded-lg hover:bg-[#178a64] transition"
          >
            저장
          </button>
          {saved && (
            <span className="text-sm text-[#1D9E75] font-medium">
              저장되었습니다 ✓ (새로고침 시 반영)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
