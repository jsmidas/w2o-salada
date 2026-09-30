import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { auth } from "../../../../auth";
import { clientIp, hitRateLimit } from "../../../lib/rate-limit";
import { cleanText } from "../../../lib/validate";
import { isValidMobile, normalizePhone } from "../../../lib/phone-format";
import { normBcode, normZip } from "../../../lib/delivery-zone";

/**
 * POST /api/delivery/waitlist — 권역 밖 고객의 "우리 동네 오픈 알림" 신청 (공개)
 * body: { name, phone, zipCode, bcode?, sido?, sigungu?, bname?, address1?, buildingName?, marketingConsent, source }
 *
 * - 같은 번호 + 같은 우편번호는 갱신한다 (중복 행 없음)
 * - 개인정보: 이름·연락처·주소(동 단위)만. 상세주소는 받지 않는다. 보관 기간은 관리자 화면에서 정리한다
 * - 남용 방지: IP 당 10분 5회, 번호당 하루 3회
 */
export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const rl = await hitRateLimit(`waitlist:ip:${ip}`, 5, 10 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "신청이 너무 잦습니다. 잠시 후 다시 시도해주세요.", retryAfterSec: rl.retryAfterSec }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const name = cleanText(body.name, 40);
    const phone = normalizePhone(String(body.phone ?? ""));
    const zipCode = normZip(String(body.zipCode ?? ""));
    if (!name) return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
    if (!isValidMobile(phone)) return NextResponse.json({ error: "휴대폰 번호를 확인해주세요." }, { status: 400 });
    if (!zipCode) return NextResponse.json({ error: "주소 검색으로 우편번호를 선택해주세요." }, { status: 400 });

    const perPhone = await hitRateLimit(`waitlist:phone:${phone}`, 3, 24 * 60 * 60 * 1000);
    if (!perPhone.allowed) {
      return NextResponse.json({ error: "이 번호로는 오늘 더 신청할 수 없습니다." }, { status: 429 });
    }

    const session = await auth().catch(() => null);
    const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
    const marketingConsent = body.marketingConsent === true;
    const sourceRaw = String(body.source ?? "landing");
    const source = ["checkout", "subscribe", "landing", "mypage"].includes(sourceRaw) ? sourceRaw : "landing";

    const data = {
      name,
      bcode: normBcode(String(body.bcode ?? "")),
      sido: cleanText(body.sido, 40),
      sigungu: cleanText(body.sigungu, 40),
      bname: cleanText(body.bname, 40),
      address1: cleanText(body.address1, 200),
      buildingName: cleanText(body.buildingName, 100),
      marketingConsent,
      consentAt: new Date(),
      userId,
      source,
    };

    const row = await prisma.deliveryWaitlist.upsert({
      where: { phone_zipCode: { phone, zipCode } },
      update: data,
      create: { ...data, phone, zipCode },
      select: { id: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json({
      ok: true,
      id: row.id,
      renewed: row.updatedAt.getTime() - row.createdAt.getTime() > 1000,
      message: "신청이 접수되었습니다. 우리 동네 배송이 시작되면 문자로 알려드릴게요.",
    });
  } catch (err) {
    console.error("POST /api/delivery/waitlist error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
