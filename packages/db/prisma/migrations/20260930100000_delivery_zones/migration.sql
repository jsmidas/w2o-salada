-- 배송 권역 관리 (2026-09-30)
--
-- 추가 전용(additive) 마이그레이션 — 기존 행·컬럼을 바꾸거나 지우지 않는다.
--   enum 2개, 테이블 4개(delivery_zones / delivery_zone_rules / delivery_zone_suspensions / delivery_waitlist),
--   addresses 컬럼 3개(bcode·zoneId·areaReason, 모두 NULL 허용), subscriptions 컬럼 2개(zoneBlockedAt·zoneBlockedReason).
-- 새 컬럼은 전부 NULL 허용이라 테이블 재작성 없이 즉시 끝난다.
--
-- 롤백: 같은 폴더의 rollback.sql (이전 코드를 먼저 배포한 뒤 실행).
-- 새 테이블은 anon 키 REST 노출을 막기 위해 RLS 를 켠다 (정책 없이 ENABLE 만 하면 기본 거부, Prisma 직결은 영향 없음).

-- CreateEnum
CREATE TYPE "ZoneKeyKind" AS ENUM ('ZIP', 'BCODE');

-- CreateEnum
CREATE TYPE "ZoneRuleAction" AS ENUM ('ALLOW', 'BLOCK');

-- AlterTable
ALTER TABLE "addresses" ADD COLUMN     "areaReason" TEXT,
ADD COLUMN     "bcode" TEXT,
ADD COLUMN     "zoneId" TEXT;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "zoneBlockedAt" TIMESTAMP(3),
ADD COLUMN     "zoneBlockedReason" TEXT;

-- CreateTable
CREATE TABLE "delivery_zones" (
    "id" TEXT NOT NULL,
    "kind" "ZoneKeyKind" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sido" TEXT,
    "sigungu" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_zone_rules" (
    "id" TEXT NOT NULL,
    "action" "ZoneRuleAction" NOT NULL,
    "zipCode" TEXT,
    "buildingName" TEXT,
    "apartmentId" TEXT,
    "sigungu" TEXT,
    "reason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_zone_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_zone_suspensions" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "zoneId" TEXT,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_zone_suspensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_waitlist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "bcode" TEXT,
    "sido" TEXT,
    "sigungu" TEXT,
    "bname" TEXT,
    "address1" TEXT,
    "buildingName" TEXT,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3),
    "userId" TEXT,
    "source" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_zones_isActive_idx" ON "delivery_zones"("isActive");

-- CreateIndex
CREATE INDEX "delivery_zones_sigungu_idx" ON "delivery_zones"("sigungu");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_zones_kind_code_key" ON "delivery_zones"("kind", "code");

-- CreateIndex
CREATE INDEX "delivery_zone_rules_zipCode_idx" ON "delivery_zone_rules"("zipCode");

-- CreateIndex
CREATE INDEX "delivery_zone_rules_buildingName_idx" ON "delivery_zone_rules"("buildingName");

-- CreateIndex
CREATE INDEX "delivery_zone_rules_isActive_idx" ON "delivery_zone_rules"("isActive");

-- CreateIndex
CREATE INDEX "delivery_zone_suspensions_date_idx" ON "delivery_zone_suspensions"("date");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_zone_suspensions_date_zoneId_key" ON "delivery_zone_suspensions"("date", "zoneId");

-- CreateIndex
CREATE INDEX "delivery_waitlist_sigungu_bname_idx" ON "delivery_waitlist"("sigungu", "bname");

-- CreateIndex
CREATE INDEX "delivery_waitlist_createdAt_idx" ON "delivery_waitlist"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_waitlist_phone_zipCode_key" ON "delivery_waitlist"("phone", "zipCode");

-- CreateIndex
CREATE INDEX "addresses_zipCode_idx" ON "addresses"("zipCode");

-- CreateIndex
CREATE INDEX "addresses_zoneId_idx" ON "addresses"("zoneId");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "delivery_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_zone_rules" ADD CONSTRAINT "delivery_zone_rules_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "apartments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_zone_suspensions" ADD CONSTRAINT "delivery_zone_suspensions_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "delivery_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS (public 스키마는 PostgREST 로 노출된다)
ALTER TABLE "public"."delivery_zones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."delivery_zone_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."delivery_zone_suspensions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."delivery_waitlist" ENABLE ROW LEVEL SECURITY;
