import type { Page, TestInfo } from "@playwright/test";
import { test, expect } from "../fixtures/strictTest";
import { getBaseUrl, loginViaUI } from "../helpers/auth";

test.use({
  allowRecoveredProductionCors: true,
});

const TENANT_LANDING_BASE = process.env.TCHUL_BASE_URL || "https://tchul.com";
const DEVELOPER_BASE = process.env.E2E_DEV_BASE_URL || "https://dev.hakwonplus.com";

const ADMIN_ROUTES = [
  "/workspace/dashboard",
  "/workspace/guide",
  "/workspace/students/home",
  "/workspace/students/requests",
  "/workspace/students/deleted",
  "/workspace/lectures",
  "/workspace/lectures/past",
  "/workspace/fees",
  "/workspace/fees/invoices",
  "/workspace/fees/templates",
  "/workspace/clinic/home",
  "/workspace/clinic/schedule",
  "/workspace/clinic/operations",
  "/workspace/clinic/bookings",
  "/workspace/clinic/reports",
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
  "/workspace/tools/stopwatch",
  "/workspace/tools/problem-studio",
  "/workspace/developer/bug",
  "/workspace/developer/feedback",
  "/workspace/developer/flags",
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
  "/workspace/mobile/counseling",
  "/workspace/mobile/results",
  "/workspace/mobile/submissions",
  "/workspace/mobile/profile",
  "/workspace/mobile/settings",
  "/workspace/mobile/staff",
  "/workspace/mobile/my-records",
  "/workspace/mobile/billing",
  "/workspace/mobile/desktop-only",
  "/workspace/mobile/fees",
  "/workspace/mobile/fees/invoices",
  "/workspace/mobile/storage",
  "/workspace/mobile/storage/inventory",
  "/workspace/mobile/settings/organization",
  "/workspace/mobile/settings/appearance",
  "/workspace/mobile/tools",
  "/workspace/mobile/tools/problem-solver",
  "/workspace/mobile/tools/stopwatch",
  "/workspace/mobile/developer/bug",
  "/workspace/mobile/developer/feedback",
] as const;

const PROMO_ROUTES = [
  "/promo",
  "/promo/features",
  "/promo/matchup-ppt",
  "/promo/parent-trust",
  "/promo/ai-grading",
  "/promo/video-platform",
  "/promo/pricing",
  "/promo/updates",
  "/promo/faq",
  "/promo/contact",
  "/promo/demo",
  "/promo/landing-samples",
] as const;

const SYSTEM_ROUTES = [
  "/login",
  "/terms",
  "/privacy",
  "/maintenance",
  "/error/tenant-required",
] as const;

const TENANT_LANDING_ROUTES = [
  "/landing",
  "/landing/reports",
  "/landing/community/board",
  "/landing/community/notice",
  "/landing/community/qna",
  "/landing/community/materials",
  "/landing/board",
  "/landing/reviews",
  "/landing/scores",
  "/landing/about",
  "/landing/guide",
  "/landing/matchup-board",
  "/landing/analysis",
] as const;

