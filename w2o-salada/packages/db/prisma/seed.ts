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

  // ── 카테고리 (3개) ──
  const categories = [
    { name: "샐러드", slug: "salad", sortOrder: 1 },
    { name: "간편식", slug: "simple", sortOrder: 2 },
    { name: "기타", slug: "etc", sortOrder: 3 },
  ];

  // 기존 상품 먼저 삭제 (FK 제약)
  await prisma.product.deleteMany({});

  // 카테고리 upsert
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, sortOrder: cat.sortOrder },
      create: cat,
    });
  }
  // 사용하지 않는 이전 카테고리 삭제
  await prisma.category.deleteMany({
    where: { slug: { notIn: categories.map((c) => c.slug) } },
  });
  console.log("✅ 카테고리: 샐러드 / 간편식 / 기타");

  const saladCat = await prisma.category.findUnique({ where: { slug: "salad" } });

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

  for (const salad of salads) {
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
  }

  console.log("✅ 샐러드 12종 등록 (정가 7,500원 / 판매가 5,900원)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
