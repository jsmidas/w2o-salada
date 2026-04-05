"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function useInstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // 이미 설치됨(standalone) 감지
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // iOS 감지 (iOS Safari는 beforeinstallprompt 이벤트 미지원)
    const ua = window.navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream: unknown }).MSStream;
    setIsIOS(iOS);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (isIOS) {
      // iOS는 Safari 공유 메뉴에서 "홈 화면에 추가" 안내
      alert(
        "📱 홈 화면 바로가기 만들기\n\n" +
        "1. Safari 하단의 공유 버튼 (□↑) 을 누르세요\n" +
        "2. '홈 화면에 추가'를 선택하세요\n" +
        "3. 우측 상단 '추가'를 누르면 완료!"
      );
      return;
    }

    if (!deferredPrompt) {
      alert(
        "이미 바로가기가 만들어져 있거나, 이 브라우저에서는 지원하지 않습니다.\n" +
        "Chrome, Edge, Samsung Internet에서 이용해 보세요."
      );
      return;
    }

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const canInstall = !isInstalled && (deferredPrompt !== null || isIOS);

  return { canInstall, install, isInstalled };
}
