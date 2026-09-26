-- Baseline 2026-09-27: 실제 운영 DB 스키마 전체 (이전 4개 마이그레이션은 db push 운영과 어긋나 migrations_archive/ 로 이동)
-- 새 DB에는 migrate deploy 로 이 파일이 실행되고, 기존 DB에는 migrate resolve --applied 로 적용 완료 처리한다.
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'ADMIN', 'DRIVER');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('SINGLE', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'PREPARING', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('READY', 'DONE', 'CANCELLED', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "SelectionMode" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('LIGHT', 'REGULAR', 'PREMIUM');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ALIMTALK', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('PENDING', 'PAID', 'DELIVERING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'RESOLVED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "permissions" TEXT,
    "provider" TEXT,
    "providerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "address1" TEXT NOT NULL,
    "address2" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "deliveryMemo" TEXT,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isOption" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "originalPrice" INTEGER,
    "singlePrice" INTEGER,
    "price" INTEGER NOT NULL,
    "nextPrice" INTEGER,
    "nextPriceEffectiveFrom" TIMESTAMP(3),
    "kcal" INTEGER,
    "imageUrl" TEXT,
    "tags" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stock" INTEGER NOT NULL DEFAULT 999,
    "dailyLimit" INTEGER,
    "availableDays" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addressId" TEXT,
    "subscriptionId" TEXT,
    "type" "OrderType" NOT NULL DEFAULT 'SINGLE',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" INTEGER NOT NULL,
    "deliveryFee" INTEGER NOT NULL DEFAULT 0,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "paymentKey" TEXT,
    "paidAt" TIMESTAMP(3),
    "deliveryDate" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "totalPrice" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentKey" TEXT,
    "method" TEXT,
    "amount" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'READY',
    "billingKey" TEXT,
    "receiptUrl" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "rawResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planType" "PlanType",
    "frequency" "Frequency",
    "selectionMode" "SelectionMode" NOT NULL DEFAULT 'MANUAL',
    "itemsPerDelivery" INTEGER NOT NULL DEFAULT 2,
    "slots" JSONB,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "billingKey" TEXT,
    "nextBillingDate" TIMESTAMP(3),
    "nextDeliveryDate" TIMESTAMP(3),
    "renewalNotifiedAt" TIMESTAMP(3),
    "price" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_items" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "dayOfWeek" INTEGER,

    CONSTRAINT "subscription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "driverId" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "photoUrl" TEXT,
    "memo" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "templateCode" TEXT,
    "content" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_pages" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "heroImages" TEXT,
    "subtitle" TEXT,
    "featureTitle" TEXT,
    "featureDescription" TEXT,
    "featureImages" TEXT,
    "keyPoints" TEXT,
    "specs" TEXT,
    "detailDescription" TEXT,
    "detailImages" TEXT,
    "nutrition" TEXT,
    "galleryImages" TEXT,
    "sectionOrder" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_calendar" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_calendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_assignments" (
    "id" TEXT NOT NULL,
    "deliveryCalendarId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_periods" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "orderId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_selections" (
    "id" TEXT NOT NULL,
    "subscriptionPeriodId" TEXT NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER,

    CONSTRAINT "subscription_selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_schedules" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "day" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orderId" TEXT,
    "rating" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "images" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiries" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "content" TEXT NOT NULL,
    "images" TEXT,
    "status" "InquiryStatus" NOT NULL DEFAULT 'PENDING',
    "reply" TEXT,
    "repliedBy" TEXT,
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "products_categoryId_isActive_sortOrder_idx" ON "products"("categoryId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNo_key" ON "orders"("orderNo");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_orderId_key" ON "deliveries"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "product_pages_productId_key" ON "product_pages"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_calendar_date_key" ON "delivery_calendar"("date");

-- CreateIndex
CREATE UNIQUE INDEX "menu_assignments_deliveryCalendarId_productId_key" ON "menu_assignments"("deliveryCalendarId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_periods_subscriptionId_year_month_key" ON "subscription_periods"("subscriptionId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "menu_schedules_year_month_week_day_slot_key" ON "menu_schedules"("year", "month", "week", "day", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_assignments" ADD CONSTRAINT "menu_assignments_deliveryCalendarId_fkey" FOREIGN KEY ("deliveryCalendarId") REFERENCES "delivery_calendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_assignments" ADD CONSTRAINT "menu_assignments_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_periods" ADD CONSTRAINT "subscription_periods_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_selections" ADD CONSTRAINT "subscription_selections_subscriptionPeriodId_fkey" FOREIGN KEY ("subscriptionPeriodId") REFERENCES "subscription_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_selections" ADD CONSTRAINT "subscription_selections_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_schedules" ADD CONSTRAINT "menu_schedules_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── RLS ──
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
DROP POLICY IF EXISTS "allow all 1ffg0oo_0" ON "storage"."objects";
DROP POLICY IF EXISTS "allow all 1ffg0oo_1" ON "storage"."objects";
DROP POLICY IF EXISTS "allow all 1ffg0oo_2" ON "storage"."objects";
DROP POLICY IF EXISTS "allow all 1ffg0oo_3" ON "storage"."objects";
ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
