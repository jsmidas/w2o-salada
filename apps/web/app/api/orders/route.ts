import { NextResponse } from "next/server";
import { requireAuth } from "../../lib/auth-guard";
import { pushDuePrices } from "../../lib/effective-price";

const DEFAULT_MIN_ORDER_AMOUNT = 11000;
// 배송비 정책은 관리자 설정(deliveryFee / freeShippingMin)을 따른다.
// 예전에는 15,000원 미만 3,000원이 코드에 박혀 있어, 설정이 무료여도
// 최소 주문액(11,000원) 주문에 배송비가 붙었다.
const DEFAULT_DELIVERY_FEE = 0;
const DEFAULT_FREE_SHIPPING_MIN = 11000;

function generateOrderNo() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `W2O-${date}-${rand}`;
}

type IncomingItem = { productId: string; quantity?: number };

// POST: 주문 생성
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items: IncomingItem[] = body.items ?? [];

    if (!items.length) {
      return NextResponse.json({ error: "주문 항목이 필요합니다." }, { status: 400 });
    }

    const { prisma } = await import("@repo/db");

    // 상품 정보 + 카테고리 옵션 여부 로드 (도래한 가격 인상분 먼저 승격)
    await pushDuePrices();
    const productIds = items.map((i) => i.productId).filter(Boolean);
    const [setting, products] = await Promise.all([
      prisma.setting.findUnique({ where: { key: "minOrderAmount" } }),
      prisma.product.findMany({
        where: { id: { in: productIds } },
        include: { category: { select: { isOption: true } } },
      }),
    ]);
    const minAmount = setting ? Number(setting.value) : DEFAULT_MIN_ORDER_AMOUNT;
    const productMap = new Map(products.map((p) => [p.id, p]));

    // 서버 측 금액 계산 (가격 위변조 방지)
    let baseTotal = 0; // 본품 합계 (최소 주문액 기준)
    let itemsTotal = 0; // 전체 상품 합계
    const orderItemData: { productId: string; quantity: number; unitPrice: number; totalPrice: number }[] = [];

    for (const it of items) {
      const p = productMap.get(it.productId);
      if (!p) {
        return NextResponse.json(
          { error: `존재하지 않는 상품: ${it.productId}` },
          { status: 400 },
        );
      }
      const qty = Math.max(1, it.quantity ?? 1);
      // 단건 주문은 singlePrice 우선, 없으면 구독가(price) 사용
      const unitPrice = p.singlePrice ?? p.price;
      const line = unitPrice * qty;
      itemsTotal += line;
      if (!p.category?.isOption) baseTotal += line;
      orderItemData.push({
        productId: p.id,
        quantity: qty,
        unitPrice,
        totalPrice: line,
      });
    }

    if (baseTotal < minAmount) {
      return NextResponse.json(
        {
          error: "최소 주문액 미달",
          message: `본품(샐러드·간편식·반찬) 합계가 ${minAmount.toLocaleString()}원 이상이어야 주문 가능합니다. (현재 ${baseTotal.toLocaleString()}원)`,
          baseTotal,
          minAmount,
          shortfall: minAmount - baseTotal,
        },
        { status: 400 },
      );
    }

    const feeSettings = await prisma.setting.findMany({
      where: { key: { in: ["deliveryFee", "freeShippingMin"] } },
    });
    const settingOf = (key: string, fallback: number) => {
      const raw = feeSettings.find((s) => s.key === key)?.value;
      const n = Number(raw);
      return Number.isFinite(n) ? n : fallback;
    };
    const baseDeliveryFee = settingOf("deliveryFee", DEFAULT_DELIVERY_FEE);
    const freeShippingMin = settingOf("freeShippingMin", DEFAULT_FREE_SHIPPING_MIN);
    const deliveryFee = itemsTotal >= freeShippingMin ? 0 : baseDeliveryFee;
    const totalAmount = itemsTotal + deliveryFee;

    // userId 확인 (없으면 guest 폴백)
    let userId = body.userId ?? "guest";
    if (userId !== "guest") {
      const userExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!userExists) userId = "guest";
    }

    // 배송지 확정 — 저장된 배송지(addressId) 또는 입력 폼(address). 주소 없는 주문은 받지 않는다.
    // 반경 밖·좌표 불명 주소도 결제는 막지 않고 deliveryHold 로 표시해 주간에 사람이 확인한다.
    const { resolveAddress } = await import("../../lib/address-resolve");
    const resolved = await resolveAddress({ userId, addressId: body.addressId, address: body.address });
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    const orderNo = generateOrderNo();
    const order = await prisma.order.create({
      data: {
        orderNo,
        userId,
        addressId: resolved.addressId,
        type: "SINGLE",
        status: "PENDING",
        totalAmount,
        deliveryFee,
        discountAmount: 0,
        deliveryHold: resolved.deliveryHold,
        deliveryHoldReason: resolved.deliveryHoldReason,
        items: { create: orderItemData },
      },
    });

    return NextResponse.json(
      {
        id: order.id,
        orderNo: order.orderNo,
        itemsTotal,
        deliveryFee,
        totalAmount,
        addressId: resolved.addressId,
        areaStatus: resolved.areaStatus,
        deliveryHold: resolved.deliveryHold,
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
      where: { userId },
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
