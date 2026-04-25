/**
 * UX P3 회귀 가드 — 가이드 페이지 헤더 「시작」 버튼.
 *
 *  1) 닫힌 6 카드 모두 헤더 시작 버튼 노출 (desktop 1440)
 *  2) 시작 클릭 → 카드 펼침 안 됨 + 투어 경로 이동
 *  3) 좁은 데스크톱(1024) 에서 헤더 overflow 없음
 *
 * Tenant 1 / production.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

test.setTimeout(180_000);

test("guide page — 시작 button header (desktop) — visible, isolated, navigates", async ({ page }) => {
  const BASE = getBaseUrl("admin");
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginViaUI(page, "admin");
  await page.goto(`${BASE}/admin/guide`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  // HTML <button> 태그만 (외부 div role=button 은 aria-label 분리됨)
  const startButtons = page.locator('button[aria-label$="투어 시작"]');
  await expect(startButtons).toHaveCount(6);
  for (let i = 0; i < 6; i++) {
    await expect(startButtons.nth(i)).toBeVisible();
  }

  await page.screenshot({
    path: "e2e/reports/uiux-after-fix/E0-guide-after-desktop.png",
    fullPage: true,
  });

  // 첫 카드의 헤더(div role=button) 가 닫혀있는지 확인
  const firstHeader = page.getByRole("button", { name: /^학생 등록하기 카드 펼치기$/ });
  await expect(firstHeader).toHaveAttribute("aria-expanded", "false");

  // 시작 클릭 → 투어 경로 이동
  await startButtons.first().click();
  await page.waitForURL(/\/admin\/students/, { timeout: 10_000 });
  expect(page.url()).toContain("/admin/students");
});

// 가이드 페이지는 데스크톱 전용 (375px 는 모바일 선생앱으로 라우팅).
// 좁은 데스크톱(1024px) 에서 헤더가 깨지지 않는지만 확인.
test("guide page — 시작 button (narrow desktop 1024px) — no overflow", async ({ page }) => {
  const BASE = getBaseUrl("admin");
  await page.setViewportSize({ width: 1024, height: 768 });
  await loginViaUI(page, "admin");
  await page.goto(`${BASE}/admin/guide`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  const startButtons = page.locator('button[aria-label$="투어 시작"]');
  await expect(startButtons).toHaveCount(6);

  const box = await startButtons.first().boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    expect(box.x + box.width).toBeLessThanOrEqual(1024);
    expect(box.height).toBeGreaterThan(0);
  }

  await page.screenshot({
    path: "e2e/reports/uiux-after-fix/E0-guide-after-narrow.png",
    fullPage: true,
  });
});
