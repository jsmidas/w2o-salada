/**
 * 배송 기사 계정 3개 + 코스 A/B/C 생성 (멱등)
 *
 * 실행 (packages/db 에서): npx tsx ../../tools/seed_routes.cts
 * 기사 로그인: driver01~driver03 / driver1234 — 이름·코스명은 /admin/routes 와 /admin/permissions 에서 바꾼다
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DRIVERS = [
  { username: "driver01", name: "기사1", phone: "010-2000-0001", route: "A코스", departOrder: 1 },
  { username: "driver02", name: "기사2", phone: "010-2000-0002", route: "B코스", departOrder: 2 },
  { username: "driver03", name: "기사3", phone: "010-2000-0003", route: "C코스", departOrder: 3 },
];

async function main() {
  const hash = await bcrypt.hash("driver1234", 12);
  for (const d of DRIVERS) {
    const user = await prisma.user.upsert({
      where: { email: `${d.username}@w2o.local` },
      update: { role: "DRIVER", name: d.name, username: d.username },
      create: { email: `${d.username}@w2o.local`, username: d.username, password: hash, name: d.name, phone: d.phone, role: "DRIVER", provider: "email" },
    });
    const route = await prisma.deliveryRoute.upsert({
      where: { name: d.route },
      update: { driverUserId: user.id, isActive: true },
      create: { name: d.route, driverUserId: user.id, ownership: "OWN", maxStops: 100, departOrder: d.departOrder, isActive: true },
    });
    console.log(`✅ ${route.name} ← ${user.name} (${user.username})`);
  }
  console.log("\n기사 로그인: driver01~03 / driver1234. 코스명·기사 배정은 /admin/routes 에서 변경");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
