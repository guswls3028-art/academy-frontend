// E2E: 클리닉 대상자 도구 — 페이지 로드 + 데이터 파싱 + 스케줄 편집 + PDF 다운로드
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const SAMPLE_DATA = `국태민
현장
35점
진행중
90%
완료
0%
진행중
김동욱
현장
45점
진행중
0%
진행중
100%
완료
나영린
현장
80점
완료
100%
완료
0%
진행중
최태준
현장
-
-
0%
진행중
0%
진행중`;

test.describe("클리닉 대상자 도구", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto("https://hakwonplus.com/admin/tools/clinic", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    if (!(await page.frameLocator("#cprev").locator(".page").isVisible({ timeout: 3000 }).catch(() => false))) {
      await page.reload({ waitUntil: "load" });
      await page.waitForTimeout(3000);
    }
    await expect(page.frameLocator("#cprev").locator(".page")).toBeVisible({ timeout: 8000 });
  });

  test("페이지 로드 및 UI 구조 확인", async ({ page }) => {
    const iframe = page.frameLocator("#cprev");
    await expect(iframe.locator(".header .badge")).toHaveText("CLINIC");
    await expect(iframe.locator("h1")).toHaveText("클리닉 대상자 안내");
    await expect(iframe.locator(".section-header.both")).toContainText("시험+과제 미통과");
    await expect(iframe.locator(".section-header.exam")).toContainText("시험 미통과");
    await expect(iframe.locator(".section-header.hw")).toContainText("과제 미통과");
    await expect(iframe.locator(".schedule-title")).toHaveText("클리닉 일정");
    await expect(page.locator("#clinic-paste-ta")).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/clinic-tool-loaded.png" });
  });

  test("데이터 붙여넣기 → 파싱 → 미리보기 채워짐", async ({ page }) => {
    await page.locator("#clinic-paste-ta").fill(SAMPLE_DATA);
    await page.locator("button").filter({ hasText: /^생성$/ }).first().click();
    await page.waitForTimeout(2000);

    const iframe = page.frameLocator("#cprev");
    // 시험+과제: 국태민, 김동욱 (exam진행중 + hw진행중)
    await expect(iframe.locator(".section-header.both")).not.toContainText("(0명)");
    // 과제: 나영린, 최태준
    await expect(iframe.locator(".section-header.hw")).not.toContainText("(0명)");
    await page.screenshot({ path: "e2e/screenshots/clinic-tool-parsed.png" });
  });

  test("스케줄 편집 (줄바꿈 포함)", async ({ page }) => {
    const iframe = page.frameLocator("#cprev");
    const scheduleEl = iframe.locator('[data-field="schedule"]');
    await scheduleEl.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("3/30(일) 14:00~16:00");
    await page.keyboard.press("Enter");
    await page.keyboard.type("4/1(화) 18:00~20:00");
    await page.waitForTimeout(500);

    const text = await scheduleEl.innerHTML();
    expect(text).toContain("3/30");
    expect(text).toContain("4/1");
    await page.screenshot({ path: "e2e/screenshots/clinic-tool-schedule.png" });
  });

  test("PDF 다운로드", async ({ page }) => {
    await page.locator("#clinic-paste-ta").fill(SAMPLE_DATA);
    await page.locator("button").filter({ hasText: /^생성$/ }).first().click();
    await page.waitForTimeout(2000);

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30000 }),
      page.locator("button").filter({ hasText: "PDF 다운로드" }).first().click(),
    ]);
    expect(download.suggestedFilename()).toContain("클리닉대상자");
    await page.screenshot({ path: "e2e/screenshots/clinic-tool-pdf.png" });
  });
});
