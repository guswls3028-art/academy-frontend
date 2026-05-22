/**
 * V3 reports 페이지 오류 진단 — 콘솔 에러 캡처
 */
import { test } from "@playwright/test";

const TCHUL = "https://tchul.com";
const SS = (name: string) =>
  `e2e/screenshots/tchul-blueprint-final-20260512/${name}.png`;

test("V3-diag console errors on /landing/reports", async ({ page }) => {
  const errors: string[] = [];
  const networkFails: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(`PAGEERROR: ${err.message}`));
  page.on("requestfailed", (req) => networkFails.push(`${req.url()} — ${req.failure()?.errorText}`));

  await page.goto(`${TCHUL}/landing/reports`, { waitUntil: "load", timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  await page.locator("body").waitFor({ state: "visible", timeout: 10000 });

  console.log("=== CONSOLE ERRORS ===");
  errors.forEach((e) => console.log(e));
  console.log("=== NETWORK FAILS ===");
  networkFails.forEach((n) => console.log(n));

  // URL after navigation
  console.log("URL:", page.url());

  // Try to get the full body text
  const bodyText = await page.locator("body").innerText().catch(() => "");
  console.log("BODY:", bodyText.slice(0, 500));

  // Check what chunk failed
  const htmlContent = await page.content();
  const scriptTags = htmlContent.match(/<script[^>]*src="[^"]*"[^>]*>/g) || [];
  console.log("Script tags:", scriptTags.join("\n"));

  await page.screenshot({ path: SS("v3-diag-reports"), fullPage: true });
});

test("V3-diag /landing then click 전체보기", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(`PAGEERROR: ${err.message}`));

  await page.goto(`${TCHUL}/landing`, { waitUntil: "load", timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

  // Click "전체 보기 →"
  const viewAllBtn = page.locator("a, button").filter({ hasText: /전체 보기|전체보기|보기 →/ }).first();
  const visible = await viewAllBtn.isVisible().catch(() => false);
  console.log("전체보기 btn visible:", visible);
  if (visible) {
    await Promise.all([
      page.waitForURL(/\/landing\/reports/, { timeout: 15000 }).catch(() => {}),
      viewAllBtn.click(),
    ]);
    await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    console.log("URL after click:", page.url());
    console.log("=== ERRORS AFTER NAV ===");
    errors.forEach((e) => console.log(e));
    await page.screenshot({ path: SS("v3-diag-after-viewall"), fullPage: false });
  }
});
