import { test, expect } from "@playwright/test";

const LOCAL = "http://localhost:5175";
const API = "https://api.hakwonplus.com";

test("debug local modal crash", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`PAGE_ERROR: ${err.stack || err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`CONSOLE_ERROR: ${msg.text()}`);
  });

  // Login via API
  const resp = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: "admin97", password: "koreaseoul97", tenant_code: "hakwonplus" },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
  });
  const tokens = await resp.json() as { access: string; refresh: string };

  await page.goto(`${LOCAL}/login`, { waitUntil: "commit" });
  await page.evaluate(({ access, refresh }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    try { sessionStorage.setItem("tenantCode", "hakwonplus"); } catch {}
  }, tokens);

  await page.goto(`${LOCAL}/admin/students`, { waitUntil: "load" });
  await page.waitForTimeout(3000);

  // Select student
  const cb = page.locator("table tbody tr").first().locator('input[type="checkbox"]');
  if (await cb.isVisible({ timeout: 5000 }).catch(() => false)) {
    await cb.check();
    await page.waitForTimeout(500);
  }

  // Open modal
  const btn = page.locator("button").filter({ hasText: /메시지 발송/ }).first();
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(3000);
  }

  console.log("=== ERRORS (unminified!) ===");
  for (const e of errors) console.log(e);
  console.log(`=== TOTAL: ${errors.length} errors ===`);

  await page.screenshot({ path: "e2e/screenshots/debug-local-modal.png" });
});
