-- _prisma_migrations RLS 재적용
--
-- baseline(20260927000000)에도 같은 구문이 있지만, 9/27 복구 과정에서
-- 이 테이블이 재생성되며 설정이 풀렸다. 2026-09-28 백업 복원 리허설에서
-- 운영 DB의 RLS 가 꺼져 있는 것을 확인했다.
--
-- public 스키마는 PostgREST 로 노출되므로 RLS 가 꺼져 있으면 anon 키만으로
-- 마이그레이션 이력(=스키마 구조)이 읽힌다. 멱등이라 여러 번 실행해도 안전하다.
ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
