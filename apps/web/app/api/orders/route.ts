import { NextResponse } from "next/server";
import { requireAuth } from "../../lib/auth-guard";
import { auth } from "../../../auth";
import { pushDuePrices } from "../../lib/effective-price";
import { CUTOFF_LABEL, firstOrderableDate, isOrderable } from "../../lib/cutoff";

const DEFAULT_MIN_ORDER_AMOUNT = 11000;
// 배송비 정책은 관리자 설정(deliveryFee / freeShippingMin)을 따른다.
// 예전에는 15,000원 미만 3,000원이 코드에 박혀 있어, 설정이 무료여도
// 최소 주문액(11,000원) 주문에 배송비가 붙었다.
const DEFAULT_DELIVERY_FEE = 0;
const DEFAULT_FREE_SHIPPING_MIN = 11000;

type IncomingItem = { productId: string; quantity?: number; deliveryDate?: string | null };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function randomCode(len = 4) {
  return Math.random().toString(36).slice(2, 2 + len).toUpperCase();
}

/**
 * 장바구니 라인의 배송일(YYYY-MM-DD)을 검증해 UTC 자정 Date 로 돌려준다.
 * 날짜가 없는 라인(상품 상세에서 담은 경우)은 지금 주문 가능한 가장 빠른 배송일로 간다.
 */
async function resolveDates(
  prisma: typeof import("@repo/db").prisma,
  items: IncomingItem[],
): Promise<{ error: string } | { byItem: Map<IncomingItem, string>; dates: string[] }> {
  const wanted = new Set<string>();
  for (const it of items) if (typeof it.deliveryDate === "string" && it.deliveryDate) wanted.add(it.deliveryDate);
  for (const d of wanted) if (!DATE_RE.test(d)) return { error: "배송일 형식이 올바르지 않습니다." };

  const needDefault = items.some((it) => !it.deliveryDate);
  let defaultDate: string | null = null;
  if (needDefault) {
    const first = await prisma.deliveryCalendar.findFirst({
      where: { isActive: true, date: { gte: new Date(`${firstOrderableDate()}T00:00:00.000Z`) } },
      orderBy: { date: "asc" },
      select: { date: true },
    });
    if (!first) return { error: "주문 가능한 배송일이 없습니다. 잠시 후 다시 시도해주세요." };
    defaultDate = first.date.toISOString().slice(0, 10);
    wanted.add(defaultDate);
  }

  // 마감·캘린더 활성 검증 (배송일은 UTC 자정으로 저장된다)
  const dates = [...wanted].sort();
  for (const d of dates) {
    if (!isOrderable(d)) return { error: `${d} 배송은 주문이 마감되었습니다. (마감: ${CUTOFF_LABEL})` };
  }
  const days = await prisma.deliveryCalendar.findMany({
    where: { date: { in: dates.map((d) => new Date(`${d}T00:00:00.000Z`)) }, isActive: true },
    select: { date: true },
  });
  const active = new Set(days.map((d) => d.date.toISOString().slice(0, 10)));
  for (const d of dates) if (!active.has(d)) return { error: `${d}은(는) 배송일이 아닙니다.` };

  const byItem = new Map<IncomingItem, string>();
  for (const it of items) byItem.set(it, (typeof it.deliveryDate === "string" && it.deliveryDate) || defaultDate!);
  return { byItem, dates };
}

const fmtDate = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

