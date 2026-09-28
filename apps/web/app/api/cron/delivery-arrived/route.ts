import { NextResponse } from "next/server";
import { notifyArrivalsDue } from "../../../lib/delivery-notify";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

// 배송 도착 알림 (매일 KST 07:30 실행)
// 새벽 3~6시에 배송이 끝나지만 그 시각에 알림을 보내면 자는 사람을 깨운다.
// 아침에 모아서 한 번 보내고, 배송 사진 페이지 주소를 버튼에 담는다.
// idempotent — 이미 보낸 건은 Delivery.arrivedNotifiedAt 로 걸러진다.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  // 시크릿이 비어 있으면 열리는 게 아니라 닫힌다 (fail-closed)
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await notifyArrivalsDue();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("GET /api/cron/delivery-arrived error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
