/**
 * 2026-09-27 DB 초기화 사고 — 원클릭 복구 실행기
 *
 * 순서
 *   1. prisma/recovery-20260927/01_schema.sql  — 빈 DB에 빠진 테이블·컬럼·인덱스·FK 추가 (추가 전용)
 *   2. prisma/recovery-20260927/02_rls.sql     — 전 테이블 RLS 재활성화
 *   3. tools/restore_from_salvage.ts           — 카테고리·상품·배송 캘린더·설정·계정 복원
 *   4. prisma migrate resolve --applied 20260927000000_baseline — 마이그레이션 이력 baseline
 *
 * 모든 단계가 멱등이라 중간에 끊겨도 다시 실행하면 된다.
 *
 * 실행:  cd packages/db && npx tsx ../../tools/recover_20260927.ts
 */
import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const dbDir = path.resolve(__dirname, "../packages/db");
const env = fs.readFileSync(path.join(dbDir, ".env"), "utf8");
const directUrl = env.match(/^DIRECT_URL="?([^"\r\n]+)"?/m)?.[1];
if (!directUrl) throw new Error("packages/db/.env 에 DIRECT_URL 이 없습니다.");

const prisma = new PrismaClient({ datasourceUrl: directUrl });

// 세미콜론 단위로 나눈다. 복구 SQL에는 함수 본문($$)이 없어 단순 분할로 충분하다.
function splitStatements(sql: string): string[] {
  return sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const IGNORABLE = ["already exists", "42P07", "42701", "42710", "does not exist, skipping"];

// DRY_RUN=1 이면 DB에 아무것도 쓰지 않고 실행될 구문만 보여준다
const DRY_RUN = process.env.DRY_RUN === "1";

async function runSqlFile(file: string) {
  const sql = fs.readFileSync(file, "utf8");
  const stmts = splitStatements(sql);
  if (DRY_RUN) {
    console.log(`(dry-run) ${path.basename(file)}: ${stmts.length}개 구문`);
    for (const s of stmts) console.log("   " + s.replace(/\s+/g, " ").slice(0, 90));
    return;
  }
  let ok = 0, skipped = 0;
  for (const s of stmts) {
    try {
      await prisma.$executeRawUnsafe(s);
      ok++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (IGNORABLE.some((k) => msg.includes(k))) { skipped++; continue; }
      console.error("\n❌ 실패한 구문:\n" + s.slice(0, 300));
      throw e;
    }
  }
  console.log(`✅ ${path.basename(file)}: ${ok}개 실행, ${skipped}개 이미 적용됨`);
}

async function main() {
  const recovery = path.join(dbDir, "prisma/recovery-20260927");
  console.log("① 스키마 보정");
  await runSqlFile(path.join(recovery, "01_schema.sql"));
  console.log("② RLS 재활성화");
  await runSqlFile(path.join(recovery, "02_rls.sql"));
  await prisma.$disconnect();
  if (DRY_RUN) { console.log("(dry-run) ③ 데이터 복원, ④ baseline 기록은 건너뜀"); return; }

  console.log("③ 데이터 복원");
  execSync(`npx tsx "${path.resolve(__dirname, "restore_from_salvage.ts")}"`, { cwd: dbDir, stdio: "inherit" });

  console.log("④ 마이그레이션 baseline 기록");
  execSync("npx prisma migrate resolve --applied 20260927000000_baseline", { cwd: dbDir, stdio: "inherit" });
  execSync("npx prisma migrate status", { cwd: dbDir, stdio: "inherit" });

  console.log("\n🎉 복구 완료. 다음: 관리자 로그인 → 임시 비밀번호 변경 → 설정/구독 설정/상세페이지 재입력");
}

main().catch((e) => { console.error(e); process.exit(1); });
