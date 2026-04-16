import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 성능 추적 샘플링 (1.0 = 100%, prod에선 0.1~0.3 권장)
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

  // 세션 리플레이 (에러 재현용) — 상용 트래픽 생기면 다시 고려
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  // dev 환경에선 노이즈 줄이려 비활성화
  enabled: process.env.NODE_ENV === "production",

  // 개인정보 포함 가능성 있는 데이터 자동 필터링
  sendDefaultPii: false,
});
