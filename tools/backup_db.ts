/**
 * DB 백업 — public 스키마 전 테이블을 JSON 으로 덤프한다.
 *
 * pg_dump 가 없는 환경(Windows 로컬)에서도 돌아가는 최소 백업.
 * GitHub Actions 일일 백업(.github/workflows/db-backup.yml)은 pg_dump 와 이 스크립트를 둘 다 돌린다.
 *
 * 실행:  cd packages/db && npx tsx ../../tools/backup_db.ts [출력폴더]
 *   접속: 환경변수 DIRECT_URL > DATABASE_URL > packages/db/.env
 *   출력: backups/<YYYYMMDD-HHmm>/<table>.json + manifest.json (기본), 폴더는 .gitignore 대상
 */
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

function resolveUrl(): string {
  if (process.env.DIRECT_URL) return process.env.DIRECT_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.resolve(__dirname, "../packages/db/.env");
  const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const m = env.match(/^DIRECT_URL="?([^"\r\n]+)"?/m) ?? env.match(/^DATABASE_URL="?([^"\r\n]+)"?/m);
  if (!m) throw new Error("DB 접속 문자열을 찾을 수 없습니다 (DIRECT_URL / DATABASE_URL).");
  return m[1]!;
}

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: resolveUrl() });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 13).replace("T", "-");
  const outDir = path.resolve(process.argv[2] ?? path.resolve(__dirname, "../backups", stamp));
  fs.mkdirSync(outDir, { recursive: true });

  const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  );
  const manifest: Record<string, number> = {};
  for (const { tablename } of tables) {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM "${tablename}"`);
    fs.writeFileSync(
      path.join(outDir, `${tablename}.json`),
      JSON.stringify(rows, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 1),
    );
    manifest[tablename] = rows.length;
  }
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ createdAt: new Date().toISOString(), tables: manifest }, null, 1));
  await prisma.$disconnect();

  const total = Object.values(manifest).reduce((a, b) => a + b, 0);
  console.log(`✅ 백업 완료: ${tables.length}개 테이블, ${total}행 → ${outDir}`);
  for (const [t, n] of Object.entries(manifest)) console.log(`   ${t.padEnd(26)} ${n}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
