import { NextResponse } from "next/server";
import { cronAuthorized, runCronGroup } from "../../../lib/cron-group";
import { GET as renewalNotify } from "../renewal-notify/route";
import { GET as menuSelectNotify } from "../menu-select-notify/route";

// 안내 묶음 (매일 KST 09:00)
//
// 시각이 같은 알림 둘을 묶어 크론 하나로 돌린다. 자세한 사정은 ../morning/route.ts 참고.
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runCronGroup(request, [
    // 구독 갱신 7일 전 예정 금액 고지 (변동 금액 정기결제라 필수) — 이미 알린 건은 건너뛴다
    ["renewal-notify", renewalNotify],
    // 배송 3일 전 메뉴 선택 요청
    ["menu-select-notify", menuSelectNotify],
  ]);

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
