import { prisma } from "@repo/db";

// 가격 인상 예약 시스템 — Product.nextPrice + nextPriceEffectiveFrom
//
// 운영 흐름:
//   1. 관리자가 "5/1부터 6,500원" 미리 등록 → nextPrice=6500, nextPriceEffectiveFrom=5/1
//   2. 5/1 이전: product.price(현재가)로 결제·표시
//   3. 5/1 이후 첫 호출 시점: pushDuePrices() 한 줄로 모든 도래분 일괄 승격
//      → 이후 모든 fetch는 자동으로 새 가격 반환
//   4. 결제는 항상 product.price 기준 → OrderItem.unitPrice / SubscriptionSelection.unitPrice에 잠금
//
// 기존 결제(잠금가)는 영향 없음. 신규 결제부터 새 가격이 적용됨.
//
// 사용법:
//   import { pushDuePrices } from "../lib/effective-price";
//   await pushDuePrices();           // product fetch 전에 한 번만 호출
//   const products = await prisma.product.findMany(...);

/**
 * 적용일 도래분(`nextPriceEffectiveFrom <= asOf` AND `nextPrice IS NOT NULL`)을
 * 일괄로 product.price ← nextPrice 승격하고 예약 필드를 클리어.
 *
 * 부담은 매우 작음: 도래분이 없으면 0 row affected.
 * 어느 진입점에서 호출하든 idempotent.
 *
 * @returns 승격된 row 수
 */
export async function pushDuePrices(asOf: Date = new Date()): Promise<number> {
  const result = await prisma.$executeRaw`
    UPDATE "products"
    SET "price" = "nextPrice",
        "nextPrice" = NULL,
        "nextPriceEffectiveFrom" = NULL
    WHERE "nextPriceEffectiveFrom" <= ${asOf}
      AND "nextPrice" IS NOT NULL
  `;
  return Number(result);
}
