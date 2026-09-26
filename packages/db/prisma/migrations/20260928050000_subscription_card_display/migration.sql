-- 등록 카드 표시용 컬럼 (추가만, 기존 데이터 변경 없음)

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "cardCompany" TEXT,
ADD COLUMN     "cardNumber" TEXT;
