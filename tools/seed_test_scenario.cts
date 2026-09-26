/**
 * 배송 코스 시나리오 테스트 데이터 — 지역별 테스트 계정 10개 + 주문·구독·비회원 주문 + 아파트 단지
 *
 * 목적: 실제 데이터 흐름(주소 → 좌표·반경 판정 → 주문 → 배송 관리 코스 편성 → 기사 출력)에서
 *       실제로 생길 문제를 눈으로 찾는다. 오픈 전, 실주문 없는 상태에서만 쓴다.
 *
 * 실행 (packages/db 에서):
 *   npx tsx ../../tools/seed_test_scenario.cts            # 기존 테스트 데이터 지우고 다시 생성 (멱등)
 *   DRY_RUN=1 npx tsx ../../tools/seed_test_scenario.cts  # 좌표·판정만 출력, DB 쓰기 없음
 *   npx tsx ../../tools/seed_test_scenario.cts --clean    # 테스트 데이터 삭제만
 *
 * 테스트 계정: test01~test10 / 비밀번호 test1234 (이메일 testNN@w2o.test)
 * 지오코딩: apps/web/.env 의 VWORLD_API_KEY / KAKAO_CLIENT_ID 를 읽는다.
 */
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { prisma } from "@repo/db";

// apps/web/.env 에서 지오코딩 키만 process.env 로 올린다 (DB URL 은 packages/db/.env 를 Prisma 가 읽음)
{
  const envPath = path.resolve(__dirname, "../apps/web/.env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^(VWORLD_API_KEY|KAKAO_REST_API_KEY|KAKAO_CLIENT_ID|NEXTAUTH_URL)="?([^"]*)"?$/);
      if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!;
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const geo = require("../apps/web/app/lib/geo") as typeof import("../apps/web/app/lib/geo");

const DRY = process.env.DRY_RUN === "1";
const CLEAN_ONLY = process.argv.includes("--clean");
const TEST_DOMAIN = "w2o.test";
const PASSWORD = "test1234";

type Drop = "DOOR" | "SECURITY_OFFICE" | "PARCEL_BOX" | "OTHER";
type AddrSpec = {
  label: string; name: string; phone: string; address1: string; address2: string;
  buildingName?: string; isApartment?: boolean; memo?: string;
  entranceMethod?: string; entrancePassword?: string; floor?: string; dropLocation?: Drop; dropNote?: string;
  isDefault?: boolean;
};
type UserSpec = { no: number; name: string; area: string; addresses: AddrSpec[]; subscribe?: number /* 배송지 index */ };

// 센터(성서공단로 332-10, 월성동) 기준 10km 안팎으로 흩어 놓는다
const USERS: UserSpec[] = [
  { no: 1, name: "김이곡", area: "이곡동·아파트", addresses: [{ label: "집", name: "김이곡", phone: "010-1000-0001", address1: "대구 달서구 이곡공원로 8", address2: "103동 1204호", buildingName: "이곡청구타운", isApartment: true, entranceMethod: "공동현관 비밀번호", entrancePassword: "#1204*", floor: "12층", dropLocation: "DOOR", memo: "벨 누르지 말아주세요" }], subscribe: 0 },
  { no: 2, name: "박신당", area: "신당동·원룸", addresses: [{ label: "집", name: "박신당", phone: "010-1000-0002", address1: "대구 달서구 달구벌대로 1095", address2: "3층 302호", floor: "3층", entranceMethod: "자유 출입", dropLocation: "DOOR" }] },
  { no: 3, name: "이용산", area: "용산동·아파트 + 부모님 댁(남구)", addresses: [
      { label: "집", name: "이용산", phone: "010-1000-0003", address1: "대구 달서구 용산동 230-5", address2: "201동 502호", buildingName: "용산롯데캐슬", isApartment: true, entranceMethod: "공동현관 비밀번호", entrancePassword: "0502#", floor: "5층", dropLocation: "DOOR", isDefault: true },
      { label: "부모님 댁", name: "이순자", phone: "010-1000-0033", address1: "대구 남구 대명로 150", address2: "2층", floor: "2층", entranceMethod: "대문 옆 우유함", dropLocation: "OTHER", dropNote: "대문 안쪽 우유함에 넣어주세요", memo: "어머니 혼자 계심, 조용히 부탁드려요" },
    ], subscribe: 1 },
  { no: 4, name: "최감삼", area: "감삼동·오피스텔", addresses: [{ label: "집", name: "최감삼", phone: "010-1000-0004", address1: "대구 달서구 감삼동 100-1", address2: "1507호", floor: "15층", entranceMethod: "경비실 호출", dropLocation: "SECURITY_OFFICE", dropNote: "야간 경비실 창구" }] },
  { no: 5, name: "정상인", area: "상인동·아파트", addresses: [{ label: "집", name: "정상인", phone: "010-1000-0005", address1: "대구 달서구 상인로 100", address2: "105동 803호", buildingName: "상인화성파크", isApartment: true, entranceMethod: "공동현관 비밀번호", entrancePassword: "8030*", floor: "8층", dropLocation: "PARCEL_BOX", dropNote: "택배함 12번, 비밀번호 1234" }] },
  { no: 6, name: "강월배", area: "진천동·아파트", addresses: [{ label: "집", name: "강월배", phone: "010-1000-0006", address1: "대구 달서구 월배로 100", address2: "301동 1001호", buildingName: "월배아이파크", isApartment: true, entranceMethod: "공동현관 비밀번호", entrancePassword: "1001*", floor: "10층", dropLocation: "DOOR" }], subscribe: 0 },
  { no: 7, name: "윤죽곡", area: "달성군 다사읍 죽곡·아파트(6km)", addresses: [{ label: "집", name: "윤죽곡", phone: "010-1000-0007", address1: "대구 달성군 다사읍 죽곡리 725-1", address2: "204동 1505호", buildingName: "죽곡청아람", isApartment: true, entranceMethod: "공동현관 비밀번호", entrancePassword: "1505#", floor: "15층", dropLocation: "DOOR" }] },
  { no: 8, name: "한두류", area: "두류동·단독", addresses: [{ label: "집", name: "한두류", phone: "010-1000-0008", address1: "대구 달서구 두류공원로 200", address2: "", entranceMethod: "대문 열려 있음", dropLocation: "DOOR", memo: "개 있음, 짖어도 순함" }] },
  { no: 9, name: "오경산", area: "경산시(권역 밖 ~15km)", addresses: [{ label: "집", name: "오경산", phone: "010-1000-0009", address1: "경북 경산시 경안로 200", address2: "2층", floor: "2층", dropLocation: "DOOR" }] },
  { no: 10, name: "서불명", area: "좌표 불명(잘못된 주소)", addresses: [{ label: "집", name: "서불명", phone: "010-1000-0010", address1: "대구 달서구 없는길 999", address2: "101호", dropLocation: "DOOR" }] },
];

const APARTMENTS = [
  { name: "이곡청구타운", address: "대구 달서구 이곡공원로 8", households: 1200, aliases: ["이곡 청구타운", "청구타운"] },
  { name: "용산롯데캐슬", address: "대구 달서구 용산동 230-5", households: 900, aliases: ["용산 롯데캐슬"] },
  { name: "상인화성파크", address: "대구 달서구 상인로 100", households: 800, aliases: ["상인 화성파크"] },
  { name: "월배아이파크", address: "대구 달서구 월배로 100", households: 1500, aliases: ["월배 아이파크", "월배IPARK"] },
];

const email = (no: number) => `test${String(no).padStart(2, "0")}@${TEST_DOMAIN}`;
const username = (no: number) => `test${String(no).padStart(2, "0")}`;
const orderNo = () => `W2O-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-T${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

async function clean() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: `@${TEST_DOMAIN}` } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const guestTestAddr = await prisma.address.findMany({ where: { userId: "guest", phone: { startsWith: "010-1000-" } }, select: { id: true } });
  const addrIds = [
    ...(await prisma.address.findMany({ where: { userId: { in: ids } }, select: { id: true } })).map((a) => a.id),
    ...guestTestAddr.map((a) => a.id),
  ];
  const orders = await prisma.order.findMany({ where: { OR: [{ userId: { in: ids } }, { addressId: { in: addrIds } }] }, select: { id: true } });
  const orderIds = orders.map((o) => o.id);
  const subs = await prisma.subscription.findMany({ where: { userId: { in: ids } }, select: { id: true } });
  const subIds = subs.map((s) => s.id);
  const periods = await prisma.subscriptionPeriod.findMany({ where: { subscriptionId: { in: subIds } }, select: { id: true } });

  await prisma.delivery.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.subscriptionSelection.deleteMany({ where: { subscriptionPeriodId: { in: periods.map((p) => p.id) } } });
  await prisma.subscriptionPeriod.deleteMany({ where: { subscriptionId: { in: subIds } } });
  await prisma.subscriptionItem.deleteMany({ where: { subscriptionId: { in: subIds } } });
  await prisma.subscription.deleteMany({ where: { id: { in: subIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.address.deleteMany({ where: { id: { in: addrIds } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.apartment.deleteMany({ where: { memo: "SCENARIO_TEST" } });
  console.log(`🧹 정리: 사용자 ${ids.length}, 배송지 ${addrIds.length}, 주문 ${orderIds.length}, 구독 ${subIds.length}`);
}

async function main() {
  if (CLEAN_ONLY) { await clean(); return; }

  // ── 0. 배송일·메뉴 (다가오는 배송일 2개) ──
  const days = await prisma.deliveryCalendar.findMany({
    where: { isActive: true, date: { gte: new Date() } },
    orderBy: { date: "asc" },
    take: 2,
    include: { menuAssignments: { include: { product: { include: { category: true } } }, orderBy: { sortOrder: "asc" } } },
  });
  if (days.length < 2) throw new Error("활성 배송일이 2개 이상 있어야 합니다 (/admin/delivery-calendar)");
  const [d1, d2] = days as [typeof days[number], typeof days[number]];
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  console.log(`배송일: ${fmt(d1.date)} (${d1.menuAssignments.length}메뉴), ${fmt(d2.date)} (${d2.menuAssignments.length}메뉴)`);

  // 본품 11,000원 이상이 되도록 장바구니 구성: 세트가 있으면 세트 1, 없으면 본품 2개
  const pickItems = (day: typeof d1, variant: number) => {
    const mains = day.menuAssignments.filter((m) => !m.product.category.isOption).map((m) => m.product);
    const options = day.menuAssignments.filter((m) => m.product.category.isOption).map((m) => m.product);
    const set = mains.find((p) => (p.singlePrice ?? p.price) >= 11000);
    const items: { productId: string; quantity: number; unitPrice: number }[] = [];
    if (variant % 3 === 0 && set) items.push({ productId: set.id, quantity: 1, unitPrice: set.singlePrice ?? set.price });
    else {
      for (const p of mains.slice(0, 2)) items.push({ productId: p.id, quantity: variant % 2 === 0 ? 1 : 2, unitPrice: p.singlePrice ?? p.price });
    }
    if (variant % 2 === 1 && options[0]) items.push({ productId: options[0].id, quantity: 1, unitPrice: options[0].singlePrice ?? options[0].price });
    return items;
  };

  // ── 1. 좌표·판정 (DRY_RUN 은 여기까지) ──
  const center = await geo.getDeliveryCenter();
  console.log(`센터: ${center.name} ${center.address} → ${center.lat?.toFixed(5)}, ${center.lng?.toFixed(5)} / 반경 ${center.radiusKm}km`);
  const enriched = new Map<string, Awaited<ReturnType<typeof geo.enrichLocation>>>();
  for (const u of USERS) {
    for (const a of u.addresses) {
      const loc = await geo.enrichLocation(a.address1, { buildingName: a.buildingName ?? null, isApartment: a.isApartment ?? false });
      enriched.set(`${u.no}:${a.label}`, loc);
      console.log(`  ${String(u.no).padStart(2, "0")} ${u.area.padEnd(28)} ${a.label.padEnd(6)} → ${loc.sigungu ?? "?"} ${loc.bname ?? "?"} | ${loc.distanceKm ?? "-"}km | ${loc.areaStatus} (${loc.judgement.reason})`);
    }
  }
  if (DRY) { console.log("(dry-run) DB 쓰기 없이 종료"); return; }

  // ── 2. 정리 후 생성 ──
  await clean();
  const hash = await bcrypt.hash(PASSWORD, 10);

  // 아파트 단지 사전 등록
  for (const ap of APARTMENTS) {
    const g = await geo.geocodeAddress(ap.address);
    const distanceKm = g && center.lat !== null && center.lng !== null ? Math.round(geo.haversineKm(g, { lat: center.lat, lng: center.lng }) * 10) / 10 : null;
    await prisma.apartment.create({
      data: { name: ap.name, aliases: ap.aliases, address: ap.address, sigungu: g?.sigungu ?? null, bname: g?.bname ?? null, households: ap.households, lat: g?.lat ?? null, lng: g?.lng ?? null, distanceKm, isServiced: true, memo: "SCENARIO_TEST" },
    });
  }
  console.log(`🏢 아파트 단지 ${APARTMENTS.length}개 등록`);

  const now = new Date();
  const nextMonthFirst = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  let orderCount = 0, subCount = 0;

  for (const u of USERS) {
    const user = await prisma.user.create({
      data: { email: email(u.no), username: username(u.no), password: hash, name: u.name, phone: u.addresses[0]!.phone, role: "CUSTOMER", provider: "email" },
    });

    const addrRows = [];
    for (const [i, a] of u.addresses.entries()) {
      const loc = enriched.get(`${u.no}:${a.label}`)!;
      const apartmentId = await geo.matchApartment(a.buildingName, loc.sigungu);
      const row = await prisma.address.create({
        data: {
          userId: user.id, label: a.label, name: a.name, phone: a.phone, zipCode: "00000", address1: a.address1, address2: a.address2 || null,
          deliveryMemo: a.memo ?? null, entranceMethod: a.entranceMethod ?? null, entrancePassword: a.entrancePassword ?? null,
          floor: a.floor ?? null, dropLocation: a.dropLocation ?? "DOOR", dropNote: a.dropNote ?? null,
          isDefault: a.isDefault ?? i === 0,
          ...geo.locationToAddressData({ ...loc, apartmentId }),
        },
      });
      addrRows.push(row);
    }

    // 단건 주문: 배송일1 은 전원 PAID, 배송일2 는 홀수 번호만. 10번은 PENDING(미결제) 으로 남겨 집계 제외 확인
    const mk = async (day: typeof d1, addr: (typeof addrRows)[number], variant: number, status: "PAID" | "PENDING") => {
      const items = pickItems(day, variant);
      const total = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
      const hold = geo.holdFromStatus(addr.areaStatus, addr.distanceKm, center.radiusKm);
      await prisma.order.create({
        data: {
          orderNo: orderNo(), userId: user.id, addressId: addr.id, type: "SINGLE", status,
          totalAmount: total, deliveryFee: 0, discountAmount: 0, deliveryDate: day.date,
          paidAt: status === "PAID" ? now : null, paymentKey: status === "PAID" ? `test_${Math.random().toString(36).slice(2, 10)}` : null,
          deliveryHold: hold.deliveryHold, deliveryHoldReason: hold.deliveryHoldReason,
          items: { create: items.map((it) => ({ productId: it.productId, quantity: it.quantity, unitPrice: it.unitPrice, totalPrice: it.quantity * it.unitPrice })) },
        },
      });
      orderCount++;
    };
    await mk(d1, addrRows[0]!, u.no, u.no === 10 ? "PENDING" : "PAID");
    if (u.no % 2 === 1 && u.no !== 10) await mk(d2, addrRows[addrRows.length - 1]!, u.no + 1, "PAID");

    // 구독: 배송일1·2 에 샐러드 2개씩 선택, 월 주문 1건(PAID, deliveryDate = 배송일1) — 실제 /api/subscribe·confirm 흐름과 동일
    if (u.subscribe !== undefined) {
      const addr = addrRows[u.subscribe]!;
      const salads = (day: typeof d1) => day.menuAssignments.filter((m) => m.product.category.slug === "salad").slice(0, 2).map((m) => m.product);
      const sel1 = salads(d1), sel2 = salads(d2);
      const price = [...sel1, ...sel2].reduce((s, p) => s + p.price, 0);
      const hold = geo.holdFromStatus(addr.areaStatus, addr.distanceKm, center.radiusKm);
      const sub = await prisma.subscription.create({
        data: {
          userId: user.id, addressId: addr.id, selectionMode: "MANUAL", itemsPerDelivery: 2, slots: { salad: 2 }, status: "ACTIVE",
          price, startedAt: now, nextDeliveryDate: d1.date, nextBillingDate: nextMonthFirst, billingKey: null,
        },
      });
      const period = await prisma.subscriptionPeriod.create({
        data: { subscriptionId: sub.id, year: d1.date.getUTCFullYear(), month: d1.date.getUTCMonth() + 1, status: "PAID", totalAmount: price, paidAt: now },
      });
      await prisma.subscriptionSelection.createMany({
        data: [
          ...sel1.map((p) => ({ subscriptionPeriodId: period.id, deliveryDate: d1.date, productId: p.id, quantity: 1, unitPrice: p.price })),
          ...sel2.map((p) => ({ subscriptionPeriodId: period.id, deliveryDate: d2.date, productId: p.id, quantity: 1, unitPrice: p.price })),
        ],
      });
      await prisma.order.create({
        data: {
          orderNo: orderNo(), userId: user.id, addressId: addr.id, subscriptionId: sub.id, type: "SUBSCRIPTION", status: "PAID",
          totalAmount: price, deliveryFee: 0, deliveryDate: d1.date, paidAt: now, paymentKey: `test_sub_${Math.random().toString(36).slice(2, 8)}`,
          deliveryHold: hold.deliveryHold, deliveryHoldReason: hold.deliveryHoldReason,
          items: { create: [...sel1, ...sel2].map((p) => ({ productId: p.id, quantity: 1, unitPrice: p.price, totalPrice: p.price })) },
        },
      });
      subCount++;
    }
  }

  // 비회원 주문 1건 (감삼동 근처) — 회원이 아닌 주소가 배송 관리에서 어떻게 보이는지
  {
    const a: AddrSpec = { label: "", name: "비회원 손님", phone: "010-1000-0099", address1: "대구 달서구 달구벌대로 1300", address2: "2층", floor: "2층", dropLocation: "DOOR" };
    const loc = await geo.enrichLocation(a.address1, {});
    const addr = await prisma.address.create({
      data: { userId: "guest", name: a.name, phone: a.phone, zipCode: "00000", address1: a.address1, address2: a.address2, floor: a.floor, dropLocation: "DOOR", ...geo.locationToAddressData(loc) },
    });
    const items = pickItems(d1, 3);
    const total = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
    const hold = geo.holdFromStatus(addr.areaStatus, addr.distanceKm, center.radiusKm);
    await prisma.order.create({
      data: {
        orderNo: orderNo(), userId: "guest", addressId: addr.id, type: "SINGLE", status: "PAID", totalAmount: total, deliveryFee: 0,
        deliveryDate: d1.date, paidAt: now, paymentKey: "test_guest", deliveryHold: hold.deliveryHold, deliveryHoldReason: hold.deliveryHoldReason,
        items: { create: items.map((it) => ({ productId: it.productId, quantity: it.quantity, unitPrice: it.unitPrice, totalPrice: it.quantity * it.unitPrice })) },
      },
    });
    orderCount++;
    console.log(`👤 비회원 주문 1건 (${loc.bname ?? "?"}, ${loc.distanceKm ?? "-"}km)`);
  }

  console.log(`\n✅ 생성 완료: 사용자 ${USERS.length}, 주문 ${orderCount}, 구독 ${subCount}`);
  console.log(`   로그인: test01~test10 / ${PASSWORD}`);
  console.log(`   확인할 화면: /admin/delivery?date=${fmt(d1.date)} 와 ${fmt(d2.date)}, /admin/orders (배송지 확인 필터), /admin/production, /admin/apartments`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
