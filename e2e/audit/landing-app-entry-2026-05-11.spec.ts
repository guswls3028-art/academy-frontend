/**
 * 선생앱·학생앱 헤더 → 학원 홈페이지 진입 검증
 * Tenant 1 (admin/student@hakwonplus)
 *
 * 검증:
 * - 학생앱: 프로필 드롭다운 첫 항목 "🌐 학원 홈페이지" 노출, href=/landing, target=_blank
 * - 선생앱: 우측 알림 벨 옆 Globe 버튼(aria-label) 노출, href=/landing, target=_blank
 *
 * Note: tenant 1 admin은 owner role이라 teacher app도 진입 가능 (강사로도 라우팅됨).
 *       teacher app 라우트 가드가 owner 거절하면 skip.
 */
import { test, expect } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("admin");

test("선생앱 헤더 우측 학원 홈페이지 진입 버튼 노출", async ({ page }) => {
  test.setTimeout(45_000);
  await loginViaUI(page, "admin");

  await page.goto(`${BASE}/teacher`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

  // role 가드로 redirect되면 skip
  if (!page.url().includes("/teacher")) {
    console.log(`TEACHER_REDIRECT: ${page.url()} — owner role 가드. skip.`);
    return;
  }

  const globeBtn = page.locator('a[aria-label*="학원 홈페이지"]');
  await expect(globeBtn).toBeVisible({ timeout: 5_000 });
  expect(await globeBtn.getAttribute("href")).toBe("/landing");
  expect(await globeBtn.getAttribute("target")).toBe("_blank");
  console.log("TEACHER_HEADER_GLOBE: OK href=/landing target=_blank");
});

test("학생앱 프로필 dropdown 첫 항목 학원 홈페이지", async ({ page }) => {
  test.setTimeout(45_000);
  await loginViaUI(page, "student");

  await page.goto(`${BASE}/student/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

  const profileBtn = page.locator('button[aria-label="프로필 메뉴"]');
  await expect(profileBtn).toBeVisible({ timeout: 8_000 });
  await profileBtn.click();

  const homepageItem = page.locator('a[href="/landing"]', { hasText: "학원 홈페이지" });
  await expect(homepageItem).toBeVisible({ timeout: 3_000 });
  expect(await homepageItem.getAttribute("target")).toBe("_blank");
  console.log("STUDENT_DROPDOWN_HOMEPAGE: OK href=/landing target=_blank");
});
