-- ============================================================
-- Supabase Security Advisor 대응 — public 스키마 전체 RLS 활성화
-- ============================================================
-- 배경: Supabase는 public 스키마를 PostgREST(Data API)로 자동 노출한다.
--      RLS가 꺼져 있으면 브라우저에 노출된 anon 키만으로
--      https://<project>.supabase.co/rest/v1/<table> 경로로 누구나
--      SELECT/UPDATE/DELETE가 가능하다 (users.password, payments.billingKey,
--      addresses.phone 등 민감 컬럼 포함).
--
-- 처방: 모든 application 테이블에 RLS 활성화. 정책을 추가하지 않으면
--      기본 거부(default deny). anon/authenticated 역할은 어떤 행도
--      읽지 못한다.
--
-- 앱 영향: 없음.
--   - 이 앱은 Prisma + DATABASE_URL(postgres 슈퍼유저)로 직접 접속한다.
--   - postgres 역할은 테이블 OWNER이자 BYPASSRLS 권한을 가져 RLS의 영향을
--     받지 않으므로 모든 쿼리는 변경 없이 동작한다.
--   - Supabase JS 클라이언트는 Storage 업로드에만 사용되므로 영향 없음.
--
-- 보조 조치(대시보드에서 수동): Project Settings → Data API →
--   Exposed schemas에서 public 제거. 이 마이그레이션과 함께 적용 시 이중 방어.
-- ============================================================

ALTER TABLE "public"."users"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."addresses"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."categories"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."products"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."orders"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."order_items"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."payments"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."subscriptions"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."subscription_items"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."subscription_periods"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."subscription_selections"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."deliveries"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."delivery_calendar"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."menu_assignments"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."menu_schedules"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."notifications"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."product_pages"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."reviews"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."settings"                 ENABLE ROW LEVEL SECURITY;

-- Prisma 내부 마이그레이션 이력 테이블도 보호 (스키마 정보 leak 차단)
ALTER TABLE "public"."_prisma_migrations"       ENABLE ROW LEVEL SECURITY;
