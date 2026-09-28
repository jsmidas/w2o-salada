/**
 * 이미지 백업 — DB가 참조하는 Storage 파일을 받아 둔다.
 *
 * Supabase Storage 는 DB 백업에 포함되지 않는다. 버킷이 날아가면 DB 를 복원해도
 * URL 만 남고 상품 사진은 돌아오지 않으므로 따로 받아 둔다.
 *
 * 버킷 전체를 훑으려면 서비스 롤 키가 필요하지만, 이미지가 public 경로라
 * DB 에 적힌 URL 로 그냥 받을 수 있다. 키가 필요 없고 DB 와 항상 일관된다.
 * 다만 **DB 가 참조하지 않는 고아 파일은 백업되지 않는다** — 복구에 필요한 건
 * 참조되는 파일뿐이라 의도한 동작이다.
 *
 * 사용: npx tsx tools/backup_images.ts <출력_디렉터리>
 */
import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const outDir = process.argv[2] ?? "backup/images";

/** Supabase Storage public URL 만 고른다 (상대경로는 저장소의 정적 파일이라 제외) */
function isStorageUrl(u: string | null): u is string {
  if (!u) return false;
  try {
    const url = new URL(u);
    return url.host.endsWith(".supabase.co") && url.pathname.includes("/storage/v1/object/public/");
  } catch {
    return false;
  }
}

/** URL 에서 버킷 이후 경로를 뽑는다 — .../object/public/images/pages/a.jpg → images/pages/a.jpg */
function storagePath(u: string): string {
  const marker = "/storage/v1/object/public/";
  const i = u.indexOf(marker);
  return decodeURIComponent(u.slice(i + marker.length).split("?")[0]!);
}

async function collectUrls(): Promise<string[]> {
  const [products, deliveries, pages] = await Promise.all([
    prisma.product.findMany({ where: { imageUrl: { not: null } }, select: { imageUrl: true } }),
    prisma.delivery.findMany({ where: { photoUrl: { not: null } }, select: { photoUrl: true } }),
    prisma.productPage.findMany({ select: { content: true } }).catch(() => [] as { content: string | null }[]),
  ]);

  const urls = new Set<string>();
  for (const p of products) if (isStorageUrl(p.imageUrl)) urls.add(p.imageUrl);
  for (const d of deliveries) if (isStorageUrl(d.photoUrl)) urls.add(d.photoUrl);
  // 상세페이지 본문(HTML/JSON)에 박힌 이미지도 긁는다
  for (const pg of pages) {
    for (const m of String(pg.content ?? "").matchAll(/https:\/\/[^"'\s)]+\/storage\/v1\/object\/public\/[^"'\s)]+/g)) {
      if (isStorageUrl(m[0])) urls.add(m[0]);
    }
  }
  return [...urls].sort();
}

(async () => {
  const urls = await collectUrls();
  console.log(`백업 대상 이미지 ${urls.length}건`);

  const manifest: { path: string; url: string; size: number; sha256: string }[] = [];
  let failed = 0;

  for (const url of urls) {
    const rel = storagePath(url);
    const dest = path.join(outDir, rel);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`  실패 ${res.status} ${rel}`);
        failed++;
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, buf);
      manifest.push({ path: rel, url, size: buf.length, sha256: createHash("sha256").update(buf).digest("hex") });
    } catch (err) {
      console.error(`  오류 ${rel}:`, (err as Error).message);
      failed++;
    }
  }

  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, "manifest.json"),
    JSON.stringify({ createdAt: new Date().toISOString(), count: manifest.length, failed, files: manifest }, null, 1),
  );

  const total = manifest.reduce((s, f) => s + f.size, 0);
  console.log(`받음 ${manifest.length}건 / ${(total / 1024 / 1024).toFixed(2)} MB / 실패 ${failed}건`);
  // 참조된 이미지를 하나도 못 받았으면 백업이 의미 없으므로 실패로 끝낸다
  if (urls.length > 0 && manifest.length === 0) process.exit(1);
})()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
