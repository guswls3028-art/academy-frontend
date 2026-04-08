/**
 * E2E: 수납 관리 (Fees) smoke test
 * - 관리자: 비목 생성 → 청구서 탭 → 대시보드 탭
 * - 학생: /student/fees 접근
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test.describe("Fees Management", () => {
  test("Admin can navigate to fees page and see 3 tabs", async ({ page }) => {
    await loginViaUI(page, "admin");

    // Navigate to fees via sidebar
    await page.goto("https://hakwonplus.com/admin/fees", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // Check page title
    await expect(page.locator("text=수납 관리")).toBeVisible({ timeout: 10000 });

    // Check tabs exist
    await expect(page.locator(".ds-tab").filter({ hasText: "수납 현황" })).toBeVisible();
    await expect(page.locator(".ds-tab").filter({ hasText: "청구서" })).toBeVisible();
    await expect(page.locator(".ds-tab").filter({ hasText: "비목 관리" })).toBeVisible();

    // Dashboard tab should be active by default
    // KPI cards should be visible
    await expect(page.locator(".ds-kpi").first()).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "e2e/screenshots/fees-dashboard.png" });
  });

  test("Admin can navigate to templates tab and create a fee template", async ({ page }) => {
    await loginViaUI(page, "admin");

    // Go to templates tab
    await page.goto("https://hakwonplus.com/admin/fees/templates", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // Check "비목 추가" button exists
    const addBtn = page.locator("button").filter({ hasText: "비목 추가" });
    await expect(addBtn).toBeVisible({ timeout: 10000 });

    // Click add button
    await addBtn.click();
    await page.waitForTimeout(500);

    // Modal should open
    await expect(page.locator("text=비목 추가").first()).toBeVisible();

    // Fill form
    await page.locator('input.ds-input').first().fill("[E2E-smoke] Test Fee");
    // Amount field
    const amountInput = page.locator('input[type="number"].ds-input');
    await amountInput.fill("150000");

    // Save
    const saveBtn = page.locator("button").filter({ hasText: /추가$/ }).last();
    await saveBtn.click();
    await page.waitForTimeout(2000);

    // Verify the new template appears in the table
    await expect(page.locator("text=[E2E-smoke] Test Fee")).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "e2e/screenshots/fees-template-created.png" });

    // Cleanup - deactivate the test template
    const deactivateBtn = page.locator("tr").filter({ hasText: "[E2E-smoke] Test Fee" }).locator("button").filter({ hasText: "비활성" });
    if (await deactivateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      page.on("dialog", (d) => d.accept());
      await deactivateBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  test("Admin can navigate to invoices tab and see filters", async ({ page }) => {
    await loginViaUI(page, "admin");

    await page.goto("https://hakwonplus.com/admin/fees/invoices", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // Filters should be visible
    await expect(page.locator("select.ds-select").first()).toBeVisible({ timeout: 10000 });

    // "월 청구서 생성" button
    await expect(page.locator("button").filter({ hasText: "월 청구서 생성" })).toBeVisible();

    // Check filter dropdowns count (month, status, fee_type, lecture + search input)
    const selects = page.locator("select.ds-select");
    await expect(selects).toHaveCount(4, { timeout: 5000 });

    await page.screenshot({ path: "e2e/screenshots/fees-invoices-filters.png" });
  });

  test("Student can access /student/fees", async ({ page }) => {
    await loginViaUI(page, "student");

    await page.goto("https://hakwonplus.com/student/fees", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // Title should be visible
    await expect(page.locator("text=수납/결제")).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "e2e/screenshots/student-fees.png" });
  });
});
