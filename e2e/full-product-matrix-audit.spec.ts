/**
 * full-product-test-audit.mdc 매트릭스 A~L 경로 순회 + 스크린샷
 * Tenant: .env.e2e (hakwonplus) / API 토큰 로그인
 *
 * Run: npx playwright test e2e/full-product-matrix-audit.spec.ts --reporter=list
 */
import { mkdirSync } from "fs";
import { test, expect } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "./helpers/auth";

const BASE = getBaseUrl("admin");
const OUT = "e2e/screenshots/full-product-audit-2026-04-11";

async function settle(page: import("@playwright/test").Page, ms = 1400) {
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(ms);
}

async function shot(page: import("@playwright/test").Page, file: string) {
  await settle(page);
  await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: true });
}

test.describe.configure({ mode: "serial" });

test.describe("Full product matrix A–L (screenshots)", () => {
  test.setTimeout(900_000);

  test.beforeAll(() => {
    mkdirSync(OUT, { recursive: true });
  });

  test("SECTION A–D admin surfaces", async ({ page }) => {
    // A-01 로그인 화면 (비인증)
    await page.goto(`${BASE}/login`, { waitUntil: "commit" });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${BASE}/login/hakwonplus`, { waitUntil: "load", timeout: 25000 });
    await shot(page, "A-01-login-form");

    // A-04 잘못된 비밀번호 (한 번 시도 — 계정 잠금 위험 시 스킵하려면 아래 블록 주석)
    const openBtn = page.locator("button").filter({ hasText: /로그인|시작/ }).first();
    if (await openBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await openBtn.click();
      await page.waitForTimeout(400);
    }
    const userInput = page.locator('input[name="username"]').first();
    if (await userInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await userInput.fill("admin97");
      await page.locator('input[name="password"], input[type="password"]').first().fill("__wrong__e2e_matrix__");
      await page.locator('button[type="submit"], button').filter({ hasText: /로그인/ }).first().click();
      await page.waitForTimeout(2500);
      await shot(page, "A-04-login-error-attempt");
    }

    await loginViaUI(page, "admin");

    const adminPairs: [string, string][] = [
      ["A-02-admin-dashboard", "/admin/dashboard"],
      ["B-01-students-list", "/admin/students/home"],
      ["C-01-lectures-list", "/admin/lectures"],
      ["D-01-exams-list", "/admin/exams"],
      ["D-05-results-explorer", "/admin/results"],
      ["D-06-submissions", "/admin/results/submissions"],
      ["E-01-clinic-home", "/admin/clinic/home"],
      ["E-03-clinic-bookings", "/admin/clinic/bookings"],
      ["E-04-clinic-operations", "/admin/clinic/operations"],
      ["F-01-videos-list", "/admin/videos"],
      ["G-04-auto-send", "/admin/message/auto-send"],
      ["G-05-message-log", "/admin/message/log"],
      ["H-01-community-board", "/admin/community/board"],
      ["J-01-staff-list", "/admin/staff/home"],
      ["K-01-settings-profile", "/admin/settings/profile"],
      ["K-02-tools-hub", "/admin/tools"],
      ["K-03-guide", "/admin/guide"],
    ];

    for (const [name, path] of adminPairs) {
      await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 30000 });
      await shot(page, name);
    }

    // I 수납 — program 로드·lazy 청크 후 UI 안정화까지 대기 (빈 스크린샷 방지)
    await page.goto(`${BASE}/admin/fees`, { waitUntil: "load", timeout: 45000 });
    await page
      .waitForFunction(
        () => {
          const body = document.body?.innerText ?? "";
          return (
            body.includes("수납 관리") ||
            body.includes("대시보드") ||
            body.includes("불러오는 중") ||
            body.includes("미처리 일감")
          );
        },
        { timeout: 35000 },
      )
      .catch(() => {});
    await settle(page, 2500);
    await shot(page, "I-01-fees-route-result");

    // G-01 메시지 발송: 학생 선택 후 모달 시도
    await page.goto(`${BASE}/admin/students/home`, { waitUntil: "load", timeout: 30000 });
    await settle(page, 2000);
    const firstCb = page.locator("table tbody tr").first().locator('input[type="checkbox"], [role="checkbox"]').first();
    if (await firstCb.isVisible({ timeout: 4000 }).catch(() => false)) {
      await firstCb.click();
      await page.waitForTimeout(400);
    }
    const msgBtn = page.locator("button").filter({ hasText: /메시지 발송/ }).first();
    if (await msgBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await msgBtn.click();
      await settle(page, 1500);
      await shot(page, "G-01-send-message-modal");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    } else {
      await shot(page, "G-01-send-message-modal-skipped");
    }
  });

  test("SECTION L student surfaces", async ({ page }) => {
    await loginViaUI(page, "student");

    const studentPairs: [string, string][] = [
      ["L-01-student-dashboard", "/student/dashboard"],
      ["L-02-student-video", "/student/video"],
      ["L-03-student-submit", "/student/submit"],
      ["L-04-student-grades", "/student/grades"],
      ["L-05-student-attendance", "/student/attendance"],
      ["L-06-student-clinic", "/student/clinic"],
      ["L-07-student-more", "/student/more"],
      ["L-08-student-notices", "/student/notices"],
      ["H-04-student-community", "/student/community"],
      ["I-03-student-fees-route", "/student/fees"],
    ];

    for (const [name, path] of studentPairs) {
      await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 30000 });
      await shot(page, name);
    }

    await expect(page.locator("body")).toBeVisible();
  });
});
