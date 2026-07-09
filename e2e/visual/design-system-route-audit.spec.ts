import type { Page, TestInfo } from "@playwright/test";
import { test, expect } from "../fixtures/strictTest";
import { getBaseUrl, loginViaUI } from "../helpers/auth";

const ADMIN_ROUTES = [
  "/admin/dashboard",
  "/admin/guide",
  "/admin/students/home",
  "/admin/students/requests",
  "/admin/lectures",
  "/admin/clinic/home",
  "/admin/clinic/operations",
  "/admin/clinic/bookings",
  "/admin/clinic/reports",
  "/admin/clinic/settings",
  "/admin/clinic/msg-settings",
  "/admin/exams",
  "/admin/exams/templates",
  "/admin/exams/bundles",
  "/admin/results",
  "/admin/results/tree",
  "/admin/results/submissions",
  "/admin/videos",
  "/admin/videos/tree",
  "/admin/message/templates",
  "/admin/message/auto-send",
  "/admin/message/log",
  "/admin/message/settings",
  "/admin/storage/matchup",
  "/admin/storage/files",
  "/admin/storage/students",
  "/admin/storage/hit-reports",
  "/admin/storage/proposals",
  "/admin/materials/sheets",
  "/admin/materials/reports",
  "/admin/materials/messages",
  "/admin/community/board",
  "/admin/community/notice",
  "/admin/community/qna",
  "/admin/community/counsel",
  "/admin/community/materials",
  "/admin/community/settings",
  "/admin/community/reports",
  "/admin/community/stats",
  "/admin/landing-public/inbox",
  "/admin/tools/ppt",
  "/admin/tools/omr",
  "/admin/tools/clinic",
  "/admin/tools/stopwatch",
  "/admin/tools/problem-studio",
  "/admin/staff/home",
  "/admin/staff/attendance",
  "/admin/staff/expenses",
  "/admin/staff/month-lock",
  "/admin/staff/payroll-snapshot",
  "/admin/staff/reports",
  "/admin/staff/settings",
  "/admin/settings/profile",
  "/admin/settings/organization",
  "/admin/settings/appearance",
  "/admin/settings/landing",
  "/admin/settings/consult",
  "/admin/settings/billing",
  "/admin/profile/attendance",
  "/admin/profile/expense",
] as const;

const STUDENT_ROUTES = [
  "/student/dashboard",
  "/student/video",
  "/student/sessions",
  "/student/submit",
  "/student/submit/score",
  "/student/submit/assignment",
  "/student/inventory",
  "/student/exams",
  "/student/grades",
  "/student/profile",
  "/student/settings",
  "/student/community",
  "/student/qna",
  "/student/notices",
  "/student/notifications",
  "/student/idcard",
  "/student/clinic",
  "/student/attendance",
  "/student/fees",
  "/student/guide",
] as const;

const TEACHER_ROUTES = [
  "/teacher",
  "/teacher/guide",
  "/teacher/classes",
  "/teacher/students",
  "/teacher/comms",
  "/teacher/message-log",
  "/teacher/message-templates",
  "/teacher/messaging-settings",
  "/teacher/notifications",
  "/teacher/exams",
  "/teacher/exams/templates",
  "/teacher/exams/bundles",
  "/teacher/videos",
  "/teacher/clinic",
  "/teacher/clinic/reports",
  "/teacher/clinic/remote",
  "/teacher/counseling",
  "/teacher/results",
  "/teacher/submissions",
  "/teacher/profile",
  "/teacher/settings",
  "/teacher/staff",
  "/teacher/my-records",
  "/teacher/billing",
  "/teacher/fees",
  "/teacher/fees/invoices",
  "/teacher/storage",
  "/teacher/storage/inventory",
  "/teacher/settings/organization",
  "/teacher/settings/appearance",
  "/teacher/tools/stopwatch",
  "/teacher/developer",
  "/teacher/developer/bug",
  "/teacher/developer/feedback",
] as const;

const PROMO_ROUTES = [
  "/promo",
  "/promo/features",
  "/promo/parent-trust",
  "/promo/ai-grading",
  "/promo/video-platform",
  "/promo/pricing",
  "/promo/faq",
  "/promo/contact",
  "/promo/demo",
  "/promo/landing-samples",
] as const;

