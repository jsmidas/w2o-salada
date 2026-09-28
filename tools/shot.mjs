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
try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
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
        // 실제로 깨진 이미지가 있는지 센다
        const broken = await page.evaluate(() =>
          [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth === 0).length,
        );
        const total = await page.evaluate(() => document.querySelectorAll("img").length);
        console.log(`  ${vp.name.padEnd(7)} ${route.padEnd(24)} img ${total}개, 깨짐 ${broken}개 → ${file}`);
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
