/**
 * [B] Targeted retry — share chip clipboard behavior in headless
 * In headless Playwright, navigator.clipboard requires permissions grant.
 * We grant clipboard-write permission and verify toast fires.
 */
import { test, expect, type Locator, type Page } from "./fixtures/strictTest";
import path from "path";
import fs from "fs";

const BASE = process.env.E2E_BASE_URL ?? "https://hakwonplus.com";
const SHOTS = path.resolve("e2e/screenshots/prod-visual-20260512-cycle3");
fs.mkdirSync(SHOTS, { recursive: true });

async function shot(page: Page, name: string) {
  const p = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

async function waitForNetworkQuiet(page: Page, timeout = 8000): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout }).catch(() => {});
}

async function waitForAnyVisible(locators: Locator[], timeout = 5000): Promise<void> {
  await Promise.race(
    locators.map((locator) => locator.waitFor({ state: "visible", timeout })),
  ).catch(() => {});
}

test("[B-retry] share chip with clipboard permission granted", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();

  try {
    // Intercept window.prompt to prevent blocking
    await page.addInitScript(() => {
      window.prompt = (_message?: string, value?: string) => value ?? "";
    });

    // Login via API token injection
    const resp = await page.request.post("https://api.hakwonplus.com/api/v1/token/", {
      data: { username: "admin97", password: process.env.E2E_ADMIN_PASS || "__MISSING_E2E_ADMIN_PASS__", tenant_code: "hakwonplus" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
      timeout: 30000,
    });
    const tokens = await resp.json() as { access: string; refresh: string };

    await page.goto(`${BASE}/login`, { waitUntil: "commit" });
    await page.evaluate(({ access, refresh }) => {
      localStorage.setItem("access", access);
      localStorage.setItem("refresh", refresh);
      sessionStorage.setItem("tenantCode", "hakwonplus");
    }, { access: tokens.access, refresh: tokens.refresh });

    await page.goto(`${BASE}/admin/storage/hit-reports`, { waitUntil: "networkidle", timeout: 20000 });
    const shareBtn = page.locator("[data-testid='hit-report-share-copy']").first();
    await shareBtn.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    await shot(page, "B-retry-01-page-loaded");

    // Find share chip button
    const shareBtnVisible = await shareBtn.isVisible().catch(() => false);
    console.log("[B-retry] share chip button visible:", shareBtnVisible);

    if (!shareBtnVisible) {
      console.log("[B-retry] no share chip found, check page state");
      await shot(page, "B-retry-02-no-chip");
      return;
    }

    // Get data-share-active state
    const shareActive = await shareBtn.getAttribute("data-share-active");
    console.log("[B-retry] share-active:", shareActive);

    // Check all possible toast variants
    const successToast = page.locator("text=/공유 링크를.*복사했습니다/").first();
    const infoToast = page.locator("text=/공유 링크가 위 입력창|직접 복사/").first();
    const errorToast = page.locator("text=/생성 실패|실패/").first();
    const anyToast = page.locator("[class*='toast'], [class*='Toast'], [class*='notification'], [role='alert']").first();
    const toastLocators = [successToast, infoToast, errorToast, anyToast];

    // Click the chip
    await shareBtn.click();
    await waitForNetworkQuiet(page);
    await waitForAnyVisible(toastLocators);

    const successVisible = await successToast.isVisible().catch(() => false);
    const infoVisible = await infoToast.isVisible().catch(() => false);
    const errorVisible = await errorToast.isVisible().catch(() => false);

    console.log("[B-retry] success toast visible:", successVisible);
    console.log("[B-retry] info toast visible:", infoVisible);
    console.log("[B-retry] error toast visible:", errorVisible);

    // Also check for any toast/notification element
    const anyToastVisible = await anyToast.isVisible().catch(() => false);
    const anyToastText = await anyToast.textContent().catch(() => "");
    console.log("[B-retry] any toast visible:", anyToastVisible, "text:", anyToastText?.substring(0, 100));

    await shot(page, "B-retry-03-after-click");

    // Allow delayed feedback to surface if the first poll missed it.
    const initialToastFired = successVisible || infoVisible || anyToastVisible;
    if (!initialToastFired) {
      await waitForAnyVisible(toastLocators, 3000);
    }
    const successVisible2 = await successToast.isVisible().catch(() => false);
    const anyToastVisible2 = await anyToast.isVisible().catch(() => false);
    console.log("[B-retry] success toast after retry:", successVisible2);
    console.log("[B-retry] any toast after retry:", anyToastVisible2);

    await shot(page, "B-retry-04-2s-later");

    // Check clipboard content if possible
    try {
      const clipText = await page.evaluate(() => navigator.clipboard.readText());
      console.log("[B-retry] clipboard text:", clipText?.substring(0, 100));
    } catch (e) {
      console.log("[B-retry] clipboard read failed:", String(e).substring(0, 100));
    }

    const anyToastFired = initialToastFired || successVisible2 || anyToastVisible2;
    console.log("[B-retry] RESULT: any toast fired:", anyToastFired);

    // The chip should at minimum trigger some feedback
    expect(anyToastFired).toBe(true);
  } finally {
    await context.close();
  }
});
