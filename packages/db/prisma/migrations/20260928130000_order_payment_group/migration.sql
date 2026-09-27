-- 결제 묶음: 배송일이 다른 주문 N건을 토스 결제 한 번으로 묶는 그룹번호 (단건 결제는 null)
ALTER TABLE "orders" ADD COLUMN "paymentGroupNo" TEXT;

-- CreateIndex
CREATE INDEX "orders_paymentGroupNo_idx" ON "orders"("paymentGroupNo");
