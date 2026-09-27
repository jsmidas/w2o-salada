import { NextResponse } from "next/server";
import { autoAssignForDelivery, slotsForDate, type SlotMap, type WeekdaySlotMap } from "../../../lib/auto-assign";
import { isOrderable } from "../../../lib/cutoff";
import { PAID_PERIOD_STATUSES, syncNextDeliveryDate } from "../../../lib/subscription-cycle";
import { checkOwnership, requireSubscriptionOwner, sessionUser } from "../../../lib/subscription-guard";

const DEFAULT_MIN_ORDER_AMOUNT = 11000;
const RECENT_DAYS = 14;

// GET: 다음 배송 미리보기 (subscriptionId 기준) — 본인 구독만
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const guard = await requireSubscriptionOwner(searchParams.get("subscriptionId"));
    if (guard.error) return guard.error;
    const subscription = guard.subscription;
    const subscriptionId = subscription.id;

    const { prisma } = await import("@repo/db");

    const baseSlots = (subscription.slots as unknown as SlotMap) ?? {};

    // 다음 배송일: 지났으면 다음 활성 배송일로 전진해 저장
    let nextDate = await syncNextDeliveryDate(subscription);
    if (!nextDate) {
      return NextResponse.json({ error: "활성화된 배송일이 없습니다." }, { status: 400 });
    }
    nextDate = new Date(nextDate);

    // 이 배송일(요일)에 적용되는 슬롯 — 요일별 구성이 있으면 그걸, 없으면 기본 구성.
    // 휴일 대체 배송일이면 캘린더에 적힌 원래 요일로 해석한다
    const calendarDay = await prisma.deliveryCalendar.findUnique({ where: { date: nextDate }, select: { substituteWeekday: true } });
    const slots = slotsForDate(baseSlots, subscription.weekdaySlots as WeekdaySlotMap | null, nextDate, calendarDay?.substituteWeekday);

    // 배송일이 속한 청구 주기 (없으면 다음 주기를 PENDING 으로 만든다)
    const { getOrCreatePeriodForDate } = await import("../../../lib/subscription-cycle");
    const period = await getOrCreatePeriodForDate(subscription, nextDate);

    // 해당 배송일 Selection 로드
    let selections = await prisma.subscriptionSelection.findMany({
      where: {
        subscriptionPeriodId: period.id,
        deliveryDate: nextDate,
      },
      include: {
        product: {
          include: { category: { select: { slug: true, name: true, icon: true, color: true, isOption: true } } },
        },
      },
    });

    // 비어 있으면 자동 배정 실행
    let shortages: { slug: string; wanted: number; got: number }[] = [];
    if (selections.length === 0) {
      const result = await autoAssignForDelivery({
        subscriptionId,
        slots,
        deliveryDate: nextDate,
      });
      shortages = result.shortages;

      if (result.filled.length > 0) {
        await prisma.subscriptionSelection.createMany({
          data: result.filled.map((f) => ({
            subscriptionPeriodId: period!.id,
            deliveryDate: nextDate!,
            productId: f.productId,
            quantity: 1,
          })),
        });
        selections = await prisma.subscriptionSelection.findMany({
          where: { subscriptionPeriodId: period.id, deliveryDate: nextDate },
          include: {
            product: {
              include: { category: { select: { slug: true, name: true, icon: true, color: true, isOption: true } } },
            },
          },
        });
      }
    }

    // 같은 날짜 풀 (바꾸기 모달 후보용)
    const calendar = await prisma.deliveryCalendar.findUnique({
      where: { date: nextDate },
      include: {
        menuAssignments: {
          include: {
            product: {
              include: { category: { select: { slug: true, isOption: true } } },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    const pool = (calendar?.menuAssignments ?? [])
      .map((ma) => ma.product)
      .filter((p) => p.stock > 0);

    // 최근 14일 먹은 것 (다른 날짜 포함)
    const since = new Date(nextDate);
    since.setDate(since.getDate() - RECENT_DAYS);
    const recentRaw = await prisma.subscriptionSelection.findMany({
      where: {
        subscriptionPeriod: { subscriptionId },
        deliveryDate: { gte: since, lt: nextDate },
      },
      select: { productId: true },
    });
    const recentProductIds = Array.from(new Set(recentRaw.map((r) => r.productId)));

    // 금액 계산
    let baseTotal = 0;
    let itemsTotal = 0;
    for (const s of selections) {
      const line = s.product.price * s.quantity;
      itemsTotal += line;
      if (!s.product.category?.isOption) baseTotal += line;
    }

    const minSetting = await prisma.setting.findUnique({ where: { key: "minOrderAmount" } });
    const minAmount = minSetting ? Number(minSetting.value) : DEFAULT_MIN_ORDER_AMOUNT;

    // slots 에 포함된 모든 카테고리 메타 로드 (빈 슬롯도 한글 이름 표시 가능)
    const slotSlugs = Object.keys(slots);
    const slotCategories = slotSlugs.length > 0
      ? await prisma.category.findMany({
          where: { slug: { in: slotSlugs } },
          select: { slug: true, name: true, icon: true, color: true, isOption: true, sortOrder: true },
          orderBy: { sortOrder: "asc" },
        })
      : [];

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        slots,
        status: subscription.status,
      },
      slotCategories,
      period: { id: period.id, status: period.status },
      deliveryDate: nextDate.toISOString(),
      selections: selections.map((s) => ({
        id: s.id,
        productId: s.productId,
        quantity: s.quantity,
        product: s.product,
      })),
      shortages,
      pool,
      recentProductIds,
      baseTotal,
      itemsTotal,
      minAmount,
      meetsMin: baseTotal >= minAmount,
    });
  } catch (err) {
    console.error("GET /api/subscribe/next error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// PATCH: 슬롯 교체 (selectionId의 productId 변경) — 그 selection 이 속한 구독의 주인만
export async function PATCH(request: Request) {
  try {
    const { selectionId, newProductId } = await request.json();
    if (!selectionId || !newProductId) {
      return NextResponse.json({ error: "selectionId, newProductId 필요" }, { status: 400 });
    }

    const { prisma } = await import("@repo/db");

    // 기존 selection(+소유 구독) + 새 상품 조회해서 소유권·카테고리 일치 검증
    const [user, current, newProduct] = await Promise.all([
      sessionUser(),
      prisma.subscriptionSelection.findUnique({
        where: { id: selectionId },
        include: {
          product: { include: { category: true } },
          subscriptionPeriod: { select: { status: true, subscription: { select: { userId: true, billingKey: true, status: true } } } },
        },
      }),
      prisma.product.findUnique({
        where: { id: newProductId },
        include: { category: true },
      }),
    ]);

    if (!current || !newProduct) {
      return NextResponse.json({ error: "대상을 찾을 수 없습니다." }, { status: 404 });
    }
    const denied = checkOwnership(current.subscriptionPeriod.subscription, user);
    if (denied) return denied;
    if (current.product.category?.slug !== newProduct.category?.slug) {
      return NextResponse.json({ error: "같은 카테고리 내에서만 교체할 수 있습니다." }, { status: 400 });
    }
    // 마감(전날 14:00) 뒤엔 이미 조리 수량이 확정됐다
    if (!isOrderable(current.deliveryDate.toISOString().slice(0, 10))) {
      return NextResponse.json({ error: "주문 마감이 지나 이번 배송 메뉴는 바꿀 수 없습니다." }, { status: 400 });
    }
    // 그 배송일 풀에 있는 상품만 (재고 포함)
    const inPool = await prisma.menuAssignment.findFirst({
      where: { productId: newProductId, deliveryCalendar: { date: current.deliveryDate, isActive: true } },
      select: { id: true },
    });
    if (!inPool || !newProduct.isActive || newProduct.stock <= 0) {
      return NextResponse.json({ error: "이 배송일에는 고를 수 없는 상품입니다." }, { status: 400 });
    }
    // 계약가: 결제된 주기는 잠긴 단가를 넘는 상품으로 바꿀 수 없다 (추가 결제 경로가 없다). 미결제 주기는 새 상품가로
    const locked = current.unitPrice ?? current.product.price;
    const paidPeriod = (PAID_PERIOD_STATUSES as readonly string[]).includes(current.subscriptionPeriod.status);
    if (paidPeriod && newProduct.price > locked) {
      return NextResponse.json(
        { error: `결제된 배송분은 ${locked.toLocaleString()}원 이하 상품으로만 바꿀 수 있습니다. (선택 상품 ${newProduct.price.toLocaleString()}원)` },
        { status: 400 },
      );
    }

    await prisma.subscriptionSelection.update({
      where: { id: selectionId },
      data: { productId: newProductId, unitPrice: paidPeriod ? locked : newProduct.price },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/subscribe/next error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
