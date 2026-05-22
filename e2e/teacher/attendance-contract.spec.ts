/**
 * Teacher attendance shared-contract smoke.
 *
 * Verifies teacher attendance screens keep working after the attendance API
 * contract moved out of admin internals.
 */
import { test, expect } from "../fixtures/strictTest";
import { getBaseUrl, loginViaUI } from "../helpers/auth";
import { apiCall } from "../helpers/api";
import type { Page } from "@playwright/test";

const BASE = getBaseUrl("admin");

async function getFirstLectureSession(page: Page): Promise<{ lectureId: number; sessionId: number } | null> {
  const lecturesRes = await apiCall(page, "GET", "/lectures/lectures/?page_size=100");
  expect(lecturesRes.status).toBe(200);

  const lectures = (lecturesRes.body?.results ?? lecturesRes.body ?? []) as Array<{ id: number }>;
  for (const lecture of lectures) {
    const sessionsRes = await apiCall(page, "GET", `/lectures/sessions/?lecture=${lecture.id}&page_size=100`);
    if (sessionsRes.status !== 200) continue;
    const sessions = (sessionsRes.body?.results ?? sessionsRes.body ?? []) as Array<{ id: number }>;
    if (sessions.length > 0) return { lectureId: lecture.id, sessionId: sessions[0].id };
  }
  return null;
}

test.describe("teacher attendance contract", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.evaluate(() => {
      localStorage.removeItem("teacher:preferAdmin");
    });
  });

  test("출결 체크와 출석 매트릭스가 렌더링된다", async ({ page }) => {
    const session = await getFirstLectureSession(page);
    if (!session) {
      test.skip(true, "No lecture session exists for this tenant.");
      return;
    }

    await page.goto(`${BASE}/teacher/attendance/${session.sessionId}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await expect(page.getByRole("heading", { name: "출석 체크" })).toBeVisible({ timeout: 10_000 });
    const hasSummary = await page.getByText(/총 \d+명/).isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasSummary) {
      await expect(page.getByText("출석 데이터가 없습니다")).toBeVisible();
    }

    await page.goto(`${BASE}/teacher/classes/${session.lectureId}/attendance-matrix`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await expect(page.getByRole("heading", { name: "출석 현황" })).toBeVisible({ timeout: 10_000 });
  });
});