const REQUIRED_TOKENS = [
  "--color-brand-primary",
  "--color-bg-surface",
  "--color-border-divider",
  "--color-text-primary",
  "--color-status-success",
  "--color-status-warning",
  "--color-status-error",
  "--color-status-danger",
  "--color-status-info",
  "--color-danger-soft",
] as const;

function routeName(route: string): string {
  return route.replace(/^\/+/, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+$/, "") || "root";
}

async function gotoSettled(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.locator("body").waitFor({ state: "visible", timeout: 15_000 });
  await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
}

async function auditRoute(page: Page, testInfo: TestInfo, base: string, route: string) {
  await gotoSettled(page, `${base}${route}`);

  const snapshot = await page.evaluate((tokens) => {
    const rootStyle = getComputedStyle(document.documentElement);
    const bodyStyle = getComputedStyle(document.body);
    const bodyFont = bodyStyle.fontFamily;
    const visibleControls = Array.from(
      document.querySelectorAll<HTMLElement>("button, input, select, textarea, [role='button'], .ant-btn"),
    ).filter((element) => {
      if (element.closest("[data-visual-font-intent]")) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });

    const badControls = visibleControls
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        text: (element.innerText || element.getAttribute("aria-label") || element.getAttribute("placeholder") || "").trim().slice(0, 60),
        fontFamily: getComputedStyle(element).fontFamily,
      }))
      .filter((control) => !/Pretendard/i.test(control.fontFamily) && control.fontFamily !== bodyFont)
      .slice(0, 8);

    const missingTokens = tokens.filter((token) => !rootStyle.getPropertyValue(token).trim());
    const html = document.documentElement;
    const body = document.body;
    const overflowX = Math.max(html.scrollWidth, body.scrollWidth) - window.innerWidth;
    const bodyText = body.innerText || "";

    return {
      url: location.href,
      title: document.title,
      bodyFont,
      badControls,
      missingTokens,
      overflowX,
      bodyTextLength: bodyText.trim().length,
      hasErrorText: /Not Found|ChunkLoadError|Application error|Something went wrong|404/i.test(bodyText),
    };
  }, [...REQUIRED_TOKENS]);

  expect(snapshot.bodyTextLength, `${route} rendered empty at ${snapshot.url}`).toBeGreaterThan(8);
  expect(snapshot.hasErrorText, `${route} rendered an error-like page at ${snapshot.url}`).toBe(false);
  expect(snapshot.missingTokens, `${route} missing design tokens`).toEqual([]);
  expect(snapshot.badControls, `${route} controls not inheriting app font`).toEqual([]);
  expect(snapshot.overflowX, `${route} body horizontal overflow`).toBeLessThanOrEqual(80);

  const screenshotPath = testInfo.outputPath(`${routeName(route)}.png`);
  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
    animations: "disabled",
  });
  await testInfo.attach(`${routeName(route)}.png`, {
    path: screenshotPath,
    contentType: "image/png",
  });
}

test.describe.configure({ mode: "serial" });

test.describe("design-system route visual audit", () => {
  test("admin static route surface is visually stable", async ({ page }, testInfo) => {
    test.setTimeout(12 * 60_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const base = getBaseUrl("admin").replace(/\/+$/, "");
    await loginViaUI(page, "admin", { landingPath: "/admin/dashboard" });

    for (const route of ADMIN_ROUTES) {
      await auditRoute(page, testInfo, base, route);
    }
  });

  test("student mobile route surface is visually stable", async ({ page }, testInfo) => {
    test.setTimeout(8 * 60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const base = getBaseUrl("student").replace(/\/+$/, "");
    await loginViaUI(page, "student", { landingPath: "/student/dashboard" });

    for (const route of STUDENT_ROUTES) {
      await auditRoute(page, testInfo, base, route);
    }
  });

  test("teacher mobile route surface is visually stable", async ({ page }, testInfo) => {
    test.setTimeout(8 * 60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const base = getBaseUrl("admin").replace(/\/+$/, "");
    await loginViaUI(page, "admin", { landingPath: "/teacher" });

    for (const route of TEACHER_ROUTES) {
      await auditRoute(page, testInfo, base, route);
    }
  });

  test("promo public route surface is visually stable", async ({ page }, testInfo) => {
    test.setTimeout(5 * 60_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const base = getBaseUrl("admin").replace(/\/+$/, "");

    for (const route of PROMO_ROUTES) {
      await auditRoute(page, testInfo, base, route);
    }
  });
});
