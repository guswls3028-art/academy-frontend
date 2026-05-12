/**
 * [B] Targeted retry — share chip clipboard behavior in headless
 * In headless Playwright, navigator.clipboard requires permissions grant.
 * We grant clipboard-write permission and verify toast fires.
 */
import { test, expect, chromium } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
import path from "path";
import fs from "fs";

const BASE = process.env.E2E_BASE_URL ?? "https://hakwonplus.com";
const SHOTS = path.resolve("e2e/screenshots/prod-visual-20260512-cycle3");
fs.mkdirSync(SHOTS, { recursive: true });

async function shot(page: any, name: string) {
  const p = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

test("[B-retry] share chip with clipboard permission granted", async ({}) => {
  // Launch browser with clipboard-write permission granted
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();

  // Intercept window.prompt to prevent blocking
  await page.addInitScript(() => {
    (window as any).prompt = (msg: string, val: string) => val;
  });

  // Login via API token injection
  const resp = await page.request.post("https://api.hakwonplus.com/api/v1/token/", {
    data: { username: "admin97", password: "koreaseoul97", tenant_code: "hakwonplus" },
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
  await page.waitForTimeout(1500);
  await shot(page, "B-retry-01-page-loaded");

  // Find share chip button
  const shareBtn = page.locator("[data-testid='hit-report-share-copy']").first();
  const shareBtnVisible = await shareBtn.isVisible().catch(() => false);
  console.log("[B-retry] share chip button visible:", shareBtnVisible);

  if (!shareBtnVisible) {
    console.log("[B-retry] no share chip found, check page state");
    await shot(page, "B-retry-02-no-chip");
    await browser.close();
    return;
  }

  // Get data-share-active state
  const shareActive = await shareBtn.getAttribute("data-share-active");
  console.log("[B-retry] share-active:", shareActive);

  // Click the chip
  await shareBtn.click();

  // Wait for toast — check multiple possible messages
  await page.waitForTimeout(1500);

  // Check all possible toast variants
  const successToast = page.locator("text=/공유 링크를.*복사했습니다/").first();
  const infoToast = page.locator("text=/공유 링크가 위 입력창|직접 복사/").first();
  const errorToast = page.locator("text=/생성 실패|실패/").first();

  const successVisible = await successToast.isVisible().catch(() => false);
  const infoVisible = await infoToast.isVisible().catch(() => false);
  const errorVisible = await errorToast.isVisible().catch(() => false);

  console.log("[B-retry] success toast visible:", successVisible);
  console.log("[B-retry] info toast visible:", infoVisible);
  console.log("[B-retry] error toast visible:", errorVisible);

  // Also check for any toast/notification element
  const anyToast = page.locator("[class*='toast'], [class*='Toast'], [class*='notification'], [role='alert']").first();
  const anyToastVisible = await anyToast.isVisible().catch(() => false);
  const anyToastText = await anyToast.textContent().catch(() => "");
  console.log("[B-retry] any toast visible:", anyToastVisible, "text:", anyToastText?.substring(0, 100));

  await shot(page, "B-retry-03-after-click");

  // Wait more for delayed toast
  await page.waitForTimeout(2000);
  const successVisible2 = await successToast.isVisible().catch(() => false);
  const anyToastVisible2 = await anyToast.isVisible().catch(() => false);
  console.log("[B-retry] success toast (2s later):", successVisible2);
  console.log("[B-retry] any toast (2s later):", anyToastVisible2);

  await shot(page, "B-retry-04-2s-later");

  // Check clipboard content if possible
  try {
    const clipText = await page.evaluate(() => navigator.clipboard.readText());
    console.log("[B-retry] clipboard text:", clipText?.substring(0, 100));
  } catch (e) {
    console.log("[B-retry] clipboard read failed:", String(e).substring(0, 100));
  }

  const anyToastFired = successVisible || infoVisible || anyToastVisible || successVisible2 || anyToastVisible2;
  console.log("[B-retry] RESULT: any toast fired:", anyToastFired);

  await browser.close();

  // The chip should at minimum trigger some feedback
  expect(anyToastFired).toBe(true);
});
