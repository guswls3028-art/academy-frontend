/**
 * E2E: 학생앱 도메인 탭 리팩토링 검증
 * 시험/성적/영상/저장소 — 홈|통계 탭 전환 + 렌더링 확인
 */
import { test, expect } from "../fixtures/strictTest";
import { getBaseUrl, loginViaUI } from "../helpers/auth";

const BASE = getBaseUrl("student");

async function assertDomainTabs(
  page: import("@playwright/test").Page,
  path: string,
  homeLabel: string,
  statsLabel: string,
) {
  await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

  const homeTab = page.getByRole("tab", { name: homeLabel });
  const statsTab = page.getByRole("tab", { name: statsLabel });
  await expect(homeTab).toBeVisible();
  await expect(statsTab).toBeVisible();

  await statsTab.click();
  await expect(page).toHaveURL(/tab=stats/);
  await expect(statsTab).toHaveAttribute("aria-selected", "true");

  await homeTab.click();
  await expect(page).not.toHaveURL(/tab=stats/);
  await expect(homeTab).toHaveAttribute("aria-selected", "true");
}

test.describe("학생 도메인 탭 리팩토링", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "student");
  });

  test("성적탭 — 홈/통계 탭 전환", async ({ page }) => {
    await assertDomainTabs(page, "/student/grades", "요약", "추이 분석");
  });

  test("시험탭 — 홈/통계 탭 전환", async ({ page }) => {
    await assertDomainTabs(page, "/student/exams", "시험지", "결과 분석");
  });

  test("영상탭 — 홈/통계 탭 전환", async ({ page }) => {
    await assertDomainTabs(page, "/student/video", "강의", "통계");
  });

  test("저장소탭 — 홈/통계 탭 전환", async ({ page }) => {
    await assertDomainTabs(page, "/student/inventory", "자료함", "용량 분석");
  });
});
