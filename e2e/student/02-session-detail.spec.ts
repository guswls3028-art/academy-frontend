import { test, expect } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("student");

test.describe("학생 세션/영상/클리닉", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "student");
  });

  test("세션 목록 진입", async ({ page }) => {
    await page.goto(`${BASE}/student/sessions`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=Not Found")).not.toBeVisible();
    await expect(page.locator("[data-app='student'], main").first()).toBeVisible();
  });

  test("영상 홈 진입 — 빈 공개영상 카드 미노출", async ({ page }) => {
    await page.goto(`${BASE}/student/video`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=Not Found")).not.toBeVisible();
    const publicCard = page.locator("text=전체공개영상");
    const visible = await publicCard.isVisible({ timeout: 3000 }).catch(() => false);
    if (visible) {
      await expect(page.locator("text=0개 영상")).not.toBeVisible();
    }
  });

  test("클리닉 화면 진입", async ({ page }) => {
    await page.goto(`${BASE}/student/clinic`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=Not Found")).not.toBeVisible();
    await expect(page.locator("[data-app='student']").first()).toBeVisible();
  });
});
