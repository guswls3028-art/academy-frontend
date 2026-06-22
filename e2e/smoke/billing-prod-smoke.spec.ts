/**
 * 운영 배포 후 스모크 검증 — hakwonplus.com 기준
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

const PROD = process.env.E2E_BASE_URL || "https://hakwonplus.com";

async function gotoProd(page: Page, path: string) {
  await page.goto(`${PROD}${path}`, { waitUntil: "load", timeout: 20000 });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
}

test.describe("Production smoke: billing", () => {
  test.setTimeout(120000);
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin", { landingPath: "/dev/billing" });
  });

  test("PROD-1. /dev/billing renders dashboard", async ({ page }) => {
    await gotoProd(page, "/dev/billing");
    await expect(page.locator("text=월 반복 매출")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=전체 테넌트")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: "e2e/screenshots/prod-01-dashboard.png" });
  });

  test("PROD-2. Tenants/Invoices tab switch", async ({ page }) => {
    await gotoProd(page, "/dev/billing");
    await page.locator("button").filter({ hasText: /^인보이스$/ }).click();
    const ok = await page.locator("th").filter({ hasText: "인보이스" }).isVisible({ timeout: 5000 }).catch(() => false)
      || await page.locator("text=인보이스가 없습니다.").isVisible({ timeout: 3000 }).catch(() => false);
    expect(ok).toBe(true);
    await page.screenshot({ path: "e2e/screenshots/prod-02-invoices.png" });
  });

  test("PROD-3. Extend modal opens (no submit)", async ({ page }) => {
    await gotoProd(page, "/dev/billing");
    const btn = page.locator("button").filter({ hasText: /^연장$/ }).first();
    await btn.waitFor({ state: "visible", timeout: 10000 });
    await btn.click();
    await expect(page.locator("h2").filter({ hasText: "구독 기간 연장" })).toBeVisible({ timeout: 5000 });
    await page.locator("button").filter({ hasText: "취소" }).click();
    await page.screenshot({ path: "e2e/screenshots/prod-03-extend.png" });
  });

  test("PROD-4. /admin/settings/billing renders with card section", async ({ page }) => {
    await gotoProd(page, "/admin/settings/billing");
    await expect(page.locator("h2").filter({ hasText: "결제 / 구독" })).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=결제 카드")).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: "e2e/screenshots/prod-04-billing-settings.png" });
  });

  test("PROD-5. Status filter works", async ({ page }) => {
    await gotoProd(page, "/dev/billing");
    await page.locator("select").first().selectOption("active");
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 10000 });
    const rows = await page.locator("table tbody tr").count();
    expect(rows).toBeGreaterThan(0);
    await page.screenshot({ path: "e2e/screenshots/prod-05-filter.png" });
  });
});
