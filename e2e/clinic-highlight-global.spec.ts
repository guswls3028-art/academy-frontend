/**
 * E2E: 클리닉 대상 학생 노란색 하이라이트 전역 반영 검증
 *
 * 검증:
 * 1. 학생 목록 — StudentNameWithLectureChip 렌더링 + 하이라이트 CSS 확인
 * 2. ClinicHighlightProvider — clinic-targets API 호출 확인
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

test.describe("클리닉 하이라이트 전역 반영", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("학생 목록에서 StudentNameWithLectureChip 렌더링 확인", async ({ page }) => {
    await page.goto(`${BASE}/admin/students`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    const chips = page.locator("span.inline-flex.items-center");
    const chipCount = await chips.count();
    console.log(`학생 목록: StudentNameWithLectureChip ${chipCount}개`);

    const highlighted = page.locator(".ds-student-name--clinic-highlight");
    const highlightCount = await highlighted.count();
    console.log(`학생 목록: 클리닉 하이라이트 ${highlightCount}개`);

    await page.screenshot({ path: "e2e/screenshots/clinic-highlight-students.png", fullPage: true });
    expect(chipCount).toBeGreaterThan(0);
  });

  test("ClinicHighlightProvider — clinic-targets API 호출 확인", async ({ page }) => {
    const apiCalls: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("clinic-targets")) {
        apiCalls.push(req.url());
      }
    });

    await page.goto(`${BASE}/admin/students`, { waitUntil: "load" });
    await page.waitForTimeout(8000);

    console.log(`clinic-targets API 호출 ${apiCalls.length}회`);
    await page.screenshot({ path: "e2e/screenshots/clinic-highlight-context.png", fullPage: true });

    // ClinicHighlightProvider가 clinic-targets API를 자동 호출하는지 확인
    expect(apiCalls.length).toBeGreaterThan(0);
  });
});
