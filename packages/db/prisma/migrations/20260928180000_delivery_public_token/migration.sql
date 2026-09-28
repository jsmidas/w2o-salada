-- 고객용 배송 확인 페이지 주소에 쓰는 공개 키
-- 주문번호(W2O-YYYYMMDD-0001)는 규칙적이라 그대로 주소에 쓰면
-- 남의 배송 사진을 들여다볼 수 있다. 추측 불가능한 값을 따로 둔다.

-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN     "publicToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_publicToken_key" ON "deliveries"("publicToken");
