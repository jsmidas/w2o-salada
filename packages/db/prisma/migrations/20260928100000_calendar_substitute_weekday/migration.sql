-- 휴일 대체 배송일의 원래 요일 (추가만, 기존 데이터 변경 없음)
-- 화요일이 휴일이라 월요일에 배송하면 substituteWeekday=2. 요일별 구독 구성은 이 요일로 해석한다. null=실제 요일

-- AlterTable
ALTER TABLE "delivery_calendar" ADD COLUMN     "substituteWeekday" INTEGER;
