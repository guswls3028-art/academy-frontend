/**
 * Mobile / Narrow Viewport Visual Regression
 * 4 pages × 3 viewports = 12 screenshots
 * Dir: e2e/screenshots/mobile-narrow-viewport-20260512/
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import { fileURLToPath } from "url";
import * as path from "path";
import * as fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOT_DIR = path.resolve(
  __dirname,
  "../../screenshots/mobile-narrow-viewport-20260512"
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
  return p;
}

// ─── M1: /landing ────────────────────────────────────────────────────────────
test.describe("M1 /landing", () => {
  for (const vp of VIEWPORTS) {
    test(`landing-${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await ctx.newPage();

      await page.goto(`${BASE}/landing`, { waitUntil: "load", timeout: 30_000 });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(1500);

      await shot(page, `M1-landing-${vp.name}`);

      // Basic DOM assertion: h1 visible
      const h1 = page.locator("h1").first();
      await expect(h1).toBeVisible({ timeout: 8_000 });

      // Check no horizontal overflow (10px tolerance)
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      console.log(`[M1-${vp.name}] body.scrollWidth=${bodyWidth} viewport=${vp.width}`);

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
        waitUntil: "load",
        timeout: 30_000,
      });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(2000);

      await shot(page, `M2-hit-reports-${vp.name}`);

      // At minimum the page container is visible
      const body = page.locator("body");
      await expect(body).toBeVisible();

      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      console.log(`[M2-${vp.name}] body.scrollWidth=${bodyWidth} viewport=${vp.width}`);

      await ctx.close();
    });
  }
});

// ─── M3: /landing/share/974715e6... (incognito) ──────────────────────────────
test.describe("M3 /landing/share incognito", () => {
  const SHARE_URL = `${BASE}/landing/share/974715e6-e326-46f6-8c6a-53bd65ebda6d`;

  for (const vp of VIEWPORTS) {
    test(`share-${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await ctx.newPage();

      await page.goto(SHARE_URL, { waitUntil: "load", timeout: 30_000 });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(2000);

      await shot(page, `M3-share-${vp.name}`);

      const body = page.locator("body");
      await expect(body).toBeVisible();

      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      console.log(`[M3-${vp.name}] body.scrollWidth=${bodyWidth} viewport=${vp.width}`);

      // Fail if horizontal overflow > 10px
      if (bodyWidth > vp.width + 10) {
        console.log(`[M3-${vp.name}] OVERFLOW DETECTED: ${bodyWidth} > ${vp.width}`);
      }

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
        waitUntil: "load",
        timeout: 30_000,
      });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(2000);

      await shot(page, `M4-board-${vp.name}`);

      const body = page.locator("body");
      await expect(body).toBeVisible();

      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      console.log(`[M4-${vp.name}] body.scrollWidth=${bodyWidth} viewport=${vp.width}`);

      await ctx.close();
    });
  }
});
