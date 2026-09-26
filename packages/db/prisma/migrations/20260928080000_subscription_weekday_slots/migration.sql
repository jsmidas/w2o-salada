-- 요일별 구독 구성 (추가만, 기존 데이터 변경 없음)
-- { "2": { "salad": 2 }, "4": { "salad": 1, "onigiri": 1 } } — key=요일(0=일~6=토), 없는 요일은 slots 사용

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "weekdaySlots" JSONB;
