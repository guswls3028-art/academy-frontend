/**
 * E2E: 학생앱 도메인 탭 리팩토링 검증
 * 시험/성적/영상/저장소 — 홈|통계 탭 전환 + 렌더링 확인
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";

test.describe("학생 도메인 탭 리팩토링", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "student");
  });

  test("성적탭 — 홈/통계 탭 전환", async ({ page }) => {
    await page.goto("https://hakwonplus.com/student/grades", { waitUntil: "load" });
    // 홈 탭 활성 확인
    await expect(page.getByRole("tab", { name: "홈" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "통계" })).toBeVisible();
    // 통계 탭 클릭
    await page.getByRole("tab", { name: "통계" }).click();
    await page.waitForTimeout(500);
    // ?tab=stats searchParam 확인
    expect(page.url()).toContain("tab=stats");
    // 홈 탭 복귀
    await page.getByRole("tab", { name: "홈" }).click();
    await page.waitForTimeout(500);
    expect(page.url()).not.toContain("tab=stats");
  });

  test("시험탭 — 홈/통계 탭 전환", async ({ page }) => {
    await page.goto("https://hakwonplus.com/student/exams", { waitUntil: "load" });
    await expect(page.getByRole("tab", { name: "홈" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "통계" })).toBeVisible();
    await page.getByRole("tab", { name: "통계" }).click();
    await page.waitForTimeout(500);
    expect(page.url()).toContain("tab=stats");
  });

  test("영상탭 — 홈/통계 탭 전환", async ({ page }) => {
    await page.goto("https://hakwonplus.com/student/video", { waitUntil: "load" });
    await expect(page.getByRole("tab", { name: "홈" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "통계" })).toBeVisible();
    await page.getByRole("tab", { name: "통계" }).click();
    await page.waitForTimeout(500);
    expect(page.url()).toContain("tab=stats");
  });

  test("저장소탭 — 홈/통계 탭 전환", async ({ page }) => {
    await page.goto("https://hakwonplus.com/student/inventory", { waitUntil: "load" });
    await expect(page.getByRole("tab", { name: "홈" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "통계" })).toBeVisible();
    await page.getByRole("tab", { name: "통계" }).click();
    await page.waitForTimeout(500);
    expect(page.url()).toContain("tab=stats");
  });
});
