import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import RightDock from "./components/RightDock";

export const metadata: Metadata = {
  title: "W2O SALADA - 일어나면 이미 준비된 하루",
  description: "신선한 샐러드 새벽배송 서비스. 정기구독으로 매일 아침 건강한 하루를 시작하세요.",
  keywords: ["샐러드", "새벽배송", "정기구독", "건강식", "다이어트", "W2O"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
        />
      </head>
      <body className="bg-brand-dark">
        <Providers>
          {children}
          <RightDock />
        </Providers>
      </body>
    </html>
  );
}
