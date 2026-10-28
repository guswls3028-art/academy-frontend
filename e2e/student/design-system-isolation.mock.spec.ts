import { test, expect } from "../fixtures/strictTest";
import { installStudentYoutubeScenario } from "../helpers/studentYoutubeScenario";
const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5187";

for (const width of [390, 1366]) {
  for (const dark of [false, true]) {
    test("학생 " + width + "px " + (dark ? "다크" : "라이트") + "는 교사 테마와 독립적이고 기존 이동을 유지한다", async ({ page }, info) => {
      test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "격리된 로컬 검증 전용");
      await page.setViewportSize({ width, height: 900 });
      await installStudentYoutubeScenario(page);
      await page.addInitScript((dark) => {
        localStorage.setItem("hakwonplus:appearance", JSON.stringify({ version: 1, theme: "focus-dark", accent: "#ffff00" }));
        localStorage.setItem("hakwonplus:student-theme-mode", dark ? "dark" : "light");
      }, dark);
      await page.route("**/api/v1/clinic/participants/**", (route) => route.fulfill({ json: { count: 0, next: null, results: [] } }));
      await page.route("**/api/v1/community/**", (route) => route.fulfill({ json: { count: 0, next: null, results: [] } }));
      await page.route("**/api/v1/student/me/", (route) => route.fulfill({ json: { id: 1772, name: "예시 학생", username: "qa-student" } }));
      await page.route("**/api/v1/student/dashboard/", (route) => route.fulfill({ json: {
        notices: [{ id: 12, title: "다음 수업 준비물을 확인해 주세요", created_at: "2026-10-28T00:00:00Z" }],
        today_sessions: [], badges: {}, tenant_info: { name: "예시 학원", phone: "", headquarters_phone: "" },
      } }));
      await page.goto(BASE + "/student/dashboard");
      const app = page.locator('[data-app="student"]');
      await expect(app).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "focus-dark");
      if (dark) {
        await expect(app).toHaveAttribute("data-student-dark", "true");
        await expect(page.locator("html")).toHaveAttribute("data-student-dark", "true");
      } else await expect(app).not.toHaveAttribute("data-student-dark", "true");
      const color = await app.evaluate((element) => getComputedStyle(element).backgroundColor);
      const channels = color.match(/\d+/g)?.map(Number) ?? [];
      expect(channels).toHaveLength(3);
      expect(channels[0]).toBeGreaterThanOrEqual(dark ? 0 : 230);
      expect(channels[0]).toBeLessThanOrEqual(dark ? 40 : 255);
      await expect(page.locator(".stu-tabbar a")).toHaveCount(5);
      const names = await page.locator(".stu-tabbar a").allTextContents();
      expect(names.map((name) => name.trim())).toEqual(["홈", "영상", "일정", "알림", "커뮤니티"]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect(page.getByRole("heading", { name: "오늘은 급한 일이 없어요", exact: true })).toBeVisible();
      await page.screenshot({ path: info.outputPath("student-" + width + "-" + dark + ".png"), fullPage: true });
      await page.locator('a[href="/student/sessions"]:visible').first().click();
      await expect(page).toHaveURL(/\/student\/sessions/);
      await page.reload();
      await expect(app).toBeVisible();
      const current = await app.evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(current).toBe(color);
      await page.locator('a[href="/student/dashboard"]:visible').first().click();
      await expect(page.getByRole("heading").first()).toBeVisible();
    });
  }
}
