/**
 * 운영 배포 후 스모크 검증 — hakwonplus.com 기준
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";

const PROD = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const API = process.env.E2E_API_URL || "https://api.hakwonplus.com";
const CODE = "hakwonplus";
const USER = process.env.E2E_ADMIN_USER || (process.env.E2E_ADMIN_USER || "admin97");
const PASS = process.env.E2E_ADMIN_PASS || (process.env.E2E_ADMIN_PASS || "koreaseoul97");

async function loginProd(page: Page) {
  const r = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: USER, password: PASS, tenant_code: CODE },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": CODE },
  });
  if (r.status() !== 200) throw new Error(`Login: ${r.status()}`);
  const t = await r.json() as { access: string; refresh: string };
  await page.goto(`${PROD}/login`, { waitUntil: "commit" });
  await page.evaluate(({ a, rf, c }) => {
    localStorage.setItem("access", a); localStorage.setItem("refresh", rf);
    try { sessionStorage.setItem("tenantCode", c); } catch {}
  }, { a: t.access, rf: t.refresh, c: CODE });
}

test.describe("Production smoke: billing", () => {
  test.setTimeout(120000);
  test.beforeEach(async ({ page }) => { await loginProd(page); });

  test("PROD-1. /dev/billing renders dashboard", async ({ page }) => {
    await page.goto(`${PROD}/dev/billing`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(4000);
    await expect(page.locator("text=MRR")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: "e2e/screenshots/prod-01-dashboard.png" });
  });

  test("PROD-2. Tenants/Invoices tab switch", async ({ page }) => {
    await page.goto(`${PROD}/dev/billing`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(4000);
    await page.locator("button").filter({ hasText: "Invoices" }).click();
    await page.waitForTimeout(1000);
    const ok = await page.locator("th").filter({ hasText: "Invoice" }).isVisible({ timeout: 5000 }).catch(() => false)
      || await page.locator("text=No invoices").isVisible({ timeout: 3000 }).catch(() => false);
    expect(ok).toBe(true);
    await page.screenshot({ path: "e2e/screenshots/prod-02-invoices.png" });
  });

  test("PROD-3. Extend modal opens (no submit)", async ({ page }) => {
    await page.goto(`${PROD}/dev/billing`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(4000);
    const btn = page.locator("button").filter({ hasText: "Extend" }).first();
    await btn.click();
    await expect(page.locator("h2").filter({ hasText: "Extend Subscription" })).toBeVisible({ timeout: 5000 });
    await page.locator("button").filter({ hasText: "Cancel" }).click();
    await page.screenshot({ path: "e2e/screenshots/prod-03-extend.png" });
  });

  test("PROD-4. /admin/settings/billing renders with card section", async ({ page }) => {
    await page.goto(`${PROD}/admin/settings/billing`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(4000);
    await expect(page.locator("h2").filter({ hasText: "결제 / 구독" })).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=결제 카드")).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: "e2e/screenshots/prod-04-billing-settings.png" });
  });

  test("PROD-5. Status filter works", async ({ page }) => {
    await page.goto(`${PROD}/dev/billing`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(4000);
    await page.locator("select").first().selectOption("active");
    await page.waitForTimeout(500);
    const rows = await page.locator("table tbody tr").count();
    expect(rows).toBeGreaterThan(0);
    await page.screenshot({ path: "e2e/screenshots/prod-05-filter.png" });
  });
});
