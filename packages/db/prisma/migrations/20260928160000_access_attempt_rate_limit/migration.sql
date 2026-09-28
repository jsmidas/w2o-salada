-- 접근 시도 기록 (rate limit)
-- 로그인·인증번호 발송처럼 남용 대상 동작의 시도를 남겨 "최근 N분에 몇 번"을 센다.
-- 서버리스는 요청마다 인스턴스가 달라 메모리에 셀 수 없어 DB에 둔다.

-- CreateTable
CREATE TABLE "access_attempts" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "access_attempts_key_createdAt_idx" ON "access_attempts"("key", "createdAt");

-- CreateIndex
CREATE INDEX "access_attempts_createdAt_idx" ON "access_attempts"("createdAt");

-- public 스키마는 PostgREST로 노출되므로 RLS를 켠다 (정책 없음 = 기본 거부)
ALTER TABLE "public"."access_attempts" ENABLE ROW LEVEL SECURITY;
