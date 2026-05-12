/**
 * 전체 페이지 시각 검수 — 2026-05-12
 *
 * 대상:
 *  - Landing/public (10)
 *  - Admin desktop 1366×900 (~18)
 *  - Student mobile 390×844 (~12)
 *  - Teacher mobile 390×844 (~12)
 *
 * 산출물: C:\academy\_artifacts\sessions\visual-review-2026-05-12\*.png
 */
import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "./helpers/auth";

const BASE = getBaseUrl("admin");
const OUT = "C:/academy/_artifacts/sessions/visual-review-2026-05-12";

async function shot(page: Page, name: string) {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

test.describe("L. Landing / Public", () => {
  test.setTimeout(180000);
  test("public pages", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();

    const pages = [
      ["landing-main",          `${BASE}/landing`],
      ["landing-reports",       `${BASE}/landing/reports`],
      ["landing-community-board", `${BASE}/landing/community/board`],
      ["landing-community-notice", `${BASE}/landing/community/notice`],
      ["landing-community-qna", `${BASE}/landing/community/qna`],
      ["landing-community-materials", `${BASE}/landing/community/materials`],
      ["landing-community-counsel", `${BASE}/landing/community/counsel`],
      ["terms",                 `${BASE}/terms`],
      ["privacy",               `${BASE}/privacy`],
      ["login",                 `${BASE}/login`],
    ];
    for (const [name, url] of pages) {
      await page.goto(url, { waitUntil: "load", timeout: 20000 }).catch(() => {});
      await shot(page, `L-${name}`);
    }

    // mobile viewport for landing
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/landing`, { waitUntil: "load", timeout: 20000 }).catch(() => {});
    await shot(page, "L-landing-main-mobile");
    await page.goto(`${BASE}/landing/community/board`, { waitUntil: "load", timeout: 20000 }).catch(() => {});
    await shot(page, "L-landing-community-board-mobile");

    await page.close();
    await ctx.close();
  });
});

test.describe("A. Admin desktop 1366", () => {
  test.setTimeout(600000);
  test("admin pages", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    await loginViaUI(page, "admin");

    const pages = [
      ["dashboard",            `${BASE}/admin/dashboard`],
      ["students-home",        `${BASE}/admin/students/home`],
      ["students-requests",    `${BASE}/admin/students/requests`],
      ["students-deleted",     `${BASE}/admin/students/deleted`],
      ["lectures",             `${BASE}/admin/lectures`],
      ["lectures-past",        `${BASE}/admin/lectures/past`],
      ["exams",                `${BASE}/admin/exams`],
      ["exams-templates",      `${BASE}/admin/exams/templates`],
      ["exams-bundles",        `${BASE}/admin/exams/bundles`],
      ["results",              `${BASE}/admin/results`],
      ["results-tree",         `${BASE}/admin/results/tree`],
      ["results-submissions",  `${BASE}/admin/results/submissions`],
      ["videos",               `${BASE}/admin/videos`],
      ["videos-tree",          `${BASE}/admin/videos/tree`],
      ["materials",            `${BASE}/admin/materials`],
      ["storage",              `${BASE}/admin/storage`],
      ["fees",                 `${BASE}/admin/fees`],
      ["fees-invoices",        `${BASE}/admin/fees/invoices`],
      ["fees-templates",       `${BASE}/admin/fees/templates`],
      ["clinic",               `${BASE}/admin/clinic`],
      ["counsel",              `${BASE}/admin/counsel`],
      ["message",              `${BASE}/admin/message`],
      ["community-board",      `${BASE}/admin/community/board`],
      ["community-notice",     `${BASE}/admin/community/notice`],
      ["community-qna",        `${BASE}/admin/community/qna`],
      ["community-counsel",    `${BASE}/admin/community/counsel`],
      ["community-materials",  `${BASE}/admin/community/materials`],
      ["community-settings",   `${BASE}/admin/community/settings`],
      ["community-reports",    `${BASE}/admin/community/reports`],
      ["community-stats",      `${BASE}/admin/community/stats`],
      ["tools",                `${BASE}/admin/tools`],
      ["guide",                `${BASE}/admin/guide`],
      ["developer",            `${BASE}/admin/developer`],
      ["developer-bug",        `${BASE}/admin/developer/bug`],
      ["developer-feedback",   `${BASE}/admin/developer/feedback`],
      ["developer-flags",      `${BASE}/admin/developer/flags`],
      ["staff",                `${BASE}/admin/staff`],
      ["settings-profile",     `${BASE}/admin/settings/profile`],
      ["settings-org",         `${BASE}/admin/settings/organization`],
      ["settings-appearance",  `${BASE}/admin/settings/appearance`],
      ["settings-landing",     `${BASE}/admin/settings/landing`],
      ["settings-consult",     `${BASE}/admin/settings/consult`],
      ["settings-billing",     `${BASE}/admin/settings/billing`],
      ["profile-attendance",   `${BASE}/admin/profile/attendance`],
      ["profile-expense",      `${BASE}/admin/profile/expense`],
    ];

    for (const [name, url] of pages) {
      await page.goto(url, { waitUntil: "load", timeout: 20000 }).catch(() => {});
      await shot(page, `A-${name}`);
    }

    await page.close();
    await ctx.close();
  });
});

test.describe("S. Student mobile 390", () => {
  test.setTimeout(400000);
  test("student pages", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
    });
    const page = await ctx.newPage();
    await loginViaUI(page, "student");

    const pages = [
      ["dashboard",       `${BASE}/student/dashboard`],
      ["video",           `${BASE}/student/video`],
      ["sessions",        `${BASE}/student/sessions`],
      ["submit",          `${BASE}/student/submit`],
      ["inventory",       `${BASE}/student/inventory`],
      ["exams",           `${BASE}/student/exams`],
      ["grades",          `${BASE}/student/grades`],
      ["profile",         `${BASE}/student/profile`],
      ["settings",        `${BASE}/student/settings`],
      ["community",       `${BASE}/student/community`],
      ["notices",         `${BASE}/student/notices`],
      ["notifications",   `${BASE}/student/notifications`],
      ["idcard",          `${BASE}/student/idcard`],
      ["clinic",          `${BASE}/student/clinic`],
      ["attendance",      `${BASE}/student/attendance`],
      ["guide",           `${BASE}/student/guide`],
    ];
    for (const [name, url] of pages) {
      await page.goto(url, { waitUntil: "load", timeout: 20000 }).catch(() => {});
      await shot(page, `S-${name}`);
    }

    await page.close();
    await ctx.close();
  });
});

test.describe("T. Teacher mobile 390 (admin user → teacher)", () => {
  test.setTimeout(400000);
  test("teacher pages", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
    });
    const page = await ctx.newPage();
    await loginViaUI(page, "admin");

    const pages = [
      ["today",                 `${BASE}/teacher`],
      ["classes",               `${BASE}/teacher/classes`],
      ["students",              `${BASE}/teacher/students`],
      ["comms",                 `${BASE}/teacher/comms`],
      ["message-log",           `${BASE}/teacher/message-log`],
      ["message-templates",     `${BASE}/teacher/message-templates`],
      ["notifications",         `${BASE}/teacher/notifications`],
      ["exams",                 `${BASE}/teacher/exams`],
      ["exams-templates",       `${BASE}/teacher/exams/templates`],
      ["exams-bundles",         `${BASE}/teacher/exams/bundles`],
      ["videos",                `${BASE}/teacher/videos`],
      ["clinic",                `${BASE}/teacher/clinic`],
      ["clinic-reports",        `${BASE}/teacher/clinic/reports`],
      ["counseling",            `${BASE}/teacher/counseling`],
      ["results",               `${BASE}/teacher/results`],
      ["submissions",           `${BASE}/teacher/submissions`],
      ["profile",               `${BASE}/teacher/profile`],
      ["settings",              `${BASE}/teacher/settings`],
      ["staff",                 `${BASE}/teacher/staff`],
      ["my-records",            `${BASE}/teacher/my-records`],
      ["billing",               `${BASE}/teacher/billing`],
      ["fees",                  `${BASE}/teacher/fees`],
      ["fees-invoices",         `${BASE}/teacher/fees/invoices`],
      ["storage",               `${BASE}/teacher/storage`],
      ["storage-inventory",     `${BASE}/teacher/storage/inventory`],
      ["settings-org",          `${BASE}/teacher/settings/organization`],
      ["settings-appearance",   `${BASE}/teacher/settings/appearance`],
      ["tools-stopwatch",       `${BASE}/teacher/tools/stopwatch`],
      ["developer",             `${BASE}/teacher/developer`],
    ];
    for (const [name, url] of pages) {
      await page.goto(url, { waitUntil: "load", timeout: 20000 }).catch(() => {});
      await shot(page, `T-${name}`);
    }

    await page.close();
    await ctx.close();
  });
});