/**
 * POST: 주문 생성
 * 주문 1건 = 배송일 1개 (배송 리포트·생산 집계·기사 출력이 배송일로 조회한다).
 * 배송일이 여러 개면 주문을 N 건 만들고 같은 paymentGroupNo 로 묶어 토스 결제는 한 번에 한다.
 * 최소 주문액(본품 합계)은 "1회 배송" 기준이라 배송일마다 따로 검사한다.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items: IncomingItem[] = body.items ?? [];

    if (!items.length) {
      return NextResponse.json({ error: "주문 항목이 필요합니다." }, { status: 400 });
    }

    const { prisma } = await import("@repo/db");

    // 배송일 확정 — 없으면 배송 리포트·생산 집계·기사 출력 어디에도 이 주문이 잡히지 않는다
    const resolved = await resolveDates(prisma, items);
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    // 상품 정보 + 카테고리 옵션 여부 로드 (도래한 가격 인상분 먼저 승격)
    await pushDuePrices();
    const productIds = items.map((i) => i.productId).filter(Boolean);
    const [setting, products, feeSettings] = await Promise.all([
      prisma.setting.findUnique({ where: { key: "minOrderAmount" } }),
      prisma.product.findMany({
        where: { id: { in: productIds } },
        include: { category: { select: { isOption: true } } },
      }),
      prisma.setting.findMany({ where: { key: { in: ["deliveryFee", "freeShippingMin"] } } }),
    ]);
    // 설정값이 "11,000" 처럼 숫자가 아니면 NaN 비교로 최소액 검사가 통째로 뚫린다 → 기본값
    const minAmount = setting?.value !== undefined && setting.value !== "" && Number.isFinite(Number(setting.value)) ? Number(setting.value) : DEFAULT_MIN_ORDER_AMOUNT;
    const productMap = new Map(products.map((p) => [p.id, p]));
    const settingOf = (key: string, fallback: number) => {
      const raw = feeSettings.find((s) => s.key === key)?.value;
      const n = Number(raw);
      return Number.isFinite(n) && raw !== "" && raw !== undefined ? n : fallback;
    };
    const baseDeliveryFee = settingOf("deliveryFee", DEFAULT_DELIVERY_FEE);
    const freeShippingMin = settingOf("freeShippingMin", DEFAULT_FREE_SHIPPING_MIN);

    // 배송일별로 서버 측 금액 계산 (가격 위변조 방지)
    type Line = { productId: string; quantity: number; unitPrice: number; totalPrice: number };
    type Group = { date: string; lines: Line[]; baseTotal: number; itemsTotal: number; deliveryFee: number; totalAmount: number };
    const groups = new Map<string, Group>();
    for (const d of resolved.dates) groups.set(d, { date: d, lines: [], baseTotal: 0, itemsTotal: 0, deliveryFee: 0, totalAmount: 0 });

    for (const it of items) {
      const p = productMap.get(it.productId);
      if (!p) {
        return NextResponse.json({ error: `존재하지 않는 상품: ${it.productId}` }, { status: 400 });
      }
      if (!p.isActive) {
        return NextResponse.json({ error: `판매가 중지된 상품입니다: ${p.name}` }, { status: 400 });
      }
      const qty = it.quantity ?? 1;
      if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
        return NextResponse.json({ error: "수량은 1~99 사이의 정수여야 합니다." }, { status: 400 });
      }
      // 단건 주문은 singlePrice 우선, 없으면 구독가(price) 사용
      const unitPrice = p.singlePrice ?? p.price;
      const line = unitPrice * qty;
      const g = groups.get(resolved.byItem.get(it)!)!;
      g.itemsTotal += line;
      if (!p.category?.isOption) g.baseTotal += line;
      g.lines.push({ productId: p.id, quantity: qty, unitPrice, totalPrice: line });
    }

    // 배송일마다 최소 주문액 + 배송비
    for (const g of groups.values()) {
      if (g.baseTotal < minAmount) {
        return NextResponse.json(
          {
            error: "최소 주문액 미달",
            message: `${fmtDate(g.date)} 배송분의 본품(샐러드·간편식·반찬) 합계가 ${minAmount.toLocaleString()}원 이상이어야 주문 가능합니다. (현재 ${g.baseTotal.toLocaleString()}원)`,
            deliveryDate: g.date,
            baseTotal: g.baseTotal,
            minAmount,
            shortfall: minAmount - g.baseTotal,
          },
          { status: 400 },
        );
      }
      g.deliveryFee = g.itemsTotal >= freeShippingMin ? 0 : baseDeliveryFee;
      g.totalAmount = g.itemsTotal + g.deliveryFee;
    }

    // 주문자는 세션에서만 정한다 (body.userId 는 무시 — 남의 계정에 주문·배송지를 만드는 경로였다). 비로그인은 guest
    const session = await auth().catch(() => null);
    let userId = (session?.user as { id?: string } | undefined)?.id ?? "guest";
    if (userId !== "guest") {
      const userExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!userExists) userId = "guest";
    }

    // 배송지 확정 — 저장된 배송지(addressId) 또는 입력 폼(address). 주소 없는 주문은 받지 않는다.
    // LEGACY 모드: 반경 밖·좌표 불명 주소도 결제는 막지 않고 deliveryHold 로 표시해 주간에 사람이 확인한다.
    // ZONES 모드: 권역 밖·차단 규칙·날짜별 중지는 결제 전에 막는다 (화면은 오픈 알림 신청 폼으로 넘어간다).
    const { resolveAddress } = await import("../../lib/address-resolve");
    const addr = await resolveAddress({ userId, addressId: body.addressId, address: body.address });
    if ("error" in addr) {
      return NextResponse.json({ error: addr.error }, { status: 400 });
    }
    const { checkOrderable } = await import("../../lib/delivery-zone");
    const zoneCheck = await checkOrderable(addr, resolved.dates);
    if (zoneCheck.blocked) {
      return NextResponse.json(
        {
          error: zoneCheck.blocked.message,
          code: zoneCheck.blocked.code,
          message: zoneCheck.blocked.message,
          dates: zoneCheck.blocked.dates ?? [],
          reason: zoneCheck.blocked.reason ?? null,
          areaStatus: addr.areaStatus,
          addressId: addr.addressId,
        },
        { status: 400 },
      );
    }

    // 주문 N 건을 한 트랜잭션으로. 2건 이상이면 결제 묶음 번호를 공유 (토스 orderId)
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const groupList = [...groups.values()];
    const paymentGroupNo = groupList.length > 1 ? `W2O-${today}-G${randomCode(6)}` : null;

    // 주문번호는 4자리 랜덤이라 드물게 겹친다 — 유니크 위반이면 번호를 새로 뽑아 최대 3번 시도
    const createOrders = () => prisma.$transaction(async (tx) => {
      const out = [];
      for (const g of groupList) {
        const order = await tx.order.create({
          data: {
            orderNo: `W2O-${today}-${randomCode(5)}`,
            userId,
            addressId: addr.addressId,
            type: "SINGLE",
            status: "PENDING",
            totalAmount: g.totalAmount,
            deliveryFee: g.deliveryFee,
            discountAmount: 0,
            deliveryDate: new Date(`${g.date}T00:00:00.000Z`),
            paymentGroupNo,
            deliveryHold: addr.deliveryHold,
            deliveryHoldReason: addr.deliveryHoldReason,
            items: { create: g.lines },
          },
          select: { id: true, orderNo: true, totalAmount: true, deliveryFee: true },
        });
        out.push({ ...order, deliveryDate: g.date, itemsTotal: g.itemsTotal });
      }
      return out;
    });
    let created: Awaited<ReturnType<typeof createOrders>> | null = null;
    for (let attempt = 0; attempt < 3 && !created; attempt++) {
      try {
        created = await createOrders();
      } catch (err) {
        if ((err as { code?: string }).code !== "P2002" || attempt === 2) throw err;
      }
    }
    if (!created) return NextResponse.json({ error: "주문번호 생성에 실패했습니다. 다시 시도해주세요." }, { status: 500 });

    const first = created[0]!;
    const totalAmount = created.reduce((s, o) => s + o.totalAmount, 0);
    return NextResponse.json(
      {
        // 첫 주문의 id·번호 — 기존 클라이언트 호환. 결제는 paymentOrderId(그룹번호 또는 단일 주문번호)로 한다
        id: first.id,
        orderNo: first.orderNo,
        paymentOrderId: paymentGroupNo ?? first.orderNo,
        paymentGroupNo,
        orders: created,
        itemsTotal: created.reduce((s, o) => s + o.itemsTotal, 0),
        deliveryFee: created.reduce((s, o) => s + o.deliveryFee, 0),
        totalAmount,
        addressId: addr.addressId,
        areaStatus: addr.areaStatus,
        deliveryHold: addr.deliveryHold,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /api/orders error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// GET: 내 주문 목록
export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const { prisma } = await import("@repo/db");
    const userId = (session!.user as { id: string }).id;

    const orders = await prisma.order.findMany({
      // 구독 배송일별 배송 건은 내부용 — 고객에게는 구독 관리 화면이 그 역할을 한다
      where: { userId, type: { not: "SUBSCRIPTION_DELIVERY" } },
      include: {
        items: { include: { product: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(orders);
  } catch (err) {
    console.error("GET /api/orders error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
