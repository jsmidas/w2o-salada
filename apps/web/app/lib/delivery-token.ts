/**
 * 배송 확인 페이지용 공개 토큰
 *
 * 알림톡 버튼이 여는 /delivery/<토큰> 주소에 쓴다. 로그인 없이 열리므로
 * 주문번호처럼 규칙적인 값을 쓰면 남의 배송 사진을 들여다볼 수 있다.
 * 추측이 불가능하도록 난수를 쓰고, 배송 건마다 하나씩만 발급한다.
 */
import crypto from "crypto";
import { prisma } from "@repo/db";

/** URL 에 그대로 넣을 수 있는 22자 난수 */
function newToken(): string {
  return crypto.randomBytes(16).toString("base64url");
}

/** 해당 배송의 토큰을 돌려준다. 없으면 만들어서 저장한다 (멱등) */
export async function ensureDeliveryToken(deliveryId: string): Promise<string | null> {
  const found = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    select: { publicToken: true },
  });
  if (!found) return null;
  if (found.publicToken) return found.publicToken;

  // 유니크 충돌은 사실상 없지만, 동시에 두 요청이 들어오면 한쪽이 진다
  for (let i = 0; i < 3; i++) {
    const token = newToken();
    try {
      await prisma.delivery.update({ where: { id: deliveryId }, data: { publicToken: token } });
      return token;
    } catch {
      const again = await prisma.delivery.findUnique({
        where: { id: deliveryId },
        select: { publicToken: true },
      });
      if (again?.publicToken) return again.publicToken;
    }
  }
  return null;
}

/** 알림톡 버튼에 넣을 주소의 뒷부분 (#{링크} 변수에 들어간다) */
export function deliveryPublicPath(token: string): string {
  return token;
}
