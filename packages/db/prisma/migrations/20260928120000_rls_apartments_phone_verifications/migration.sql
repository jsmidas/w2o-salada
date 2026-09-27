-- 2026-09-28 전체 코드 점검: apartments · phone_verifications 는 생성 시 RLS 를 켜지 않아
-- 브라우저에 들어가는 anon 키로 REST 조회·변조가 가능했다. 다른 테이블과 같이 기본 거부로 맞춘다.
-- (정책 없이 ENABLE 만 하면 anon/authenticated 는 전부 거부, 서버의 service_role · Prisma 직결은 영향 없음)
ALTER TABLE "public"."apartments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."phone_verifications" ENABLE ROW LEVEL SECURITY;
