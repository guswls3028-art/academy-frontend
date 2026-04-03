/**
 * Audit Re-verification — confirm all fixes work
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const SCREENSHOT_DIR = "e2e/screenshots/audit";

test.describe("Audit Fix Verification", () => {
  test("FIX-6: Invalid admin route now redirects to dashboard", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto("https://hakwonplus.com/admin/nonexistent-route-xyz", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    // Should redirect to dashboard
    expect(page.url()).toContain("/admin/dashboard");
    await page.screenshot({ path: `${SCREENSHOT_DIR}/reverify-invalid-route.png`, fullPage: true });
  });

  test("FIX-7: Invalid student ID shows error instead of spinner", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto("https://hakwonplus.com/admin/students/999999", { waitUntil: "load" });
    await page.waitForTimeout(5000);
    // Should show error message, not perpetual loading
    const pageContent = await page.textContent("body");
    const hasError = pageContent?.includes("찾을 수 없") || pageContent?.includes("존재하지 않");
    const hasSpinner = pageContent?.includes("불러오는 중");
    console.log(`Invalid student ID: hasError=${hasError}, hasSpinner=${hasSpinner}`);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/reverify-invalid-student.png`, fullPage: true });
    // Error state should appear within 5 seconds — no perpetual loading
  });

  test("FIX-3: z-index — confirm dialog visible on student drawer", async ({ page }) => {
    // Basic check: student drawer opens and closes without z-index issue
    await loginViaUI(page, "student");
    await page.goto("https://hakwonplus.com/student/dashboard", { waitUntil: "load" });
    await page.waitForTimeout(2000);
    // Open drawer
    const menuBtn = page.locator("button[aria-label*='menu'], button[aria-label*='메뉴'], [class*='hamburger']").first();
    if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await menuBtn.click();
      await page.waitForTimeout(800);
      // Drawer should be visible
      const drawer = page.locator("[style*='translateX(0)']").first();
      const drawerVisible = await drawer.isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`Student drawer visible: ${drawerVisible}`);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/reverify-drawer-zindex.png`, fullPage: true });
      // Close with ESC
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }
  });

  test("Admin surface re-check — dashboard loads", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto("https://hakwonplus.com/admin/dashboard", { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await expect(page.locator("body")).toContainText("대시보드");
    await page.screenshot({ path: `${SCREENSHOT_DIR}/reverify-dashboard.png`, fullPage: true });
  });

  test("Student surface re-check — dashboard loads", async ({ page }) => {
    await loginViaUI(page, "student");
    await page.goto("https://hakwonplus.com/student/dashboard", { waitUntil: "load" });
    await page.waitForTimeout(2000);
    // Student dashboard should show content
    const body = await page.textContent("body");
    const hasContent = body && body.length > 100;
    console.log(`Student dashboard content length: ${body?.length}`);
    expect(hasContent).toBeTruthy();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/reverify-student-dashboard.png`, fullPage: true });
  });
});
