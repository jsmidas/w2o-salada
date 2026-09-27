/**
 * 구독 소유권 가드 — 고객용 구독 API 공통.
 *
 * 규칙
 * - 회원 구독(userId !== "guest")은 로그인 + 본인만. 관리자는 점검용으로 통과.
 * - guest 구독(비로그인 신청, 카드 없음·PENDING)은 아직 주인이 없어 소유권을 증명할 수 없다.
 *   메뉴 미리보기·교체는 허용하되, 활성화됐거나 빌링키가 붙은 구독은 guest 라도 막는다.
 * - 없는 구독과 남의 구독을 같은 404 로 응답해 ID 열거를 돕지 않는다.
 */
import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import type { Subscription } from "@prisma/client";
import { auth } from "../../auth";

export type SessionUser = { id: string; role?: string } | null;
/** 가드가 돌려주는 구독 행 — 소유권 판정에 billingKey 유무가 필요해 전역 omit 을 해제한 형태 */
export type OwnedSubscription = Subscription;

export async function sessionUser(): Promise<SessionUser> {
  try {
    const session = await auth();
    const u = session?.user as { id?: string; role?: string } | undefined;
    return u?.id ? { id: u.id, role: u.role } : null;
  } catch {
    return null;
  }
}

const notFound = () => NextResponse.json({ error: "구독을 찾을 수 없습니다." }, { status: 404 });
const needLogin = () => NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

/** 세션 사용자가 이 구독을 다룰 수 있는지. 통과하면 구독 행과 사용자를 돌려준다 */
export async function requireSubscriptionOwner(
  subscriptionId: string | null | undefined,
): Promise<{ error: NextResponse; subscription: null; user: SessionUser } | { error: null; subscription: OwnedSubscription; user: SessionUser }> {
  if (!subscriptionId) {
    return { error: NextResponse.json({ error: "subscriptionId 필요" }, { status: 400 }), subscription: null, user: null };
  }
  const [user, subscription] = await Promise.all([
    sessionUser(),
    prisma.subscription.findUnique({ where: { id: subscriptionId }, omit: { billingKey: false } }),
  ]);
  if (!subscription) return { error: notFound(), subscription: null, user };

  const check = checkOwnership(subscription, user);
  if (check) return { error: check, subscription: null, user };
  return { error: null, subscription, user };
}

/** 소유권 판정만 (이미 로드한 구독에 쓴다). 통과면 null, 아니면 응답 */
export function checkOwnership(
  subscription: Pick<Subscription, "userId" | "billingKey" | "status">,
  user: SessionUser,
): NextResponse | null {
  if (user?.role === "ADMIN") return null;
  if (subscription.userId === "guest") {
    // 주인이 정해지지 않은 신청 단계만 열어둔다
    return !subscription.billingKey && subscription.status === "PENDING" ? null : notFound();
  }
  if (!user) return needLogin();
  return subscription.userId === user.id ? null : notFound();
}
