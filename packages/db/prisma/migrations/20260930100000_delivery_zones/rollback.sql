-- 20260930100000_delivery_zones 롤백
--
-- 순서 (중요):
--   1. 이 마이그레이션 이전 코드를 먼저 배포한다 — 새 코드는 새 컬럼을 select 하므로 컬럼을 먼저 지우면 주문·배송지 API 가 죽는다
--   2. 운영 DB 에서 이 파일을 실행한다 (psql "$DIRECT_URL" -f rollback.sql)
--   3. npx prisma migrate resolve --rolled-back 20260930100000_delivery_zones  (이력 정리)
--
-- 권역·예외·중지·대기 신청 데이터는 함께 사라진다. 대기 신청은 지우기 전에 관리자 화면에서 CSV 로 내려받아 둘 것.
-- 새 컬럼은 NULL 허용이라 DROP COLUMN 도 즉시 끝난다.

ALTER TABLE "public"."addresses" DROP CONSTRAINT IF EXISTS "addresses_zoneId_fkey";
ALTER TABLE "public"."delivery_zone_rules" DROP CONSTRAINT IF EXISTS "delivery_zone_rules_apartmentId_fkey";
ALTER TABLE "public"."delivery_zone_suspensions" DROP CONSTRAINT IF EXISTS "delivery_zone_suspensions_zoneId_fkey";

DROP INDEX IF EXISTS "public"."addresses_zipCode_idx";
DROP INDEX IF EXISTS "public"."addresses_zoneId_idx";

ALTER TABLE "public"."addresses" DROP COLUMN IF EXISTS "areaReason", DROP COLUMN IF EXISTS "bcode", DROP COLUMN IF EXISTS "zoneId";
ALTER TABLE "public"."subscriptions" DROP COLUMN IF EXISTS "zoneBlockedAt", DROP COLUMN IF EXISTS "zoneBlockedReason";

DROP TABLE IF EXISTS "public"."delivery_waitlist";
DROP TABLE IF EXISTS "public"."delivery_zone_suspensions";
DROP TABLE IF EXISTS "public"."delivery_zone_rules";
DROP TABLE IF EXISTS "public"."delivery_zones";

DROP TYPE IF EXISTS "ZoneRuleAction";
DROP TYPE IF EXISTS "ZoneKeyKind";
