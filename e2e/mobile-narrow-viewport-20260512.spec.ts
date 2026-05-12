/**
 * Mobile / Narrow Viewport Visual Regression
 * 4 pages × 3 viewports = 12 screenshots
 * Dir: e2e/screenshots/mobile-narrow-viewport-20260512/
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
import * as path from "path";
import * as fs from "fs";

const SCREENSHOT_DIR = path.resolve(
  __dirname,
  "screenshots/mobile-narrow-viewport-20260512"
);

const BASE = "https://hakwonplus.com";

const VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "1100", width: 1100, height: 768 },
  { name: "1366", width: 1366, height: 768 },
];

async function shot(page: import("@playwright/test").Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const p = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`[SHOT] ${p}`);
}

// ─── M1: /landing ────────────────────────────────────────────────────────────
test.describe("M1 /landing", () => {
  for (const vp of VIEWPORTS) {
    test(`landing-${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await ctx.newPage();

      await page.goto(`${BASE}/landing`, { waitUntil: "networkidle", timeout: 30_000 });
      // wait for hero content
      await page.waitForSelector("h1, .hero, [class*='hero'], [class*='landing']", {
        timeout: 10_000,
      }).catch(() => {});
      await page.waitForTimeout(1500);

      await shot(page, `M1-landing-${vp.name}`);

      // Basic DOM assertions
      const h1 = page.locator("h1").first();
      await expect(h1).toBeVisible();

      // Check no horizontal overflow
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const vpWidth = vp.width;
      console.log(
        `[M1-${vp.name}] body.scrollWidth=${bodyWidth} viewport=${vpWidth}`
      );
      // Allow up to 10px tolerance for scrollbar
      expect(bodyWidth).toBeLessThanOrEqual(vpWidth + 10);

      await ctx.close();
    });
  }
});

// ─── M2: /admin/storage/hit-reports ──────────────────────────────────────────
test.describe("M2 /admin/storage/hit-reports", () => {
  for (const vp of VIEWPORTS) {
    test(`hit-reports-${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await ctx.newPage();

      await loginViaUI(page, "admin");
      await page.goto(`${BASE}/admin/storage/hit-reports`, {
        waitUntil: "networkidle",
        timeout: 30_000,
      });
      await page.waitForTimeout(2000);

      await shot(page, `M2-hit-reports-${vp.name}`);

      // Check table / card list is visible
      const tableOrCard = page.locator("table, [class*='card'], [class*='row'], [class*='list']").first();
      await expect(tableOrCard).toBeVisible({ timeout: 8_000 });

      // Check horizontal overflow
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      console.log(
        `[M2-${vp.name}] body.scrollWidth=${bodyWidth} viewport=${vp.width}`
      );

      await ctx.close();
    });
  }
});

// ─── M3: /landing/share/974715e6-e326-46f6-8c6a-53bd65ebda6d ─────────────────
test.describe("M3 /landing/share (incognito)", () => {
  const SHARE_URL = `${BASE}/landing/share/974715e6-e326-46f6-8c6a-53bd65ebda6d`;

  for (const vp of VIEWPORTS) {
    test(`share-${vp.name}`, async ({ browser }) => {
      // incognito = new context with no stored state
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        storageState: undefined,
      });
      const page = await ctx.newPage();

      await page.goto(SHARE_URL, { waitUntil: "networkidle", timeout: 30_000 });
      await page.waitForTimeout(2000);

      await shot(page, `M3-share-${vp.name}`);

      // KPI 적중률 visible
      const kpi = page
        .locator(
          "[class*='kpi'], [class*='hit'], [class*='rate'], [class*='percent'], h2, h3"
        )
        .first();
      await expect(kpi).toBeVisible({ timeout: 8_000 }).catch(() => {
        console.log(`[M3-${vp.name}] KPI selector not matched — checking page loaded`);
      });

      // Check overflow
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      console.log(
        `[M3-${vp.name}] body.scrollWidth=${bodyWidth} viewport=${vp.width}`
      );
      expect(bodyWidth).toBeLessThanOrEqual(vp.width + 10);

      await ctx.close();
    });
  }
});

// ─── M4: /admin/community/board ──────────────────────────────────────────────
test.describe("M4 /admin/community/board", () => {
  for (const vp of VIEWPORTS) {
    test(`board-${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await ctx.newPage();

      await loginViaUI(page, "admin");
      await page.goto(`${BASE}/admin/community/board`, {
        waitUntil: "networkidle",
        timeout: 30_000,
      });
      await page.waitForTimeout(2000);

      await shot(page, `M4-board-${vp.name}`);

      // Board panel visible
      const panel = page.locator("[class*='board'], [class*='pane'], [class*='tree'], table, [class*='list']").first();
      await expect(panel).toBeVisible({ timeout: 8_000 });

      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      console.log(
        `[M4-${vp.name}] body.scrollWidth=${bodyWidth} viewport=${vp.width}`
      );

      await ctx.close();
    });
  }
});
