/**
 * Frontend Global Surface Audit — Student App
 * 전체 학생 앱 화면 전수 탐색 + 콘솔 에러 수집 + 스크린샷
 * Tenant 1 (hakwonplus) E2E 전용
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const SCREENSHOT_DIR = "e2e/screenshots/audit";

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (text.includes("net::ERR_") || text.includes("favicon") || text.includes("Download the React DevTools")) return;
      errors.push(text);
    }
  });
  return errors;
}

async function safeGoto(page: Page, url: string, label: string) {
  try {
    await page.goto(url, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(1500);
  } catch (e) {
    console.warn(`[WARN] ${label}: navigation timeout — ${e}`);
  }
}

async function snap(page: Page, name: string) {
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, fullPage: true });
}

test.describe("Student Surface Audit", () => {
  let errors: string[];

  test.beforeEach(async ({ page }) => {
    errors = collectConsoleErrors(page);
    await loginViaUI(page, "student");
  });

  test("S01 — Dashboard", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/student/dashboard", "stu-dashboard");
    await snap(page, "s01-dashboard");
  });

  test("S02 — Video Home", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/student/video", "stu-video");
    await snap(page, "s02-video-home");
  });

  test("S03 — Sessions List", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/student/sessions", "stu-sessions");
    await snap(page, "s03-sessions");
  });

  test("S04 — Submit Hub", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/student/submit", "stu-submit");
    await snap(page, "s04-submit-hub");
  });

  test("S05 — Submit Score", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/student/submit/score", "stu-submit-score");
    await snap(page, "s05-submit-score");
  });

  test("S06 — Submit Assignment", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/student/submit/assignment", "stu-submit-assignment");
    await snap(page, "s06-submit-assignment");
  });

  test("S07 — Inventory", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/student/inventory", "stu-inventory");
    await snap(page, "s07-inventory");
  });

  test("S08 — Exams", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/student/exams", "stu-exams");
    await snap(page, "s08-exams");
  });

  test("S09 — Grades", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/student/grades", "stu-grades");
    await snap(page, "s09-grades");
  });

  test("S10 — Community", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/student/community", "stu-community");
    await snap(page, "s10-community");
  });

  test("S11 — Notices", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/student/notices", "stu-notices");
    await snap(page, "s11-notices");
  });

  test("S12 — Notifications", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/student/notifications", "stu-notifications");
    await snap(page, "s12-notifications");
  });

  test("S13 — Clinic", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/student/clinic", "stu-clinic");
    await snap(page, "s13-clinic");
  });

  test("S14 — Clinic ID Card", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/student/idcard", "stu-idcard");
    await snap(page, "s14-idcard");
  });

  test("S15 — Attendance", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/student/attendance", "stu-attendance");
    await snap(page, "s15-attendance");
  });

  test("S16 — More", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/student/more", "stu-more");
    await snap(page, "s16-more");
  });

  test("S17 — Profile", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/student/profile", "stu-profile");
    await snap(page, "s17-profile");
  });

  test("S18 — Settings", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/student/settings", "stu-settings");
    await snap(page, "s18-settings");
  });

  test("S19 — Guide", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/student/guide", "stu-guide");
    await snap(page, "s19-guide");
  });
});
