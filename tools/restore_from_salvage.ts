/**
 * 2026-09-27 DB 초기화 사고 복구 스크립트
 *
 * Vercel 홈페이지 캐시에서 건진 _salvage-20260927/salvaged_home.json 을 읽어
 * 카테고리·상품(원래 ID 유지)·배송 캘린더·메뉴 배정·기본 설정·관리자/비회원 계정을 복원한다.
 * 모두 upsert 라 여러 번 실행해도 안전하다.
 *
 * 실행: cd packages/db && npx tsx ../../tools/restore_from_salvage.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

type Salvage = {
  products: {
    id: string; name: string; description?: string | null; originalPrice?: number | null;
    singlePrice?: number | null; price: number; kcal?: number | null; imageUrl?: string | null;
    tags?: string | null; sortOrder?: number | null; category?: { id: string; slug: string } | null; categoryId?: string;
  }[];
  categories: { id: string; name: string; slug: string; icon?: string | null; color?: string | null; sortOrder?: number; isActive?: boolean; isOption?: boolean }[];
  calendar: { date: string; isActive: boolean | null; memo: string | null; menuAssignments: { productId: string | null; name: string | null }[] }[];
};

async function main() {
  const file = path.resolve(__dirname, "../packages/db/prisma/recovery-20260927/salvaged_home.json");
  const data: Salvage = JSON.parse(fs.readFileSync(file, "utf8"));

  // ── 1. 계정 ──
  const guest = await prisma.user.upsert({
    where: { id: "guest" },
    update: {},
    create: { id: "guest", email: "guest@w2o.local", name: "비회원", role: "CUSTOMER", provider: "system" },
  });
  console.log("✅ 비회원 계정:", guest.id);

  const adminEmail = "admin@w2osalada.co.kr";
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  let tempPassword: string | null = null;
  if (!existingAdmin) {
    tempPassword = crypto.randomBytes(9).toString("base64url"); // 12자
    await prisma.user.create({
      data: {
        email: adminEmail,
        username: "admin",
        password: await bcrypt.hash(tempPassword, 12),
        name: "관리자",
        role: "ADMIN",
        provider: "email",
        permissions: null, // 슈퍼관리자
      },
    });
  }
  console.log(`✅ 관리자 계정: ${adminEmail}${tempPassword ? ` / 임시 비밀번호: ${tempPassword}` : " (이미 존재)"}`);

  // ── 2. 카테고리 (원래 ID 유지) ──
  for (const c of data.categories) {
    await prisma.category.upsert({
      where: { id: c.id },
      update: { name: c.name, slug: c.slug, icon: c.icon ?? null, color: c.color ?? null, sortOrder: c.sortOrder ?? 0, isActive: c.isActive ?? true, isOption: c.isOption ?? false },
      create: { id: c.id, name: c.name, slug: c.slug, icon: c.icon ?? null, color: c.color ?? null, sortOrder: c.sortOrder ?? 0, isActive: c.isActive ?? true, isOption: c.isOption ?? false },
    });
  }
  console.log(`✅ 카테고리 ${data.categories.length}개`);

  // ── 3. 상품 (원래 ID 유지 — 캘린더 배정·이미지 URL이 이 ID를 참조한다) ──
  const catBySlug = new Map(data.categories.map((c) => [c.slug, c.id]));
  let sort = 0;
  for (const p of data.products) {
    const categoryId = p.categoryId ?? (p.category?.slug ? catBySlug.get(p.category.slug) : undefined) ?? p.category?.id;
    if (!categoryId) { console.warn("⚠ 카테고리 불명, 건너뜀:", p.name); continue; }
    sort += 1;
    const fields = {
      name: p.name,
      description: p.description ?? null,
      originalPrice: p.originalPrice ?? null,
      singlePrice: p.singlePrice ?? null,
      price: p.price,
      kcal: p.kcal ?? null,
      imageUrl: p.imageUrl ?? null,
      tags: p.tags ?? null,
      isActive: true, // 9/26 기준 22종 전부 판매중
      sortOrder: p.sortOrder ?? sort,
      categoryId,
    };
    await prisma.product.upsert({ where: { id: p.id }, update: fields, create: { id: p.id, ...fields } });
  }
  console.log(`✅ 상품 ${data.products.length}종`);

  // ── 4. 배송 캘린더 + 메뉴 배정 ──
  let assigned = 0;
  for (const day of data.calendar) {
    const date = new Date(day.date);
    const cal = await prisma.deliveryCalendar.upsert({
      where: { date },
      update: { isActive: day.isActive ?? true, memo: day.memo ?? null },
      create: { date, isActive: day.isActive ?? true, memo: day.memo ?? null },
    });
    let order = 0;
    for (const a of day.menuAssignments) {
      if (!a.productId) continue;
      await prisma.menuAssignment.upsert({
        where: { deliveryCalendarId_productId: { deliveryCalendarId: cal.id, productId: a.productId } },
        update: { sortOrder: order },
        create: { deliveryCalendarId: cal.id, productId: a.productId, sortOrder: order },
      });
      order += 1;
      assigned += 1;
    }
  }
  console.log(`✅ 배송일 ${data.calendar.length}일 / 메뉴 배정 ${assigned}건`);

  // ── 5. 설정 (문서·코드 기본값으로 알 수 있는 것만. 회사정보·FAQ는 관리자에서 재입력) ──
  const settings: Record<string, string> = {
    minOrderAmount: "11000",
    deliveryFee: "0",
    freeShippingMin: "11000",
    cutoffTime: "14:00",
    deliveryStart: "03:00",
    deliveryEnd: "06:00",
    deliveryAreas: "대구 달서구, 달성군 일부",
    shopName: "W2O SALADA",
    phone: "053-721-7794",
    address: "대구광역시 달서구 성서공단로 332-10",
    orderConfirm: "true",
    deliveryStart_noti: "true",
    deliveryDone: "true",
    subscriptionPayment: "true",
    paymentFail: "true",
    subscriptionRenew: "true",
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } }); // 이미 있으면 건드리지 않음
  }
  console.log(`✅ 설정 ${Object.keys(settings).length}개 (없는 키만 생성)`);

  const counts = {
    users: await prisma.user.count(),
    categories: await prisma.category.count(),
    products: await prisma.product.count(),
    calendar: await prisma.deliveryCalendar.count(),
    assignments: await prisma.menuAssignment.count(),
    settings: await prisma.setting.count(),
  };
  console.log("📊 복구 후 현황:", counts);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
