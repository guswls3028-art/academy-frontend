/**
 * 학생 대시보드 다크 모드 — 운영 시각 검증.
 * localStorage에 다크 모드 prefer 주입 후 진입.
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

const STORAGE_KEY = "hakwonplus:student-theme-mode";

test.describe("학생 대시보드 다크 모드", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("다크 모드에서 새 레이아웃 렌더 + 스크린샷", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
    });

    await loginViaUI(page, "student");
    await page.evaluate((key) => localStorage.setItem(key, "dark"), STORAGE_KEY);
    await page.goto("https://hakwonplus.com/student/dashboard", { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {});

    /* data-student-dark 속성 확인 */
    const isDark = await page.evaluate(() => {
      return document.querySelector("[data-app='student']")?.getAttribute("data-student-dark") === "true";
    });
    expect(isDark).toBe(true);

    /* 핵심 섹션 가시성 — 다크 모드에서도 텍스트 보여야 함 */
    await expect(page.getByText("오늘 할 일", { exact: true })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText("나의 학습 현황", { exact: true })).toBeVisible();
    for (const label of ["성적", "시험", "과제", "클리닉", "출결", "공지", "보관함", "내 정보"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }

    await page.screenshot({ path: "e2e/screenshots/dashboard-dark.png", fullPage: true });

    const fatal = errors.filter((e) =>
      !/Failed to load resource/i.test(e) && !/favicon/i.test(e),
    );
    expect(fatal, `unexpected runtime errors:\n${fatal.join("\n")}`).toEqual([]);
  });
});
