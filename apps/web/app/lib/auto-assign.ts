import { prisma } from "@repo/db";

export type SlotMap = Record<string, number>;

/** 요일별 슬롯 — key = 요일 문자열("0"=일 ~ "6"=토). 없는 요일은 기본 slots 를 쓴다 */
export type WeekdaySlotMap = Record<string, SlotMap>;

/**
 * 배송일에 적용할 슬롯. 우선순위: 요일별 구성 > 기본 구성.
 * 배송 캘린더 날짜는 UTC 자정으로 저장되므로 요일도 UTC 기준으로 읽는다.
 * 휴일 대체 배송일(DeliveryCalendar.substituteWeekday)이면 실제 요일 대신 원래 요일로 해석한다 —
 * 화요일이 휴일이라 월요일에 나가는 배송은 고객의 "화요일 구성"을 받아야 한다.
 */
export function slotsForDate(
  base: SlotMap,
  weekday: WeekdaySlotMap | null | undefined,
  date: Date,
  substituteWeekday?: number | null,
): SlotMap {
  if (!weekday) return base;
  const dow = substituteWeekday ?? date.getUTCDay();
  const override = weekday[String(dow)];
  return override && typeof override === "object" ? override : base;
}

/**
 * 클라이언트에서 온 요일별 슬롯 검증 — 요일 키 0~6, 값은 slug→음이 아닌 정수. 형식이 틀리면 null.
 * 요일이 하나도 없으면 null (기본 구성만 쓰는 것과 같다)
 */
export function sanitizeWeekdaySlots(input: unknown): WeekdaySlotMap | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const out: WeekdaySlotMap = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!/^[0-6]$/.test(k) || !v || typeof v !== "object" || Array.isArray(v)) continue;
    const m: SlotMap = {};
    for (const [slug, n] of Object.entries(v as Record<string, unknown>)) {
      const num = Number(n);
      if (Number.isInteger(num) && num >= 0) m[slug] = num;
    }
    out[k] = m;
  }
  return Object.keys(out).length > 0 ? out : null;
}

type PoolProduct = {
  id: string;
  name: string;
  price: number;
  stock: number;
  sortOrder: number;
  category: { slug: string; isOption: boolean };
};

type AutoAssignResult = {
  filled: { slug: string; productId: string }[];
  shortages: { slug: string; wanted: number; got: number }[];
};

const RECENT_WINDOW_DAYS = 14;

/**
 * 주어진 구독의 slots 설정에 따라 특정 배송일의 MenuAssignment 풀에서 상품을 자동 배정한다.
 *
 * 규칙:
 * 1. 최근 14일 내 같은 구독에 배정된 productId는 후순위 (2주 제외)
 * 2. 제외 후 후보가 부족하면 전체 풀에서 다시 뽑음
 * 3. 정렬: 재고 desc → sortOrder asc
 */
export async function autoAssignForDelivery(params: {
  subscriptionId: string;
  slots: SlotMap;
  deliveryDate: Date;
  /** 아직 DB 에 없는 최근 배정 (주기 미리보기가 앞 배송일에서 고른 상품) — 같은 주기 안에서 매번 같은 상품이 뽑히지 않게 */
  extraRecent?: Iterable<string>;
}): Promise<AutoAssignResult> {
  const { subscriptionId, slots, deliveryDate, extraRecent } = params;

  // 1) 해당 배송일의 메뉴 풀 로드
  const calendar = await prisma.deliveryCalendar.findUnique({
    where: { date: deliveryDate },
    include: {
      menuAssignments: {
        include: {
          product: {
            select: {
              id: true, name: true, price: true, stock: true, sortOrder: true,
              category: { select: { slug: true, isOption: true } },
            },
          },
        },
      },
    },
  });

  if (!calendar) {
    return {
      filled: [],
      shortages: Object.entries(slots)
        .filter(([, n]) => n > 0)
        .map(([slug, wanted]) => ({ slug, wanted, got: 0 })),
    };
  }

  const pool: PoolProduct[] = calendar.menuAssignments
    .map((ma) => ma.product as PoolProduct)
    .filter((p) => p.stock > 0);

  // 2) 최근 14일 내 이 구독에 배정된 productId 로드
  const since = new Date(deliveryDate);
  since.setDate(since.getDate() - RECENT_WINDOW_DAYS);
  const recentSelections = await prisma.subscriptionSelection.findMany({
    where: {
      subscriptionPeriod: { subscriptionId },
      deliveryDate: { gte: since, lt: deliveryDate },
    },
    select: { productId: true },
  });
  const recentSet = new Set(recentSelections.map((s) => s.productId));
  for (const id of extraRecent ?? []) recentSet.add(id);

  // 3) 슬롯별 배정
  const filled: { slug: string; productId: string }[] = [];
  const shortages: { slug: string; wanted: number; got: number }[] = [];
  const usedInThisDelivery = new Set<string>();

  for (const [slug, wanted] of Object.entries(slots)) {
    if (wanted <= 0) continue;

    const categoryPool = pool.filter((p) => p.category.slug === slug && !usedInThisDelivery.has(p.id));
    if (categoryPool.length === 0) {
      shortages.push({ slug, wanted, got: 0 });
      continue;
    }

    const fresh = categoryPool.filter((p) => !recentSet.has(p.id));
    const candidates = fresh.length >= wanted ? fresh : categoryPool;

    candidates.sort((a, b) => {
      if (b.stock !== a.stock) return b.stock - a.stock;
      return a.sortOrder - b.sortOrder;
    });

    const picked = candidates.slice(0, wanted);
    for (const p of picked) {
      filled.push({ slug, productId: p.id });
      usedInThisDelivery.add(p.id);
    }

    if (picked.length < wanted) {
      shortages.push({ slug, wanted, got: picked.length });
    }
  }

  return { filled, shortages };
}

/**
 * 다음 활성 배송일을 찾는다. (오늘 이후 가장 이른 DeliveryCalendar 중 isActive=true)
 */
export async function findNextDeliveryDate(from: Date = new Date()): Promise<Date | null> {
  const startOfTomorrow = new Date(from);
  startOfTomorrow.setHours(0, 0, 0, 0);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const next = await prisma.deliveryCalendar.findFirst({
    where: { date: { gte: startOfTomorrow }, isActive: true },
    orderBy: { date: "asc" },
    select: { date: true },
  });
  return next?.date ?? null;
}
