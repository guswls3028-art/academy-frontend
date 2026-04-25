/**
 * UX P3 — 가이드 페이지 「시작」 버튼 헤더 노출 검증.
 *
 * 검증:
 *  1) 닫힌 6 카드 모두 헤더 시작 버튼 노출 (desktop)
 *  2) 시작 클릭 → 카드 펼침 안 됨 + 투어 경로 이동
 *  3) 모바일 viewport (375x812) 에서 헤더 레이아웃 깨지지 않음
 *
 * Tenant 1 / production. 임시 검증 후 삭제 예정.
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

test("guide page — 시작 button (mobile 375px) — visible, no overflow", async ({ page }) => {
  const BASE = getBaseUrl("admin");
  await page.setViewportSize({ width: 375, height: 812 });
  await loginViaUI(page, "admin");
  await page.goto(`${BASE}/admin/guide`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  const startButtons = page.locator('button[aria-label$="투어 시작"]');
  await expect(startButtons).toHaveCount(6);
  // 첫 카드의 시작 버튼이 viewport 안에 들어와야 한다
  const box = await startButtons.first().boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    expect(box.height).toBeGreaterThan(0);
  }

  await page.screenshot({
    path: "e2e/reports/uiux-after-fix/E0-guide-after-mobile.png",
    fullPage: true,
  });
});
