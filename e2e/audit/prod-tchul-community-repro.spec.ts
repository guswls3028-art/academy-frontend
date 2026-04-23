/**
 * tchul.com 커뮤니티 에러 간헐 재현 (2026-04-23)
 *
 * v2 감사에서 1회 잡힌 "오류가 발생했습니다" 에러가 간헐적인지 확인.
 * 5회 반복 진입하며 에러 UI 출현 여부 기록.
 */
import { test } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import * as fs from "fs";
import * as path from "path";

const DIR = "e2e/screenshots/prod-audit-v2-2026-04-23/tchul-community-repro";
const LOG = "e2e/reports/tchul-community-repro.md";

test("tchul 커뮤니티 간헐 재현 5회", async ({ page }) => {
  test.setTimeout(180_000);
  fs.mkdirSync(DIR, { recursive: true });

  const log: string[] = [];
  const errors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const t = msg.text();
      if (/favicon|ResizeObserver/.test(t)) return;
      errors.push(t);
    }
  });
  page.on("pageerror", (err) => {
    errors.push(`PAGE ERROR: ${err.message}`);
  });

  await loginViaUI(page, "tchul-admin");
  await page.waitForTimeout(1500);

  let errorCount = 0;
  for (let i = 1; i <= 5; i++) {
    // 다양한 경로로 진입: 1, 3회는 대시보드→사이드바, 2, 4회는 타 도메인→사이드바, 5회는 직접 URL
    if (i === 2 || i === 4) {
      // 다른 도메인을 먼저 들렀다가
      await page.goto(getBaseUrl("tchul-admin") + "/admin/videos", { waitUntil: "load" }).catch(()=>{});
      await page.waitForTimeout(1000);
    } else if (i === 5) {
      // 직접 URL
      await page.goto(getBaseUrl("tchul-admin") + "/admin/community", { waitUntil: "load" }).catch(()=>{});
    } else {
      await page.goto(getBaseUrl("tchul-admin") + "/admin/dashboard", { waitUntil: "load" }).catch(()=>{});
      await page.waitForTimeout(800);
    }

    if (i !== 5) {
      const link = page.locator(`aside.sidebar a.nav-item:has-text("커뮤니티")`).first();
      if (await link.count() > 0) {
        await link.click({ timeout: 6_000 }).catch(()=>{});
      }
    }
    await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(()=>{});

    // 즉시 캡처 (로딩 중 에러 여부)
    await page.screenshot({ path: path.join(DIR, `run-${i}-immediate.png`), fullPage: true }).catch(()=>{});
    const imm = (await page.locator("body").innerText().catch(()=>"") || "");
    const immError = /오류가 발생했습니다|문제가 발생했습니다/.test(imm);

    await page.waitForTimeout(2500);

    await page.screenshot({ path: path.join(DIR, `run-${i}-settled.png`), fullPage: true }).catch(()=>{});
    const set = (await page.locator("body").innerText().catch(()=>"") || "");
    const setError = /오류가 발생했습니다|문제가 발생했습니다/.test(set);

    if (immError || setError) errorCount++;
    log.push(`#${i} immediate=${immError ? "ERROR" : "OK"}  settled=${setError ? "ERROR" : "OK"}  url=${page.url()}`);
  }

  const out = [
    "# tchul.com 커뮤니티 간헐 재현 (5회)",
    "",
    `- 에러 출현: ${errorCount}/5`,
    "",
    "## 시행별 결과",
    ...log.map(l => `- ${l}`),
    "",
    "## 수집된 콘솔/페이지 에러",
    "```",
    errors.join("\n") || "(없음)",
    "```",
  ];
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.writeFileSync(LOG, out.join("\n"), "utf-8");
  console.log(`\n=== 재현 결과: ${errorCount}/5 에러 ===\n`);
});
