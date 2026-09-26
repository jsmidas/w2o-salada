-- ============================================================
-- storage.objects의 anon 전면 허용 정책 제거
-- ============================================================
-- 발견 상태:
--   anon 역할에 SELECT/INSERT/UPDATE/DELETE가 모두 (true)로 열려 있었음.
--   즉 브라우저에 노출된 anon 키 하나로 누구나 images 버킷의 모든 파일을
--   목록 조회·업로드·교체·삭제할 수 있는 상태. Supabase 대시보드에서 버킷을
--   만들 때 자동 생성되는 "allow all *_0/1/2/3" 패턴.
--
-- 처방:
--   네 정책을 모두 DROP. 추가 정책 불필요.
--   - 공개 URL 경로 /storage/v1/object/public/images/<file> 은 정책과
--     무관하게 동작하므로 기존 306개 상품 이미지 URL은 그대로 노출 유지.
--   - 업로드 API(/api/upload)는 service role 키로 RLS·정책을 우회하도록
--     이미 코드 변경 완료.
--   - anon 역할은 storage.objects에 대한 어떤 권한도 갖지 않음 → 기본 거부.
--
-- 적용 순서 주의:
--   반드시 코드 변경(SUPABASE_SERVICE_ROLE_KEY 사용)이 프로덕션에 배포된 뒤
--   이 마이그레이션을 적용해야 한다. 그 전엔 관리자 업로드가 일시 중단됨.
-- ============================================================

DROP POLICY IF EXISTS "allow all 1ffg0oo_0" ON "storage"."objects";
DROP POLICY IF EXISTS "allow all 1ffg0oo_1" ON "storage"."objects";
DROP POLICY IF EXISTS "allow all 1ffg0oo_2" ON "storage"."objects";
DROP POLICY IF EXISTS "allow all 1ffg0oo_3" ON "storage"."objects";
