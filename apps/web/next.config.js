import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ["image/webp"],
    // next/image 로 가져올 수 있는 원격 호스트. 등록하지 않은 호스트는 아예 막힌다.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
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
