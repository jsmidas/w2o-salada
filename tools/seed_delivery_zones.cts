/**
 * 배송 권역 시드 — CSV 를 읽어 DeliveryZone 에 (kind, code) 기준으로 upsert 한다. 멱등.
 *
 *   cd packages/db && npx tsx ../../tools/seed_delivery_zones.cts [CSV 경로]
 *   기본 CSV: packages/db/prisma/seeds/delivery-zones.csv
 *   DRY_RUN=1 이면 DB 에 쓰지 않고 파싱 결과만 출력한다.
 *
 * CSV 형식 (헤더 필수, 열 순서 무관, 관리자 화면 CSV 업로드와 같은 형식):
 *   kind,code,name,sido,sigungu,isActive,memo
 *   kind     ZIP(우편번호) | BCODE(법정동 코드)
 *   code     ZIP 은 5자리, BCODE 는 5~10자리 접두 (5=시군구 전체, 8=읍면동, 10=리)
 *   isActive 1/0, true/false, Y/N (비우면 1)
 *
 * 운영 DB 에 쓰는 명령이지만 INSERT/UPDATE 만 한다 — 어떤 행도 지우거나 비활성화하지 않는다.
 * (CSV 에서 빠진 권역을 끄고 싶으면 관리자 화면에서 토글한다)
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient, type ZoneKeyKind } from "@prisma/client";

const prisma = new PrismaClient();

type Row = { kind: ZoneKeyKind; code: string; name: string; sido: string | null; sigungu: string | null; isActive: boolean; memo: string | null };

function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); out.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length > 0) { row.push(cell); out.push(row); }
  return out.filter((r) => r.some((c) => c.trim() !== ""));
}

function toRow(obj: Record<string, string>, line: number): Row | string {
  const kindRaw = (obj.kind ?? "").trim().toUpperCase();
  const kind: ZoneKeyKind | null = kindRaw === "ZIP" || kindRaw === "우편번호" ? "ZIP" : kindRaw === "BCODE" || kindRaw === "법정동" || kindRaw === "법정동코드" ? "BCODE" : null;
  if (!kind) return `${line}행: kind 는 ZIP 또는 BCODE ("${obj.kind ?? ""}")`;
  const digits = (obj.code ?? "").replace(/\D/g, "");
  if (kind === "ZIP" && digits.length !== 5) return `${line}행: 우편번호는 5자리 ("${obj.code ?? ""}")`;
  if (kind === "BCODE" && (digits.length < 5 || digits.length > 10)) return `${line}행: 법정동 코드는 5~10자리 ("${obj.code ?? ""}")`;
  const name = (obj.name ?? "").trim();
  if (!name) return `${line}행: name 없음 (${digits})`;
  const act = (obj.isActive ?? "").trim().toLowerCase();
  const isActive = act === "" ? true : !["0", "false", "n", "no", "off", "비활성"].includes(act);
  const opt = (v: string | undefined) => { const s = (v ?? "").trim(); return s ? s : null; };
  return { kind, code: digits, name, sido: opt(obj.sido), sigungu: opt(obj.sigungu), isActive, memo: opt(obj.memo) };
}

async function main() {
  const file = process.argv[2] ?? path.resolve(__dirname, "../packages/db/prisma/seeds/delivery-zones.csv");
  const dry = process.env.DRY_RUN === "1";
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  if (rows.length < 2) throw new Error("CSV 에 헤더와 데이터 행이 필요합니다.");
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const need = ["kind", "code", "name"];
  for (const n of need) if (!header.includes(n)) throw new Error(`헤더에 ${n} 열이 없습니다. (현재: ${header.join(",")})`);

  const parsed: Row[] = [];
  const errors: string[] = [];
  rows.slice(1).forEach((cells, i) => {
    const obj: Record<string, string> = {};
    header.forEach((h, j) => { obj[h] = cells[j] ?? ""; });
    const r = toRow(obj, i + 2);
    if (typeof r === "string") errors.push(r); else parsed.push(r);
  });

  console.log(`📄 ${path.basename(file)}: ${parsed.length}행 유효, ${errors.length}행 오류${dry ? " (DRY_RUN — DB 에 쓰지 않음)" : ""}`);
  for (const e of errors) console.log("  ✗", e);
  if (dry) {
    for (const r of parsed) console.log(`  ${r.isActive ? "●" : "○"} ${r.kind} ${r.code.padEnd(10)} ${r.name}${r.sigungu ? ` (${r.sigungu})` : ""}`);
    return;
  }

  let created = 0, updated = 0;
  for (const r of parsed) {
    const res = await prisma.deliveryZone.upsert({
      where: { kind_code: { kind: r.kind, code: r.code } },
      update: { name: r.name, sido: r.sido, sigungu: r.sigungu, isActive: r.isActive, memo: r.memo },
      create: r,
      select: { createdAt: true, updatedAt: true },
    });
    if (res.updatedAt.getTime() - res.createdAt.getTime() < 1000) created++; else updated++;
  }
  const total = await prisma.deliveryZone.count();
  const active = await prisma.deliveryZone.count({ where: { isActive: true } });
  console.log(`✅ 등록 ${created} · 갱신 ${updated} → 권역 ${total}개 (활성 ${active})`);
  console.log("ℹ️  기존 배송지에 권역을 반영하려면 관리자 → 설정 → 배송 권역 → \"기존 배송지 좌표 보정·재판정\" 을 한 번 돌리세요.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
