/**
 * Supabase anon 키로 public 테이블 REST 호출이 차단됐는지 검증.
 * 차단 = OK (401/403/404 또는 PostgREST 거부).
 * 데이터 반환 = 보안 미흡.
 */
import "dotenv/config";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 누락");
  process.exit(1);
}

const targets = ["users", "payments", "subscriptions", "inquiries", "addresses", "apartments", "phone_verifications", "orders", "delivery_routes"];

async function probeRest(table: string) {
  const r = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = await r.text();
  const head = body.length > 200 ? body.slice(0, 200) + "…" : body;
  const verdict =
    r.status >= 400 || body === "[]" ? "✓ blocked" : "✗ STILL EXPOSED";
  console.log(`${verdict.padEnd(18)} rest/${table.padEnd(15)} HTTP ${r.status}  ${head}`);
}

async function probeStorageList(bucket: string) {
  // anon이 bucket 내 파일 목록을 조회 가능한지 — 막혀 있어야 정상.
  const r = await fetch(`${url}/storage/v1/object/list/${bucket}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefix: "", limit: 1 }),
  });
  const body = await r.text();
  const head = body.length > 200 ? body.slice(0, 200) + "…" : body;
  const verdict =
    r.status >= 400 || body === "[]" ? "✓ blocked" : "✗ STILL LISTABLE";
  console.log(`${verdict.padEnd(18)} storage/${bucket.padEnd(11)} HTTP ${r.status}  ${head}`);
}

async function probeStorageUpload(bucket: string) {
  // anon이 임의 파일을 업로드 가능한지 — 막혀 있어야 정상.
  const probeName = `__sec_probe_${Date.now()}.txt`;
  const r = await fetch(`${url}/storage/v1/object/${bucket}/${probeName}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "text/plain" },
    body: "probe",
  });
  const body = await r.text();
  const head = body.length > 200 ? body.slice(0, 200) + "…" : body;
  const verdict = r.status >= 400 ? "✓ blocked" : "✗ STILL WRITABLE";
  console.log(`${verdict.padEnd(18)} storage/${bucket}/upload  HTTP ${r.status}  ${head}`);
}

(async () => {
  console.log("== REST API (public 테이블) ==");
  for (const t of targets) await probeRest(t);
  console.log("\n== Storage (images 버킷) ==");
  await probeStorageList("images");
  await probeStorageUpload("images");
})();
