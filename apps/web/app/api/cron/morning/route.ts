import { NextResponse } from "next/server";
import { cronAuthorized, runCronGroup } from "../../../lib/cron-group";
import { GET as deliveryArrived } from "../delivery-arrived/route";
import { GET as renewalCharge } from "../renewal-charge/route";
import { GET as pushDuePrices } from "../push-due-prices/route";

// 아침 묶음 (매일 KST 07:30)
//
// Vercel Hobby 플랜은 프로젝트당 크론을 2개까지만 등록할 수 있다. 작업마다 하나씩 걸면
// 상한을 넘는 것이 조용히 등록되지 않아 구독 자동결제가 안 도는 채로 운영될 수 있다.
// 시각이 비슷한 작업을 묶어 크론 하나로 돌린다.
// 개별 엔드포인트는 그대로 남아 있어 손으로 하나만 돌릴 수도 있다.
//
// 묶음 안의 작업은 모두 멱등이다 — 두 번 돌아도 중복 발송·중복 청구가 없다.
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runCronGroup(request, [
    // 간밤 배송분 도착 알림 — 고객이 아침에 가장 먼저 볼 내용이라 먼저 보낸다
    ["delivery-arrived", deliveryArrived],
    // 구독 자동 갱신 결제 (원래 06:00 → 묶으면서 07:30. 결제 완료 알림도 이 시각에 나간다)
    ["renewal-charge", renewalCharge],
    // 예약 인상가 승격 + 접근 시도 기록 정리
    // (원래 00:05 였다. 새 가격은 07:30 부터 적용되므로 그 전 새벽 주문은 이전 가격으로 나간다)
    ["push-due-prices", pushDuePrices],
  ]);

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
