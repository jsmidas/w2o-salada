/**
 * 화면 스크린샷 — <img> → next/image 전환 전후를 눈으로 대조하려고 쓴다.
 * 사용: node tools/shot.mjs <라벨> <경로...>
 *   예: node tools/shot.mjs before / /menu /products/xxx
 * 결과: .shots/<라벨>/<경로>.png  (데스크톱 1280 + 모바일 390 두 벌)
 */
import { chromium } from "playwright";
import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import path from "path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const label = process.argv[2] ?? "shot";
const routes = process.argv.slice(3);
if (routes.length === 0) {
  console.error("경로를 하나 이상 주세요");
  process.exit(1);
}

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

// 설치된 playwright 가 원하는 빌드가 없을 수 있다 — 캐시에 있는 chromium 을 직접 쓴다
const cached = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, "ms-playwright", "chromium-1217", "chrome-win64", "chrome.exe")
  : null;
const launchOpts = cached && existsSync(cached) ? { executablePath: cached } : {};
const browser = await chromium.launch(launchOpts);

/**
 * 로그인 상태가 필요한 화면(관리자·마이페이지)을 찍을 때 쓴다.
 * SHOT_LOGIN=1 이면 개발 전용 데모 관리자(admin/admin1234)로 들어간다 —
 * auth.ts 가 NODE_ENV=development 에서만 허용하는 계정이라 운영에는 없다.
 */
async function login(page) {
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("아이디를 입력하세요").fill(process.env.SHOT_ID ?? "admin");
  await page.getByPlaceholder("비밀번호를 입력하세요").fill(process.env.SHOT_PW ?? "admin1234");
  await page.getByRole("button", { name: /로그인/ }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);
}
try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    if (process.env.SHOT_LOGIN === "1") {
      try {
        await login(page);
      } catch (err) {
        console.log(`  [${vp.name}] 로그인 실패: ${String(err).slice(0, 70)}`);
      }
    }
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 120)); });
    page.on("requestfailed", (r) => errors.push(`요청실패 ${r.url().slice(-60)}`));

    for (const route of routes) {
      const slug = route.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "") || "home";
      const dir = path.join(".shots", label);
      await mkdir(dir, { recursive: true });
      const file = path.join(dir, `${slug}.${vp.name}.png`);
      try {
        await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 30000 });
        // 이미지 로딩까지 기다린다 (지연 로딩 포함)
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(800);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(300);
        await page.screenshot({ path: file, fullPage: true });
        // 깨진 이미지와 next/image 적용 여부를 함께 본다.
        // next/image 를 타면 src 가 /_next/image?url=... 로 바뀐다.
        const stat = await page.evaluate(() => {
          const imgs = [...document.querySelectorAll("img")];
          return {
            total: imgs.length,
            broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length,
            optimized: imgs.filter((i) => i.currentSrc.includes("/_next/image")).length,
            remoteRaw: imgs.filter((i) => /^https?:/.test(i.currentSrc) && !i.currentSrc.includes("/_next/image")).length,
          };
        });
        const flag = stat.broken > 0 ? " ⚠ 깨짐" : "";
        console.log(
          `  ${vp.name.padEnd(7)} ${route.padEnd(22)} img ${String(stat.total).padStart(2)} · 최적화 ${String(stat.optimized).padStart(2)} · 원격원본 ${String(stat.remoteRaw).padStart(2)} · 깨짐 ${stat.broken}${flag}`,
        );
      } catch (err) {
        console.log(`  ${vp.name.padEnd(7)} ${route.padEnd(24)} 실패: ${err.message.slice(0, 60)}`);
      }
    }
    if (errors.length) console.log(`  [${vp.name}] 콘솔/요청 오류 ${errors.length}건: ${errors.slice(0, 2).join(" | ")}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
