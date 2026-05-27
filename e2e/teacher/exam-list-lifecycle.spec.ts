/**
 * E2E: 선생앱 시험/과제 목록 lifecycle 회귀
 *
 * 시험/과제 전체 status(진행/마감/설정중)는 업무 상태가 아니다.
 * 이 화면은 차시에 살아있는 운영 평가만 보여주고 status 뱃지를 노출하지 않는다.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("admin");

async function assertNoAssessmentStatusLabels(page: import("@playwright/test").Page) {
  for (const label of ["진행", "마감", "설정 중"] as const) {
    await expect(page.getByText(label, { exact: true })).toHaveCount(0);
  }
}

test.describe("선생앱 시험/과제 목록 — status UI 폐기", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.evaluate(() => {
      try { localStorage.removeItem("teacher:preferAdmin"); } catch { /* ignore */ }
    });
  });

  test("시험 탭은 status 뱃지 없이 운영 시험 목록만 렌더링한다", async ({ page }) => {
    await page.goto(`${BASE}/teacher/exams`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    await expect(page.getByRole("heading", { name: /시험\s*\/\s*과제/ })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("tab", { name: /^시험$/, exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /시험 추가|과제 추가/ })).toHaveCount(0);
    await assertNoAssessmentStatusLabels(page);

    const rawStatusBadgeCount = await page.locator("span.ds-status-badge").count();
    expect(rawStatusBadgeCount, "raw .ds-status-badge span 사용 0").toBe(0);
  });

  test("과제 탭도 status 뱃지 없이 렌더링한다", async ({ page }) => {
    await page.goto(`${BASE}/teacher/exams`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const homeworkTab = page.getByRole("tab", { name: /^과제$/, exact: true });
    await expect(homeworkTab).toBeVisible({ timeout: 10_000 });
    await homeworkTab.click();
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});

    await expect(page.getByRole("button", { name: /시험 추가|과제 추가/ })).toHaveCount(0);
    await assertNoAssessmentStatusLabels(page);
  });
});
