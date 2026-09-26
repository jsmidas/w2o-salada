-- CreateEnum
CREATE TYPE "SelectionMode" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('PENDING', 'PAID', 'DELIVERING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'RESOLVED');

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "color" TEXT,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isOption" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "availableDays" TEXT,
ADD COLUMN     "dailyLimit" INTEGER,
ADD COLUMN     "nextPrice" INTEGER,
ADD COLUMN     "nextPriceEffectiveFrom" TIMESTAMP(3),
ADD COLUMN     "originalPrice" INTEGER,
ADD COLUMN     "singlePrice" INTEGER;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "itemsPerDelivery" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "renewalNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "selectionMode" "SelectionMode" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "slots" JSONB,
ALTER COLUMN "planType" DROP NOT NULL,
ALTER COLUMN "frequency" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "permissions" TEXT,
ADD COLUMN     "username" TEXT;

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

-- CreateIndex
CREATE INDEX "products_categoryId_isActive_sortOrder_idx" ON "products"("categoryId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

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

