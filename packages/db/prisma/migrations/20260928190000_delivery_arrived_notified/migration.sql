-- 도착 알림톡 발송 시각
-- 도착 알림은 새벽 배송 직후가 아니라 아침 07:30 크론이 보낸다.
-- 크론은 하루에 여러 번 돌 수 있으므로 "이미 보냈는지"를 배송 건에 남긴다.

-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN     "arrivedNotifiedAt" TIMESTAMP(3);
