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
import { test } from "./fixtures/strictTest";
import type { Page } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "./helpers/auth";

const BASE = getBaseUrl("admin");
const OUT = "C:/academy/_artifacts/sessions/visual-review-2026-05-12";

async function shot(page: Page, name: string) {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.locator("body").waitFor({ state: "visible", timeout: 8000 });
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
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
      ["dashboard",            `${BASE}/workspace/dashboard`],
      ["students-home",        `${BASE}/workspace/students/home`],
      ["students-requests",    `${BASE}/workspace/students/requests`],
      ["students-deleted",     `${BASE}/workspace/students/deleted`],
      ["lectures",             `${BASE}/workspace/lectures`],
      ["lectures-past",        `${BASE}/workspace/lectures/past`],
      ["exams",                `${BASE}/workspace/exams`],
      ["exams-templates",      `${BASE}/workspace/exams/templates`],
      ["exams-bundles",        `${BASE}/workspace/exams/bundles`],
      ["results",              `${BASE}/workspace/results`],
      ["results-tree",         `${BASE}/workspace/results/tree`],
      ["results-submissions",  `${BASE}/workspace/results/submissions`],
      ["videos",               `${BASE}/workspace/videos`],
      ["videos-tree",          `${BASE}/workspace/videos/tree`],
      ["materials",            `${BASE}/workspace/materials`],
      ["storage",              `${BASE}/workspace/storage`],
      ["fees",                 `${BASE}/workspace/fees`],
      ["fees-invoices",        `${BASE}/workspace/fees/invoices`],
      ["fees-templates",       `${BASE}/workspace/fees/templates`],
      ["clinic",               `${BASE}/workspace/clinic`],
      ["counsel",              `${BASE}/workspace/counsel`],
      ["message",              `${BASE}/workspace/message`],
      ["community-board",      `${BASE}/workspace/community/board`],
      ["community-notice",     `${BASE}/workspace/community/notice`],
      ["community-qna",        `${BASE}/workspace/community/qna`],
      ["community-counsel",    `${BASE}/workspace/community/counsel`],
      ["community-materials",  `${BASE}/workspace/community/materials`],
      ["community-settings",   `${BASE}/workspace/community/settings`],
      ["community-reports",    `${BASE}/workspace/community/reports`],
      ["community-stats",      `${BASE}/workspace/community/stats`],
      ["tools",                `${BASE}/workspace/tools`],
      ["guide",                `${BASE}/workspace/guide`],
      ["developer",            `${BASE}/workspace/developer`],
      ["developer-bug",        `${BASE}/workspace/developer/bug`],
      ["developer-feedback",   `${BASE}/workspace/developer/feedback`],
      ["developer-flags",      `${BASE}/workspace/developer/flags`],
      ["staff",                `${BASE}/workspace/staff`],
      ["settings-profile",     `${BASE}/workspace/settings/profile`],
      ["settings-org",         `${BASE}/workspace/settings/organization`],
      ["settings-appearance",  `${BASE}/workspace/settings/appearance`],
      ["settings-landing",     `${BASE}/workspace/settings/landing`],
      ["settings-consult",     `${BASE}/workspace/settings/consult`],
      ["settings-billing",     `${BASE}/workspace/settings/billing`],
      ["profile-attendance",   `${BASE}/workspace/profile/attendance`],
      ["profile-expense",      `${BASE}/workspace/profile/expense`],
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
      ["today",                 `${BASE}/workspace/mobile`],
      ["classes",               `${BASE}/workspace/mobile/classes`],
      ["students",              `${BASE}/workspace/mobile/students`],
      ["comms",                 `${BASE}/workspace/mobile/comms`],
      ["message-log",           `${BASE}/workspace/mobile/message-log`],
      ["message-templates",     `${BASE}/workspace/mobile/message-templates`],
      ["notifications",         `${BASE}/workspace/mobile/notifications`],
      ["exams",                 `${BASE}/workspace/mobile/exams`],
      ["exams-templates",       `${BASE}/workspace/mobile/exams/templates`],
      ["exams-bundles",         `${BASE}/workspace/mobile/exams/bundles`],
      ["videos",                `${BASE}/workspace/mobile/videos`],
      ["clinic",                `${BASE}/workspace/mobile/clinic`],
      ["clinic-reports",        `${BASE}/workspace/mobile/clinic/reports`],
      ["counseling",            `${BASE}/workspace/mobile/counseling`],
      ["results",               `${BASE}/workspace/mobile/results`],
      ["submissions",           `${BASE}/workspace/mobile/submissions`],
      ["profile",               `${BASE}/workspace/mobile/profile`],
      ["settings",              `${BASE}/workspace/mobile/settings`],
      ["staff",                 `${BASE}/workspace/mobile/staff`],
      ["my-records",            `${BASE}/workspace/mobile/my-records`],
      ["billing",               `${BASE}/workspace/mobile/billing`],
      ["fees",                  `${BASE}/workspace/mobile/fees`],
      ["fees-invoices",         `${BASE}/workspace/mobile/fees/invoices`],
      ["storage",               `${BASE}/workspace/mobile/storage`],
      ["storage-inventory",     `${BASE}/workspace/mobile/storage/inventory`],
      ["settings-org",          `${BASE}/workspace/mobile/settings/organization`],
      ["settings-appearance",   `${BASE}/workspace/mobile/settings/appearance`],
      ["tools-stopwatch",       `${BASE}/workspace/mobile/tools/stopwatch`],
      ["developer",             `${BASE}/workspace/mobile/developer`],
    ];
    for (const [name, url] of pages) {
      await page.goto(url, { waitUntil: "load", timeout: 20000 }).catch(() => {});
      await shot(page, `T-${name}`);
    }

    await page.close();
    await ctx.close();
  });
});