const DEV_ROUTES = [
  "/dev/dashboard",
  "/dev/tenants",
  "/dev/billing",
  "/dev/inbox",
  "/dev/automation",
  "/dev/product-analytics",
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

const ERROR_TEXT_PATTERNS = [
  String.raw`\bNot Found\b`,
  String.raw`\bChunkLoadError\b`,
  String.raw`\bApplication error\b`,
  String.raw`\bSomething went wrong\b`,
  String.raw`\bUnable to preload CSS\b`,
  "오류가 발생했습니다",
] as const;

function routeName(route: string): string {
  return route.replace(/^\/+/, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+$/, "") || "root";
}

async function gotoSettled(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.locator("body").waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(() => {
    const bodyText = (document.body.innerText || "").trim().replace(/\s+/g, " ");
    return !/^(?:불러오는 중|로딩 중)(?:\.{3}|…)?$/.test(bodyText);
  }, undefined, { timeout: 15_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
}

async function auditRoute(page: Page, testInfo: TestInfo, base: string, route: string) {
  await gotoSettled(page, `${base}${route}`);

  const snapshot = await page.evaluate(({ tokens, errorTextPatterns }) => {
    const rootStyle = getComputedStyle(document.documentElement);
    const bodyStyle = getComputedStyle(document.body);
    const bodyFont = bodyStyle.fontFamily;
    const visibleRect = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      let left = Math.max(0, rect.left);
      let top = Math.max(0, rect.top);
      let right = Math.min(window.innerWidth, rect.right);
      let bottom = Math.min(window.innerHeight, rect.bottom);
      let ancestor = element.parentElement;

      while (ancestor && ancestor !== document.body) {
        const style = getComputedStyle(ancestor);
        const ancestorRect = ancestor.getBoundingClientRect();
        if (style.overflowX !== "visible") {
          left = Math.max(left, ancestorRect.left);
          right = Math.min(right, ancestorRect.right);
        }
        if (style.overflowY !== "visible") {
          top = Math.max(top, ancestorRect.top);
          bottom = Math.min(bottom, ancestorRect.bottom);
        }
        ancestor = ancestor.parentElement;
      }

      return {
        left,
        top,
        right,
        bottom,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
      };
    };

    const isVisuallyReachable = (element: HTMLElement) => {
      if (element.closest("[aria-hidden='true'], [inert]")) return false;
      const style = getComputedStyle(element);
      const rect = visibleRect(element);
      return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && rect.width > 0 && rect.height > 0;
    };

    const visibleControls = Array.from(
      document.querySelectorAll<HTMLElement>("button, input, select, textarea, [role='button'], .ant-btn"),
    ).filter((element) => {
      if (element.closest("[data-visual-font-intent]")) return false;
      return isVisuallyReachable(element);
    });

    const actionableControls = Array.from(
      document.querySelectorAll<HTMLElement>("button, a[href], [role='button']"),
    )
      .filter(isVisuallyReachable)
      .map((element) => ({ element, rect: visibleRect(element) }));

    const controlLabel = (element: HTMLElement) =>
      (element.innerText || element.getAttribute("aria-label") || element.getAttribute("title") || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 60);

    const controlScope = (element: HTMLElement) =>
      element.closest<HTMLElement>(
        "header, footer, nav, section, article, form, [role='dialog'], [role='menu'], [role='toolbar'], [role='tablist']",
      );

    const sharesVisualScope = (first: HTMLElement, second: HTMLElement) => {
      const firstOverlapIntent = first.closest("[data-visual-overlap-intent]");
      const secondOverlapIntent = second.closest("[data-visual-overlap-intent]");
      if (firstOverlapIntent && firstOverlapIntent === secondOverlapIntent) return false;
      const firstScope = controlScope(first);
      const secondScope = controlScope(second);
      if (firstScope || secondScope) return firstScope === secondScope;
      return first.parentElement === second.parentElement ||
        first.parentElement?.parentElement === second.parentElement?.parentElement;
    };

    const clippedControls = actionableControls
      .map(({ element }) => element)
      .filter((element) => element.scrollWidth > element.clientWidth + 4 || element.scrollHeight > element.clientHeight + 4)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        text: controlLabel(element),
        client: `${element.clientWidth}x${element.clientHeight}`,
        scroll: `${element.scrollWidth}x${element.scrollHeight}`,
      }))
      .slice(0, 8);

    const overlappingControls: Array<{ first: string; second: string }> = [];
    for (let firstIndex = 0; firstIndex < actionableControls.length; firstIndex += 1) {
      const first = actionableControls[firstIndex]!;
      const firstRect = first.rect;
      for (let secondIndex = firstIndex + 1; secondIndex < actionableControls.length; secondIndex += 1) {
        const second = actionableControls[secondIndex]!;
        if (first.element.contains(second.element) || second.element.contains(first.element)) continue;
        if (!sharesVisualScope(first.element, second.element)) continue;
        const secondRect = second.rect;
        const overlapWidth = Math.min(firstRect.right, secondRect.right) - Math.max(firstRect.left, secondRect.left);
        const overlapHeight = Math.min(firstRect.bottom, secondRect.bottom) - Math.max(firstRect.top, secondRect.top);
        if (overlapWidth <= 4 || overlapHeight <= 4) continue;
        const overlapArea = overlapWidth * overlapHeight;
        const smallerArea = Math.min(firstRect.width * firstRect.height, secondRect.width * secondRect.height);
        if (overlapArea < smallerArea * 0.2) continue;
        const probeX = Math.max(firstRect.left, secondRect.left) + overlapWidth / 2;
        const probeY = Math.max(firstRect.top, secondRect.top) + overlapHeight / 2;
        const topControl = document.elementFromPoint(probeX, probeY)?.closest("button, a[href], [role='button']");
        if (topControl !== first.element && topControl !== second.element) continue;
        overlappingControls.push({ first: controlLabel(first.element), second: controlLabel(second.element) });
        if (overlappingControls.length >= 8) break;
      }
      if (overlappingControls.length >= 8) break;
    }

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
    const errorTextMatches = errorTextPatterns.flatMap((pattern) => {
      const match = bodyText.match(new RegExp(pattern, "i"));
      return match ? [match[0].trim().slice(0, 120)] : [];
    });
    const standalone404 = bodyText.match(/(?:^|\n)\s*404\s*(?=\n|$)/i);
    if (standalone404 && bodyText.trim().length < 5_000) {
      errorTextMatches.push("404");
    }
    const escapedHtmlPattern = /<\/?(?:p|div|span|br|table|tbody|thead|tr|td|th|strong|em|h[1-6])\b|&(?:amp;)*(?:lt|gt);/i;
    const escapedHtmlAttributes = Array.from(
      document.querySelectorAll<HTMLElement>("[aria-label], [title], [alt], [placeholder]"),
    ).flatMap((element) => ["aria-label", "title", "alt", "placeholder"].map((attribute) => ({
      attribute,
      value: element.getAttribute(attribute) ?? "",
    }))).filter(({ value }) => escapedHtmlPattern.test(value)).slice(0, 8);

    return {
      url: location.href,
      origin: location.origin,
      pathname: location.pathname.replace(/\/+$/, "") || "/",
      title: document.title,
      bodyFont,
      badControls,
      clippedControls,
      overlappingControls,
      missingTokens,
      overflowX,
      viewportWidth: window.innerWidth,
      bodyTextLength: bodyText.trim().length,
      errorTextMatches,
      hasEscapedHtml: escapedHtmlPattern.test(bodyText),
      escapedHtmlAttributes,
    };
  }, {
    tokens: [...REQUIRED_TOKENS],
    errorTextPatterns: [...ERROR_TEXT_PATTERNS],
  });

  const expectedUrl = new URL(route, base);
  const expectedPathname = expectedUrl.pathname.replace(/\/+$/, "") || "/";
  expect.soft(snapshot.origin, `${route} changed origin while rendering`).toBe(expectedUrl.origin);
  expect.soft(snapshot.pathname, `${route} redirected to ${snapshot.url}`).toBe(expectedPathname);
  expect.soft(snapshot.bodyTextLength, `${route} rendered empty at ${snapshot.url}`).toBeGreaterThan(8);
  expect.soft(snapshot.errorTextMatches, `${route} rendered an error-like page at ${snapshot.url}`).toEqual([]);
  expect.soft(snapshot.missingTokens, `${route} missing design tokens`).toEqual([]);
  expect.soft(snapshot.badControls, `${route} controls not inheriting app font`).toEqual([]);
  expect.soft(snapshot.clippedControls, `${route} clipped controls`).toEqual([]);
  expect.soft(snapshot.overlappingControls, `${route} overlapping controls`).toEqual([]);
  expect.soft(snapshot.overflowX, `${route} body horizontal overflow`).toBeLessThanOrEqual(
    route.startsWith("/student/") || route.startsWith("/workspace/mobile") || snapshot.viewportWidth <= 640 ? 1 : 80,
  );
  expect.soft(snapshot.hasEscapedHtml, `${route} exposed escaped HTML to the user`).toBe(false);
  expect.soft(snapshot.escapedHtmlAttributes, `${route} exposed escaped HTML in accessible text`).toEqual([]);

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

  test("admin compact route surface is visually stable", async ({ page }, testInfo) => {
    test.setTimeout(12 * 60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const base = getBaseUrl("admin").replace(/\/+$/, "");
    const tenantCode = process.env.E2E_TENANT_CODE || "hakwonplus";
    await page.addInitScript((code) => {
      localStorage.setItem(`workspace:preferFull:${code}`, "1");
    }, tenantCode);
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

  test("student desktop route surface is visually stable", async ({ page }, testInfo) => {
    test.setTimeout(8 * 60_000);
    await page.setViewportSize({ width: 1366, height: 900 });
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

  test("system public route surface is visually stable", async ({ page }, testInfo) => {
    test.setTimeout(7 * 60_000);
    await page.setViewportSize({ width: 1366, height: 900 });
    const base = getBaseUrl("admin").replace(/\/+$/, "");

    for (const route of SYSTEM_ROUTES) {
      await auditRoute(page, testInfo, base, route);
    }
  });

  test("tenant landing route surface is visually stable", async ({ page }, testInfo) => {
    test.setTimeout(7 * 60_000);
    await page.setViewportSize({ width: 1366, height: 900 });
    const base = TENANT_LANDING_BASE.replace(/\/+$/, "");

    for (const route of TENANT_LANDING_ROUTES) {
      await auditRoute(page, testInfo, base, route);
    }
  });

  test("developer route surface is visually stable", async ({ page }, testInfo) => {
    test.setTimeout(7 * 60_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await loginViaUI(page, "admin", { landingPath: "/dev/dashboard" });

    for (const route of DEV_ROUTES) {
      await auditRoute(page, testInfo, DEVELOPER_BASE, route);
    }
  });
});
