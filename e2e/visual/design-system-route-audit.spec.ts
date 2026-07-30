import type { Page, TestInfo } from "@playwright/test";
import { test, expect } from "../fixtures/strictTest";
import { getBaseUrl, loginViaUI } from "../helpers/auth";

const ADMIN_ROUTES = [
  "/workspace/dashboard",
  "/workspace/guide",
  "/workspace/students/home",
  "/workspace/students/requests",
  "/workspace/lectures",
  "/workspace/clinic/home",
  "/workspace/clinic/operations",
  "/workspace/clinic/bookings",
  "/workspace/clinic/reports",
  "/workspace/clinic/settings",
  "/workspace/clinic/msg-settings",
  "/workspace/exams",
  "/workspace/exams/templates",
  "/workspace/exams/bundles",
  "/workspace/results",
  "/workspace/results/tree",
  "/workspace/results/submissions",
  "/workspace/videos",
  "/workspace/videos/tree",
  "/workspace/message/templates",
  "/workspace/message/auto-send",
  "/workspace/message/log",
  "/workspace/message/settings",
  "/workspace/storage/matchup",
  "/workspace/storage/files",
  "/workspace/storage/students",
  "/workspace/storage/hit-reports",
  "/workspace/storage/proposals",
  "/workspace/materials/sheets",
  "/workspace/materials/reports",
  "/workspace/materials/messages",
  "/workspace/community/board",
  "/workspace/community/notice",
  "/workspace/community/qna",
  "/workspace/community/counsel",
  "/workspace/community/materials",
  "/workspace/community/settings",
  "/workspace/community/reports",
  "/workspace/community/stats",
  "/workspace/landing-public/inbox",
  "/workspace/tools/ppt",
  "/workspace/tools/omr",
  "/workspace/tools/clinic",
  "/workspace/tools/stopwatch",
  "/workspace/tools/problem-studio",
  "/workspace/staff/home",
  "/workspace/staff/attendance",
  "/workspace/staff/expenses",
  "/workspace/staff/month-lock",
  "/workspace/staff/payroll-snapshot",
  "/workspace/staff/reports",
  "/workspace/staff/settings",
  "/workspace/settings/profile",
  "/workspace/settings/organization",
  "/workspace/settings/appearance",
  "/workspace/settings/landing",
  "/workspace/settings/consult",
  "/workspace/settings/billing",
  "/workspace/profile/attendance",
  "/workspace/profile/expense",
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
  "/workspace/mobile",
  "/workspace/mobile/guide",
  "/workspace/mobile/classes",
  "/workspace/mobile/students",
  "/workspace/mobile/comms",
  "/workspace/mobile/message-log",
  "/workspace/mobile/message-templates",
  "/workspace/mobile/messaging-settings",
  "/workspace/mobile/notifications",
  "/workspace/mobile/exams",
  "/workspace/mobile/exams/templates",
  "/workspace/mobile/exams/bundles",
  "/workspace/mobile/videos",
  "/workspace/mobile/clinic",
  "/workspace/mobile/clinic/reports",
  "/workspace/mobile/clinic/remote",
  "/workspace/mobile/counseling",
  "/workspace/mobile/results",
  "/workspace/mobile/submissions",
  "/workspace/mobile/profile",
  "/workspace/mobile/settings",
  "/workspace/mobile/staff",
  "/workspace/mobile/my-records",
  "/workspace/mobile/billing",
  "/workspace/mobile/fees",
  "/workspace/mobile/fees/invoices",
  "/workspace/mobile/storage",
  "/workspace/mobile/storage/inventory",
  "/workspace/mobile/settings/organization",
  "/workspace/mobile/settings/appearance",
  "/workspace/mobile/tools/stopwatch",
  "/workspace/mobile/developer",
  "/workspace/mobile/developer/bug",
  "/workspace/mobile/developer/feedback",
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
    await loginViaUI(page, "admin", { landingPath: "/workspace/dashboard" });

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
    await loginViaUI(page, "admin", { landingPath: "/workspace/mobile" });

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
