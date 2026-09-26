-- 2026-09-27 복구: shadow DB 리셋으로 테이블이 재생성되면서 RLS가 풀렸다. 전 테이블 다시 활성화.
-- (정책을 추가하지 않으므로 anon/authenticated 는 기본 거부. Prisma는 postgres 역할이라 영향 없음)
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
ALTER TABLE "public"."inquiries"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."settings"                 ENABLE ROW LEVEL SECURITY;
-- 스토리지 anon 전면 허용 정책은 이미 제거된 상태여야 한다 (멱등)
DROP POLICY IF EXISTS "allow all 1ffg0oo_0" ON "storage"."objects";
DROP POLICY IF EXISTS "allow all 1ffg0oo_1" ON "storage"."objects";
DROP POLICY IF EXISTS "allow all 1ffg0oo_2" ON "storage"."objects";
DROP POLICY IF EXISTS "allow all 1ffg0oo_3" ON "storage"."objects";
