import { test, expect } from "@playwright/test";

const API_BASE = process.env.API_BASE_URL || "https://api.hakwonplus.com";
const APP_BASE = process.env.HAKWONPLUS_BASE_URL || "https://hakwonplus.com";

test.describe("Post-deploy smoke tests", () => {
  test("API health check", async ({ request }) => {
    const resp = await request.get(`${API_BASE}/healthz`);
    expect(resp.status()).toBe(200);
  });

  test("Student app loads", async ({ page }) => {
    await page.goto(`${APP_BASE}/student`);
    await expect(page).toHaveURL(/login|student/);
  });

  test("Admin app loads", async ({ page }) => {
    await page.goto(`${APP_BASE}/admin`);
    await expect(page).toHaveURL(/login|admin/);
  });
});
