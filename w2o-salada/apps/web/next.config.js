import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ["image/webp"],
  },
};

export default withSentryConfig(nextConfig, {
  // 빌드 시 source map 업로드 (SENTRY_AUTH_TOKEN 필요 — 없으면 skip)
  silent: !process.env.CI,

  // Sentry 조직/프로젝트 슬러그 (대시보드에서 확인)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // 배포 시 source map 자동 업로드 (인증 토큰 있을 때만)
  widenClientFileUpload: true,
  reactComponentAnnotation: { enabled: true },
  tunnelRoute: "/monitoring",
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
});
