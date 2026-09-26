-- DropIndex
DROP INDEX "subscription_periods_subscriptionId_year_month_key";

-- AlterTable
ALTER TABLE "subscription_periods" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "weeks" INTEGER;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "autoRenew" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "creditBalance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cycleWeeks" INTEGER NOT NULL DEFAULT 4;

-- CreateIndex
CREATE INDEX "subscription_periods_subscriptionId_startDate_idx" ON "subscription_periods"("subscriptionId", "startDate");

