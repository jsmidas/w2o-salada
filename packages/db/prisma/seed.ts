import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ── 관리자 계정 ──
  const adminPassword = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { email: "admin@w2osalada.co.kr" },
    update: {},
    create: {
      email: "admin@w2osalada.co.kr",
      password: adminPassword,
      name: "관리자",
      role: "ADMIN",
      provider: "email",
    },
  });
  console.log("✅ 관리자 계정: admin@w2osalada.co.kr / admin123");

  // ── 카테고리 (4개: 샐러드·간편식·반찬/국·주스/음료) ──
  // 그레인볼/프로틴은 샐러드의 세부 분류로 통합 (별도 카테고리 X)
  // 주스·음료는 isOption=true (본품 아님, 최소 주문액 계산 제외)
  const categories = [
    { name: "샐러드",     slug: "salad",   sortOrder: 1, icon: "eco",          color: "#1D9E75", isOption: false },
    { name: "간편식",     slug: "simple",  sortOrder: 2, icon: "lunch_dining", color: "#EF9F27", isOption: false },
    { name: "반찬·국",    slug: "banchan", sortOrder: 3, icon: "soup_kitchen", color: "#B85C38", isOption: false },
    { name: "주스·음료",  slug: "drink",   sortOrder: 4, icon: "local_drink",  color: "#3498DB", isOption: true },
  ];

  // 카테고리 upsert
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        sortOrder: cat.sortOrder,
        icon: cat.icon,
        color: cat.color,
        isOption: cat.isOption,
      },
      create: cat,
    });
  }
  // 사용하지 않는 이전 카테고리는 비활성화 (FK 보존)
  await prisma.category.updateMany({
    where: { slug: { notIn: categories.map((c) => c.slug) } },
    data: { isActive: false },
  });
  console.log("✅ 카테고리 4종: 샐러드 / 간편식 / 반찬·국 / 주스·음료");

  const saladCat   = await prisma.category.findUnique({ where: { slug: "salad" } });
  const simpleCat  = await prisma.category.findUnique({ where: { slug: "simple" } });
  const banchanCat = await prisma.category.findUnique({ where: { slug: "banchan" } });
  const drinkCat   = await prisma.category.findUnique({ where: { slug: "drink" } });

  // ── 샐러드 상품 (실제 메뉴, 정가 7500원 / 판매가 5900원) ──
  const salads = [
    { name: "꽃맛살 샐러드", description: "신선한 꽃맛살과 다양한 채소의 조화", imageUrl: "/products/kkotmatsal.jpg", sortOrder: 1 },
    { name: "메밀면 샐러드", description: "쫄깃한 메밀면과 신선한 채소의 만남", imageUrl: "/products/memil.jpg", sortOrder: 2 },
    { name: "새우 샐러드", description: "탱글탱글한 새우와 상큼한 채소", imageUrl: "/products/shrimp.jpg", sortOrder: 3 },
    { name: "고구마 샐러드", description: "달콤한 고구마와 건강한 채소의 조합", imageUrl: "/products/goguma.jpg", sortOrder: 4 },
    { name: "치킨텐더 샐러드", description: "바삭한 치킨텐더와 풍성한 채소", imageUrl: "/products/chicken_tender.jpg", sortOrder: 5 },
    { name: "참깨 두부 샐러드", description: "고소한 참깨 두부와 신선한 채소", imageUrl: "/products/tofu.jpg", sortOrder: 6 },
    { name: "훈제오리 샐러드", description: "풍미 가득한 훈제오리와 채소", imageUrl: "/products/smoked_duck.jpg", sortOrder: 7 },
    { name: "리코타치즈 샐러드", description: "부드러운 리코타치즈와 신선한 채소", imageUrl: "/products/ricotta.jpg", sortOrder: 8 },
    { name: "단호박 샐러드", description: "달콤한 단호박과 영양 가득한 채소", imageUrl: "/products/pumpkin.jpg", sortOrder: 9 },
    { name: "베이컨버섯 샐러드", description: "짭짤한 베이컨과 향긋한 버섯의 조화", imageUrl: "/products/mushroom.jpg", sortOrder: 10 },
    { name: "파스타 샐러드", description: "쫄깃한 파스타와 신선한 채소", imageUrl: "/products/pasta.jpg", sortOrder: 11 },
    { name: "데리야끼 불고기 샐러드", description: "달콤짭짤한 데리야끼 불고기와 채소", imageUrl: "/products/teriyaki.jpg", sortOrder: 12 },
  ];

  let saladAdded = 0;
  for (const salad of salads) {
    const exists = await prisma.product.findFirst({ where: { name: salad.name } });
    if (exists) continue;
    await prisma.product.create({
      data: {
        categoryId: saladCat!.id,
        name: salad.name,
        description: salad.description,
        imageUrl: salad.imageUrl,
        originalPrice: 7500,
        price: 5900,
        tags: salad.sortOrder <= 4 ? "BEST" : salad.sortOrder >= 11 ? "NEW" : null,
        isActive: true,
        sortOrder: salad.sortOrder,
      },
    });
    saladAdded++;
  }

  console.log(`✅ 샐러드 신규 등록: ${saladAdded}종 (기존 보존)`);

  // ── 신규 카테고리 샘플 상품 (플레이스홀더 이미지) ──
  const extraProducts: Array<{
    categoryId: string;
    name: string;
    description: string;
    originalPrice: number;
    price: number;
    sortOrder: number;
    tags?: string;
  }> = [
    // 간편식 (정가 → 할인가, 약 21%↓)
    { categoryId: simpleCat!.id, name: "소불고기 덮밥",        description: "양념이 배인 소불고기와 부드러운 밥",           originalPrice: 8500,  price: 6700, sortOrder: 1, tags: "NEW" },
    { categoryId: simpleCat!.id, name: "치킨 스테이크 도시락", description: "바삭한 치킨 스테이크 원플레이트",             originalPrice: 8500,  price: 6700, sortOrder: 2 },
    { categoryId: simpleCat!.id, name: "명란 크림 파스타",     description: "부드러운 명란 크림 소스의 파스타",            originalPrice: 9000,  price: 7100, sortOrder: 3 },

    // 반찬·국 (집반찬 세트는 본품 1개만으로 최소 주문액 달성 가능, 약 11,000원선)
    { categoryId: banchanCat!.id, name: "집반찬 A세트 (나물·김치·조림)", description: "매일 바뀌는 오늘의 반찬 3종 A구성",  originalPrice: 14000, price: 11000, sortOrder: 1, tags: "BEST" },
    { categoryId: banchanCat!.id, name: "집반찬 B세트 (볶음·무침·구이)", description: "매일 바뀌는 오늘의 반찬 3종 B구성",  originalPrice: 13500, price: 10500, sortOrder: 2 },
    { categoryId: banchanCat!.id, name: "소고기 무국",                  description: "깊은 국물의 소고기 무국 1인분",         originalPrice: 5900,  price: 4500,  sortOrder: 3 },

    // 주스·음료 (옵션 상품, 최소 주문액 계산 제외)
    { categoryId: drinkCat!.id, name: "착즙 당근주스",         description: "100% 착즙 당근주스 300ml",              originalPrice: 4500, price: 3500, sortOrder: 1 },
    { categoryId: drinkCat!.id, name: "콜드브루 아메리카노",     description: "깔끔한 콜드브루 커피 300ml",            originalPrice: 4500, price: 3500, sortOrder: 2 },
  ];

  let extraAdded = 0;
  for (const p of extraProducts) {
    const exists = await prisma.product.findFirst({ where: { name: p.name } });
    if (exists) continue;
    await prisma.product.create({
      data: {
        categoryId:    p.categoryId,
        name:          p.name,
        description:   p.description,
        imageUrl:      "/products/placeholder.jpg",
        originalPrice: p.originalPrice,
        price:         p.price,
        tags:          p.tags ?? null,
        isActive:      true,
        sortOrder:     p.sortOrder,
      },
    });
    extraAdded++;
  }
  console.log(`✅ 신규 카테고리 샘플 상품 신규 등록: ${extraAdded}종 (간편식·반찬·국·음료)`);

  // ── 설정: 최소 주문액 (본품 합계 기준) ──
  await prisma.setting.upsert({
    where: { key: "minOrderAmount" },
    update: { value: "11000" },
    create: { key: "minOrderAmount", value: "11000" },
  });
  console.log("✅ 설정: minOrderAmount = 11,000원 (본품 합계 기준, 옵션 카테고리 제외)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
