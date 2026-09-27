-- CreateEnum
CREATE TYPE "PauseMode" AS ENUM ('CREDIT', 'EXTEND');
-- CreateEnum
CREATE TYPE "RefundKind" AS ENUM ('SUBSCRIPTION_CANCEL', 'CREDIT_PAYOUT', 'ORDER');
-- CreateEnum
CREATE TYPE "RefundReason" AS ENUM ('TASTE', 'DELIVERY', 'PRICE', 'PERSONAL', 'HEALTH', 'COMPETITOR', 'OTHER');
-- CreateEnum
CREATE TYPE "RefundRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');
-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "pauseMode" "PauseMode";
-- CreateTable
CREATE TABLE "refund_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "orderId" TEXT,
    "kind" "RefundKind" NOT NULL,
    "reason" "RefundReason",
    "reasonDetail" TEXT,
    "requestedAmount" INTEGER NOT NULL,
    "feeAmount" INTEGER NOT NULL DEFAULT 0,
    "refundAmount" INTEGER,
    "status" "RefundRequestStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "processedById" TEXT,
    "processedAt" TIMESTAMP(3),
    "paymentKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "refund_requests_status_createdAt_idx" ON "refund_requests"("status", "createdAt");
-- CreateIndex
CREATE INDEX "refund_requests_userId_idx" ON "refund_requests"("userId");
-- CreateIndex
CREATE INDEX "refund_requests_subscriptionId_idx" ON "refund_requests"("subscriptionId");
-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS (다른 테이블과 동일하게 기본 거부 — 새 테이블은 반드시 켠다)
ALTER TABLE "public"."refund_requests" ENABLE ROW LEVEL SECURITY;
