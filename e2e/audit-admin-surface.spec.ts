/**
 * Frontend Global Surface Audit — Admin App
 * 전체 관리자 앱 화면 전수 탐색 + 콘솔 에러 수집 + 스크린샷
 * Tenant 1 (hakwonplus) E2E 전용
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const SCREENSHOT_DIR = "e2e/screenshots/audit";

/** 콘솔 에러 수집기 */
function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // React devtools, extension noise 제외
      if (text.includes("net::ERR_") || text.includes("favicon") || text.includes("Download the React DevTools")) return;
      errors.push(text);
    }
  });
  return errors;
}

/** 안전한 네비게이션 + 대기 */
async function safeGoto(page: Page, url: string, label: string) {
  try {
    await page.goto(url, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(1500);
  } catch (e) {
    console.warn(`[WARN] ${label}: navigation timeout — ${e}`);
  }
}

/** 스크린샷 저장 */
async function snap(page: Page, name: string) {
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, fullPage: true });
}

test.describe("Admin Surface Audit", () => {
  let errors: string[];

  test.beforeEach(async ({ page }) => {
    errors = collectConsoleErrors(page);
    await loginViaUI(page, "admin");
  });

  test("01 — Dashboard", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/dashboard", "dashboard");
    await snap(page, "01-dashboard");
    // 핵심 요소 존재 확인
    await expect(page.locator("body")).not.toContainText("에러");
    expect(errors.filter(e => !e.includes("Warning"))).toHaveLength(0);
  });

  test("02 — Students Home", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/students", "students");
    await page.waitForTimeout(2000);
    await snap(page, "02-students-home");
    // 학생 목록 테이블 존재 확인
    const table = page.locator("table, [class*='student']");
    await expect(table.first()).toBeVisible({ timeout: 10000 });
  });

  test("03 — Students Detail Overlay", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/students", "students");
    await page.waitForTimeout(2000);
    // 첫 번째 학생 클릭
    const firstRow = page.locator("table tbody tr, [class*='student-row'], [class*='list-item']").first();
    if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(2000);
      await snap(page, "03-student-detail");
    }
  });

  test("04 — Lectures (current)", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/lectures", "lectures");
    await page.waitForTimeout(2000);
    await snap(page, "04-lectures");
  });

  test("05 — Lectures (past)", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/lectures/past", "lectures-past");
    await page.waitForTimeout(2000);
    await snap(page, "05-lectures-past");
  });

  test("06 — Lecture Detail → Session", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/lectures", "lectures");
    await page.waitForTimeout(2000);
    // 첫 번째 수업 클릭
    const lectureLink = page.locator("a[href*='/admin/lectures/']").first();
    if (await lectureLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await lectureLink.click();
      await page.waitForTimeout(2000);
      await snap(page, "06-lecture-detail");
      // 차시 탭 이동
      const sessionsTab = page.locator("a, button").filter({ hasText: "차시" }).first();
      if (await sessionsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sessionsTab.click();
        await page.waitForTimeout(1500);
        await snap(page, "06-lecture-sessions");
      }
    }
  });

  test("07 — Exams", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/exams", "exams");
    await page.waitForTimeout(2000);
    await snap(page, "07-exams");
  });

  test("08 — Exam Templates", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/exams/templates", "exam-templates");
    await page.waitForTimeout(2000);
    await snap(page, "08-exam-templates");
  });

  test("09 — Results Explorer", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/results", "results");
    await page.waitForTimeout(2000);
    await snap(page, "09-results");
  });

  test("10 — Submissions Inbox", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/results/submissions", "submissions");
    await page.waitForTimeout(2000);
    await snap(page, "10-submissions");
  });

  test("11 — Videos Explorer", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/videos", "videos");
    await page.waitForTimeout(2000);
    await snap(page, "11-videos");
  });

  test("12 — Clinic Home", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/clinic", "clinic");
    await page.waitForTimeout(2000);
    await snap(page, "12-clinic-home");
  });

  test("13 — Clinic Operations", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/clinic/operations", "clinic-ops");
    await page.waitForTimeout(2000);
    await snap(page, "13-clinic-ops");
  });

  test("14 — Clinic Bookings", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/clinic/bookings", "clinic-bookings");
    await page.waitForTimeout(2000);
    await snap(page, "14-clinic-bookings");
  });

  test("15 — Clinic Reports", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/clinic/reports", "clinic-reports");
    await page.waitForTimeout(2000);
    await snap(page, "15-clinic-reports");
  });

  test("16 — Clinic Settings", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/clinic/settings", "clinic-settings");
    await page.waitForTimeout(2000);
    await snap(page, "16-clinic-settings");
  });

  test("17 — Messages Templates", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/message/templates", "msg-templates");
    await page.waitForTimeout(2000);
    await snap(page, "17-msg-templates");
  });

  test("18 — Messages Auto-Send", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/message/auto-send", "msg-autosend");
    await page.waitForTimeout(2000);
    await snap(page, "18-msg-autosend");
  });

  test("19 — Messages Log", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/message/log", "msg-log");
    await page.waitForTimeout(2000);
    await snap(page, "19-msg-log");
  });

  test("20 — Messages Settings", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/message/settings", "msg-settings");
    await page.waitForTimeout(2000);
    await snap(page, "20-msg-settings");
  });

  test("21 — Community Board", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/community/board", "community-board");
    await page.waitForTimeout(2000);
    await snap(page, "21-community-board");
  });

  test("22 — Community Notice", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/community/notice", "community-notice");
    await page.waitForTimeout(2000);
    await snap(page, "22-community-notice");
  });

  test("23 — Community QnA", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/community/qna", "community-qna");
    await page.waitForTimeout(2000);
    await snap(page, "23-community-qna");
  });

  test("24 — Community Counsel", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/community/counsel", "community-counsel");
    await page.waitForTimeout(2000);
    await snap(page, "24-community-counsel");
  });

  test("25 — Community Materials", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/community/materials", "community-materials");
    await page.waitForTimeout(2000);
    await snap(page, "25-community-materials");
  });

  test("26 — Community Settings", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/community/settings", "community-settings");
    await page.waitForTimeout(2000);
    await snap(page, "26-community-settings");
  });

  test("27 — Staff Home", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/staff", "staff");
    await page.waitForTimeout(2000);
    await snap(page, "27-staff-home");
  });

  test("28 — Staff Attendance", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/staff/attendance", "staff-attendance");
    await page.waitForTimeout(2000);
    await snap(page, "28-staff-attendance");
  });

  test("29 — Staff Expenses", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/staff/expenses", "staff-expenses");
    await page.waitForTimeout(2000);
    await snap(page, "29-staff-expenses");
  });

  test("30 — Staff Month Lock", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/staff/month-lock", "staff-month-lock");
    await page.waitForTimeout(2000);
    await snap(page, "30-staff-month-lock");
  });

  test("31 — Staff Payroll Snapshot", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/staff/payroll-snapshot", "staff-payroll");
    await page.waitForTimeout(2000);
    await snap(page, "31-staff-payroll");
  });

  test("32 — Staff Reports", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/staff/reports", "staff-reports");
    await page.waitForTimeout(2000);
    await snap(page, "32-staff-reports");
  });

  test("33 — Staff Settings", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/staff/settings", "staff-settings");
    await page.waitForTimeout(2000);
    await snap(page, "33-staff-settings");
  });

  test("34 — Materials Sheets", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/materials/sheets", "materials-sheets");
    await page.waitForTimeout(2000);
    await snap(page, "34-materials-sheets");
  });

  test("35 — Storage", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/storage", "storage");
    await page.waitForTimeout(2000);
    await snap(page, "35-storage");
  });

  test("36 — Tools PPT", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/tools/ppt", "tools-ppt");
    await page.waitForTimeout(2000);
    await snap(page, "36-tools-ppt");
  });

  test("37 — Tools OMR", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/tools/omr", "tools-omr");
    await page.waitForTimeout(2000);
    await snap(page, "37-tools-omr");
  });

  test("38 — Tools Clinic Printout", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/tools/clinic", "tools-clinic");
    await page.waitForTimeout(2000);
    await snap(page, "38-tools-clinic");
  });

  test("39 — Settings Profile", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/settings/profile", "settings-profile");
    await page.waitForTimeout(2000);
    await snap(page, "39-settings-profile");
  });

  test("40 — Settings Organization", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/settings/organization", "settings-org");
    await page.waitForTimeout(2000);
    await snap(page, "40-settings-org");
  });

  test("41 — Settings Appearance", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/settings/appearance", "settings-appearance");
    await page.waitForTimeout(2000);
    await snap(page, "41-settings-appearance");
  });

  test("42 — Settings Landing Editor", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/settings/landing", "settings-landing");
    await page.waitForTimeout(2000);
    await snap(page, "42-settings-landing");
  });

  test("43 — Settings Billing", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/settings/billing", "settings-billing");
    await page.waitForTimeout(2000);
    await snap(page, "43-settings-billing");
  });

  test("44 — Profile Attendance", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/profile/attendance", "profile-attendance");
    await page.waitForTimeout(2000);
    await snap(page, "44-profile-attendance");
  });

  test("45 — Profile Expense", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/profile/expense", "profile-expense");
    await page.waitForTimeout(2000);
    await snap(page, "45-profile-expense");
  });

  test("46 — Guide", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/guide", "guide");
    await page.waitForTimeout(2000);
    await snap(page, "46-guide");
  });

  test("47 — Counsel (top-level)", async ({ page }) => {
    await safeGoto(page, "https://hakwonplus.com/admin/counsel", "counsel");
    await page.waitForTimeout(2000);
    await snap(page, "47-counsel");
  });
});
