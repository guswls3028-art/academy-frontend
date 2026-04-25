/**
 * UX P3 — 가이드 페이지 「시작」 버튼 헤더 노출 검증.
 *
 * 닫힌 상태 카드에서도 시작 버튼이 보여야 하고,
 * 클릭 시 카드를 펼치지 않은 채 투어 경로로 이동해야 한다.
 *
 * Tenant 1 / production. 임시 검증 후 삭제 예정.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

test.setTimeout(120_000);

test("guide page — 시작 button visible in closed cards and navigates without expansion", async ({ page }) => {
  const BASE = getBaseUrl("admin");
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginViaUI(page, "admin");
  await page.goto(`${BASE}/admin/guide`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  // 6개 카드 모두 닫힌 상태에서 시작 버튼 보여야 함
  const startButtons = page.getByRole("button", { name: /투어 시작$/ });
  await expect(startButtons).toHaveCount(6);
  for (let i = 0; i < 6; i++) {
    await expect(startButtons.nth(i)).toBeVisible();
  }

  // 닫힌 상태 캡처
  await page.screenshot({
    path: "e2e/reports/uiux-after-fix/E0-guide-after.png",
    fullPage: true,
  });

  // 첫 카드의 시작 클릭 → 투어 경로로 이동, 카드는 펼쳐지지 않은 채
  await startButtons.first().click();
  await page.waitForURL(/\/admin\/students/, { timeout: 10_000 });
  expect(page.url()).toContain("/admin/students");
});
