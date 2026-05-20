/**
 * PATH: e2e/teacher/realuse-sub-2026-05-13.spec.ts
 * 학원장 시각 검수 2차 — sub 페이지 + 1366 narrow viewport
 */
import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth.ts";

const BASE = getBaseUrl("admin");

const PC_SUB = [
  { path: "/admin/message", file: "pc-sub-01-message" },
  { path: "/admin/results", file: "pc-sub-02-results" },
  { path: "/admin/videos", file: "pc-sub-03-videos" },
  { path: "/admin/community/notice", file: "pc-sub-04-community-notice" },
  { path: "/admin/storage/files", file: "pc-sub-05-storage" },
  { path: "/admin/fees/invoices", file: "pc-sub-06-fees-invoices" },
  { path: "/admin/exams/templates", file: "pc-sub-07-exam-templates" },
  { path: "/admin/clinic/operations", file: "pc-sub-08-clinic-operations" },
];

const MOBILE_SUB = [
  { path: "/teacher/message-log", file: "m-sub-01-message-log" },
  { path: "/teacher/results", file: "m-sub-02-results" },
  { path: "/teacher/submissions", file: "m-sub-03-submissions" },
  { path: "/teacher/videos", file: "m-sub-04-videos" },
  { path: "/teacher/storage", file: "m-sub-05-storage" },
  { path: "/teacher/fees/invoices", file: "m-sub-06-fees-invoices" },
  { path: "/teacher/notifications", file: "m-sub-07-notifications" },
  { path: "/teacher/counseling", file: "m-sub-08-counseling" },
];

const NARROW = [
  { path: "/admin/dashboard", file: "narrow-01-dashboard" },
  { path: "/admin/students/home", file: "narrow-02-students" },
  { path: "/admin/exams", file: "narrow-03-exams" },
  { path: "/admin/staff/home", file: "narrow-04-staff" },
];

type CaptureTarget = { path: string; file: string };

async function waitForRenderSettled(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.locator("body").waitFor({ state: "visible", timeout: 8000 });
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

async function readHeaders(page: Page) {
  return page.evaluate(() => {
    const r: string[] = [];
    document.querySelectorAll("h1, h2").forEach((el) => {
      const t = el.textContent?.trim();
      if (t && t.length < 60) r.push(t);
    });
    return r.slice(0, 3);
  });
}

async function readIconHistogram(page: Page) {
  return page.evaluate(() => {
    const h: Record<number, number> = {};
    document.querySelectorAll("svg").forEach((el) => {
      const w = el.getAttribute("width");
      if (!w) return;

      const n = Number.parseInt(w, 10);
      if (!Number.isNaN(n) && n <= 32) h[n] = (h[n] || 0) + 1;
    });
    return h;
  });
}

async function capturePage(page: Page, target: CaptureTarget, label: string, includeHeaders: boolean) {
  await page.goto(`${BASE}${target.path}`, { waitUntil: "networkidle", timeout: 20000 }).catch(() => {});
  await waitForRenderSettled(page);

  const iconHist = await readIconHistogram(page);
  if (includeHeaders) {
    const headers = await readHeaders(page);
    console.log(`[${label} ${target.path}] headers=${headers.join("|")} iconHist=${JSON.stringify(iconHist)}`);
  } else {
    console.log(`[${label} ${target.path}] iconHist=${JSON.stringify(iconHist)}`);
  }

  await page.screenshot({ path: `test-results/realuse/${target.file}.png`, fullPage: false });
}

test.describe("PC sub 페이지 (1920x1080)", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test("PC sub 8장 캡처", async ({ page }) => {
    await loginViaUI(page, "admin");
    for (const p of PC_SUB) {
      await capturePage(page, p, "PC", true);
    }
  });
});

test.describe("모바일 sub 페이지 (390x844)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("모바일 sub 8장 캡처", async ({ page }) => {
    await loginViaUI(page, "admin");
    for (const p of MOBILE_SUB) {
      await capturePage(page, p, "Mobile", true);
    }
  });
});

test.describe("PC narrow 1366 (학원장 노트북)", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("1366 narrow 4장 캡처", async ({ page }) => {
    await loginViaUI(page, "admin");
    for (const p of NARROW) {
      await capturePage(page, p, "1366", false);
    }
  });
});
