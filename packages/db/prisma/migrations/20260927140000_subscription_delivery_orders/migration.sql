-- 구독 배송일별 배송 건 (type SUBSCRIPTION_DELIVERY) — 월 결제 주문과 분리해 배송·피킹·집계가 같은 것을 보게 한다
ALTER TYPE "OrderType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_DELIVERY';

-- 배송일당 구독 1건만 (멱등 생성). NULL(단건 주문)은 서로 다른 값으로 취급된다
CREATE UNIQUE INDEX IF NOT EXISTS "orders_subscriptionId_deliveryDate_type_key" ON "orders"("subscriptionId", "deliveryDate", "type");
