-- 2026-09-28 점검: 자주 쓰는 조회 컬럼 인덱스 + 구독 선택분 (주기, 배송일, 상품) 유니크 (중복 0건 확인 후 적용)
-- CreateIndex
CREATE INDEX "addresses_userId_idx" ON "addresses"("userId");
-- CreateIndex
CREATE INDEX "deliveries_scheduledDate_idx" ON "deliveries"("scheduledDate");
-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");
-- CreateIndex
CREATE INDEX "orders_userId_idx" ON "orders"("userId");
-- CreateIndex
CREATE INDEX "orders_deliveryDate_status_type_idx" ON "orders"("deliveryDate", "status", "type");
-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");
-- CreateIndex
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");
-- CreateIndex
CREATE INDEX "subscription_selections_deliveryDate_idx" ON "subscription_selections"("deliveryDate");
-- CreateIndex
CREATE UNIQUE INDEX "subscription_selections_subscriptionPeriodId_deliveryDate_p_key" ON "subscription_selections"("subscriptionPeriodId", "deliveryDate", "productId");
-- CreateIndex
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");
-- CreateIndex
CREATE INDEX "subscriptions_status_nextBillingDate_idx" ON "subscriptions"("status", "nextBillingDate");
