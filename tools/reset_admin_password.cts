/**
 * 관리자 비밀번호 재설정 — 로그인이 막혔을 때 사용
 *
 * 실행 (packages/db 에서):
 *   npx tsx ../../tools/reset_admin_password.cts admin            # 임시 비밀번호 생성해 출력
 *   npx tsx ../../tools/reset_admin_password.cts admin 새비밀번호   # 지정한 비밀번호로
 * 첫 인자는 아이디(username) 또는 이메일.
 */
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [who, given] = process.argv.slice(2);
  if (!who) throw new Error("사용법: reset_admin_password.cts <아이디 또는 이메일> [새 비밀번호]");
  const user = await prisma.user.findFirst({ where: { OR: [{ username: who }, { email: who.toLowerCase() }] } });
  if (!user) throw new Error(`계정을 찾을 수 없습니다: ${who}`);
  if (given && given.length < 6) throw new Error("비밀번호는 6자 이상");
  const password = given ?? crypto.randomBytes(9).toString("base64url");
  await prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(password, 12) } });
  console.log(`✅ ${user.username ?? user.email} (${user.role}) 비밀번호 변경됨 → ${password}`);
  console.log("   로그인 후 마이페이지 프로필에서 다시 바꾸세요.");
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); }).finally(() => prisma.$disconnect());
