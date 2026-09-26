-- ============================================================
-- 보충 — inquiries 테이블 RLS 활성화
-- ============================================================
-- inquiries 테이블은 코드에서 사용 중이지만 (admin/settings, mypage)
-- prisma/schema.prisma에는 모델이 빠져 있어 직전 RLS 마이그레이션
-- 대상에서 누락됐다. name·phone·content 등 PII가 저장되므로 즉시 보호.
--
-- 후속 과제(코드): schema.prisma에 model Inquiry 추가하여 schema drift 해소.
-- ============================================================

ALTER TABLE "public"."inquiries" ENABLE ROW LEVEL SECURITY;
