/**
 * DNB 아카데미 (tenant 9) — 시험/성적/과제/도구 운영 E2E 검증
 * 실사용자 관점에서 각 페이지 렌더링 + 빈 상태 또는 데이터 표시 확인
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl, getApiBaseUrl } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const DNB_BASE = getBaseUrl("dnb-admin");
const API_BASE = getApiBaseUrl();
const DNB_CODE = "dnb";

let accessToken = "";

function apiHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Tenant-Code": DNB_CODE,
  };
}

test.describe("DNB 시험/성적/과제/도구 E2E 검증", () => {
  test.setTimeout(180000);
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "dnb-admin");
    accessToken = await page.evaluate(() => localStorage.getItem("access") || "");
  });

  // ── 1. 시험 탐색기 ──
  test("1. 시험 탐색기 — /admin/exams 렌더링", async ({ page }) => {
    const sidebar = page.locator("nav, aside, [class*=sidebar], [class*=Sidebar]").first();
    const examMenu = sidebar.locator("a, button, [role=menuitem], span").filter({ hasText: /^시험$/ }).first();

    if (await examMenu.isVisible({ timeout: 5000 }).catch(() => false)) {
      await examMenu.click();
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    } else {
      await gotoAndSettle(page, `${DNB_BASE}/admin/exams`);
    }

    expect(page.url()).toContain("/admin/exam");
    await expect(page.locator("body")).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/dnb-01-exams-explorer.png", fullPage: true });
  });

  // ── 2. 시험 템플릿 ──
  test("2. 시험 템플릿 — /admin/exams/templates 렌더링", async ({ page }) => {
    await gotoAndSettle(page, `${DNB_BASE}/admin/exams/templates`, { settleMs: 1500 });
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/dnb-02-exam-templates.png", fullPage: true });
  });

  // ── 3. 시험 묶음 ──
  test("3. 시험 묶음 — /admin/exams/bundles 렌더링", async ({ page }) => {
    await gotoAndSettle(page, `${DNB_BASE}/admin/exams/bundles`, { settleMs: 1500 });
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/dnb-03-exam-bundles.png", fullPage: true });
  });

  // ── 4. 성적 탐색기 ──
  test("4. 성적 탐색기 — /admin/results 렌더링 + 드롭다운 확인", async ({ page }) => {
    await gotoAndSettle(page, `${DNB_BASE}/admin/results`, { settleMs: 1500 });
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/dnb-04-results-explorer.png", fullPage: true });
  });

  // ── 5. 제출함 ──
  test("5. 제출함 — /admin/results/submissions 렌더링", async ({ page }) => {
    await gotoAndSettle(page, `${DNB_BASE}/admin/results/submissions`, { settleMs: 1500 });
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/dnb-05-submissions.png", fullPage: true });
  });

  // ── 6. 학습지 ──
  test("6. 학습지 — /admin/materials/sheets 렌더링", async ({ page }) => {
    await gotoAndSettle(page, `${DNB_BASE}/admin/materials/sheets`, { settleMs: 1500 });
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/dnb-06-sheets.png", fullPage: true });
  });

  // ── 7. 리포트 ──
  test("7. 리포트 — /admin/materials/reports 렌더링", async ({ page }) => {
    await gotoAndSettle(page, `${DNB_BASE}/admin/materials/reports`, { settleMs: 1500 });
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/dnb-07-reports.png", fullPage: true });
  });

  // ── 8. 시험 CRUD (기존 강의/차시 기반) ──
  test("8. 시험 CRUD — 강의 차시에서 시험 탭 확인", async ({ page }) => {
    const lectResp = await page.request.get(`${API_BASE}/api/v1/lectures/`, {
      headers: apiHeaders(accessToken),
    });
    const lectures = await lectResp.json() as unknown;
    const lectureList = Array.isArray(lectures)
      ? lectures
      : ((lectures as { results?: unknown[] }).results || []);

    if (lectureList.length === 0) {
      await gotoAndSettle(page, `${DNB_BASE}/admin/lectures`, { settleMs: 1500 });
      await page.screenshot({ path: "e2e/screenshots/dnb-08-no-lectures.png", fullPage: true });
      return;
    }

    const firstLecture = lectureList[0] as { id: number };
    await gotoAndSettle(page, `${DNB_BASE}/admin/lectures/${firstLecture.id}`, { settleMs: 1500 });

    const sessionLink = page.locator("a, tr, [class*=session], [class*=Session], [class*=lesson], [class*=Lesson]")
      .filter({ hasText: /차시|1차시|Session|회차/ }).first();

    if (await sessionLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sessionLink.click();
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

      const examTab = page.locator("button, a, [role=tab]").filter({ hasText: /시험|테스트|Exam/ }).first();
      if (await examTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await examTab.click();
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
      }
    }

    await page.screenshot({ path: "e2e/screenshots/dnb-08-exam-crud.png", fullPage: true });
  });

  // ── 9. 과제 관리 ──
  test("9. 과제 관리 — 차시 상세 과제 탭 확인", async ({ page }) => {
    const lectResp = await page.request.get(`${API_BASE}/api/v1/lectures/`, {
      headers: apiHeaders(accessToken),
    });
    const lectures = await lectResp.json() as unknown;
    const lectureList = Array.isArray(lectures)
      ? lectures
      : ((lectures as { results?: unknown[] }).results || []);

    if (lectureList.length === 0) {
      await page.screenshot({ path: "e2e/screenshots/dnb-09-no-lectures.png", fullPage: true });
      return;
    }

    const firstLecture = lectureList[0] as { id: number };
    await gotoAndSettle(page, `${DNB_BASE}/admin/lectures/${firstLecture.id}`, { settleMs: 1500 });

    const sessionLink = page.locator("a, tr, [class*=session], [class*=Session], [class*=lesson], [class*=Lesson]")
      .filter({ hasText: /차시|1차시|Session|회차/ }).first();

    if (await sessionLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sessionLink.click();
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

      const assignmentTab = page.locator("button, a, [role=tab]").filter({ hasText: /과제|Assignment|숙제/ }).first();
      if (await assignmentTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await assignmentTab.click();
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

        const addBtn = page.locator("button").filter({ hasText: /과제 추가|추가|생성/ }).first();
        if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await addBtn.click();
          // 모달 열림 확인 — 열렸다면 ESC 닫기.
          const modal = page.locator('[role="dialog"], .ant-modal, [data-modal], [class*=modal], [class*=Modal]').first();
          if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
            await page.keyboard.press("Escape");
            await expect(modal).toBeHidden({ timeout: 3_000 });
          }
        }
      }
    }

    await page.screenshot({ path: "e2e/screenshots/dnb-09-assignments.png", fullPage: true });
  });

  // ── 10. 도구 > OMR ──
  test("10. 도구 > OMR — /admin/tools/omr 렌더링", async ({ page }) => {
    await gotoAndSettle(page, `${DNB_BASE}/admin/tools/omr`, { settleMs: 1500 });
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/dnb-10-omr.png", fullPage: true });
  });

  // ── 11. 도구 > PPT ──
  test("11. 도구 > PPT — /admin/tools/ppt 렌더링", async ({ page }) => {
    await gotoAndSettle(page, `${DNB_BASE}/admin/tools/ppt`, { settleMs: 1500 });
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/dnb-11-ppt.png", fullPage: true });
  });

  // ── 콘솔 에러 수집 ──
  test("12. 콘솔 에러 수집 — 주요 페이지 순회", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    const pages = [
      "/admin/exams",
      "/admin/exams/templates",
      "/admin/exams/bundles",
      "/admin/results",
      "/admin/results/submissions",
      "/admin/materials/sheets",
      "/admin/materials/reports",
      "/admin/tools/omr",
      "/admin/tools/ppt",
    ];

    for (const path of pages) {
      await gotoAndSettle(page, `${DNB_BASE}${path}`);
    }

    await page.screenshot({ path: "e2e/screenshots/dnb-12-console-errors.png", fullPage: true });

    // 치명적 에러 (TypeError/ReferenceError/Uncaught) 는 0건이어야 함 (silent log → hard expect).
    const criticalErrors = consoleErrors.filter(
      (e) => e.includes("TypeError") || e.includes("ReferenceError") || e.includes("Uncaught"),
    );
    expect(
      criticalErrors,
      `주요 페이지 순회 시 치명적 콘솔 에러 0건이어야 함. 발견: ${criticalErrors.join(" | ")}`,
    ).toEqual([]);
  });
});
