/**
 * 학생 대시보드 다크 모드 — 운영 시각 검증.
 * localStorage에 다크 모드 prefer 주입 후 진입.
 */
import { test, expect } from "../fixtures/strictTest";
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
    await page.goto(`${(process.env.E2E_BASE_URL || "https://hakwonplus.com").replace(/\/$/, "")}/student/dashboard`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {});

    /* data-student-dark 속성 확인 */
    const isDark = await page.evaluate(() => {
      return document.querySelector("[data-app='student']")?.getAttribute("data-student-dark") === "true";
    });
    expect(isDark).toBe(true);

    await expect(page.getByRole("heading", { name: "오늘", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "학습 현황", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^전체 메뉴/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /QR 출석/ })).toBeVisible();
    await page.getByRole("button", { name: "학생 사용 가이드", exact: true }).click();
    await page.getByRole("button", { name: "프로필에서 내 정보와 설정 찾기" }).click();
    await expect(page.getByRole("dialog").getByRole("img")).toBeVisible();
    await page.getByRole("button", { name: "가이드 닫기" }).click();
    await page.getByRole("button", { name: "프로필 메뉴", exact: true }).click();
    await expect(page.getByRole("button", { name: "내 정보", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "프로필 메뉴", exact: true }).click();
    await expect(page.getByRole("tablist", { name: "자녀 선택" })).toHaveCount(0);

    await page.screenshot({ path: "e2e/screenshots/dashboard-dark.png", fullPage: true });

    const fatal = errors.filter((e) =>
      !/Failed to load resource/i.test(e) && !/favicon/i.test(e),
    );
    expect(fatal, `unexpected runtime errors:\n${fatal.join("\n")}`).toEqual([]);
  });
});
