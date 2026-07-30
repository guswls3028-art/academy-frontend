import { readFile } from "fs/promises";
import path from "path";
import type { Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

import { expect, test } from "../fixtures/strictTest";
import { getBaseUrl } from "../helpers/auth";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const LECTURE_ID = 990101;
const SESSION_ID = 990102;
const DENSE_EXAM_TITLE = "매우 긴 한국어 시험 제목으로 줄바꿈과 페이지 경계를 확인하는 누적 종합 평가 내용을 학부모에게 충분히 설명하는 평가";

type InstallApiOptions = {
  denseReport?: boolean;
  primaryColor?: string;
};

function isLocalBaseUrl(url: string) {
  return /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(url);
}

function createLocalJwt() {
  const encode = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({
    exp: now + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

const scoreRows = [
  {
    enrollment_id: 9101,
    student_id: 7001,
    student_name: "김서윤",
    profile_photo_url: null,
    lecture_title: "중등 수학 심화",
    lecture_color: "#2563eb",
    lecture_chip_label: "수심",
    exams: [{
      exam_id: 3101,
      title: "방정식 단원평가",
      pass_score: 70,
      block: {
        score: 82,
        max_score: 100,
        passed: true,
        clinic_required: false,
        objective_score: 62,
        subjective_score: 20,
        remediated: false,
        final_pass: true,
        achievement: "PASS",
        meta: null,
      },
      items: [
        { question_id: 4928, question_kind: "choice", score: 4, max_score: 4 },
        { question_id: 4929, question_number: 2, question_kind: "choice", score: 0, max_score: 4 },
        { question_id: 4930, question_number: 3, question_kind: "essay", score: 3, max_score: 6 },
      ],
      attempt_count: 1,
      attempts: [],
    }],
    homeworks: [{
      homework_id: 4101,
      title: "방정식 오답 과제",
      block: {
        score: 90,
        max_score: 100,
        passed: true,
        clinic_required: false,
        achievement: "PASS",
        meta: null,
      },
      attempt_count: 1,
    }],
    updated_at: "2026-07-28T10:00:00+09:00",
    clinic_required: false,
    progress_completed: false,
    progress_status: "in_progress",
  },
  {
    enrollment_id: 9102,
    student_id: 7002,
    student_name: "박도윤",
    profile_photo_url: null,
    lecture_title: "중등 수학 심화",
    lecture_color: "#2563eb",
    lecture_chip_label: "수심",
    exams: [{
      exam_id: 3101,
      title: "방정식 단원평가",
      pass_score: 70,
      block: {
        score: 64,
        max_score: 100,
        passed: false,
        clinic_required: true,
        objective_score: 52,
        subjective_score: 12,
        remediated: false,
        final_pass: false,
        achievement: "FAIL",
        meta: null,
      },
      items: [
        { question_id: 4928, question_number: 1, question_kind: "choice", score: 4, max_score: 4 },
        { question_id: 4929, question_number: 2, question_kind: "choice", score: 0, max_score: 4 },
      ],
      attempt_count: 2,
      attempts: [],
    }],
    homeworks: [],
    updated_at: "2026-07-28T10:00:00+09:00",
    clinic_required: true,
    progress_completed: false,
    progress_status: "in_progress",
  },
];

function denseScoreRows() {
  return scoreRows.map((row, rowIndex) => rowIndex === 0 ? ({
    ...row,
    exams: row.exams.map((exam) => ({
      ...exam,
      title: DENSE_EXAM_TITLE,
      items: Array.from({ length: 16 }, (_, index) => ({
        question_id: 6000 + index,
        question_number: index + 1,
        question_kind: index % 4 === 0 ? "essay" : "choice",
        score: index % 2 === 0 ? 4 : 0,
        max_score: 4,
      })),
    })),
  }) : row);
}

function studentGrades(studentId: number) {
  const isFirst = studentId === 7001;
  const percentages = isFirst ? [70, 76, 82] : [72, 68, 64];
  return {
    exams: percentages.map((score, index) => ({
      exam_id: 3000 + index,
      enrollment_id: isFirst ? 9101 : 9102,
      title: `누적평가 ${index + 1}`,
      total_score: score,
      max_score: 100,
      is_pass: score >= 70,
      achievement: score >= 70 ? "PASS" : "FAIL",
      final_pass: score >= 70,
      retake_count: index === 2 && !isFirst ? 1 : 0,
      session_id: 990000 + index,
      session_title: `${index + 1}차시`,
      session_order: index + 1,
      session_regular_order: index + 1,
      session_date: `2026-07-${String(10 + index).padStart(2, "0")}`,
      lecture_id: LECTURE_ID,
      lecture_title: "중등 수학 심화",
      lecture_color: "#2563eb",
      lecture_chip_label: "수심",
      recorded_at: `2026-07-${String(10 + index).padStart(2, "0")}T18:00:00+09:00`,
    })),
    homeworks: [],
    exam_trend: percentages.map((score, index) => ({
      round_index: index + 1,
      exam_id: 3000 + index,
      enrollment_id: isFirst ? 9101 : 9102,
      title: `누적평가 ${index + 1}`,
      score,
      max_score: 100,
      score_pct: score,
      recorded_at: `2026-07-${String(10 + index).padStart(2, "0")}T18:00:00+09:00`,
      session_id: 990000 + index,
      session_title: `${index + 1}차시`,
      session_order: index + 1,
      session_regular_order: index + 1,
      session_date: `2026-07-${String(10 + index).padStart(2, "0")}`,
      lecture_id: LECTURE_ID,
      lecture_title: "중등 수학 심화",
      lecture_color: "#2563eb",
      lecture_chip_label: "수심",
      retake_count: index === 2 && !isFirst ? 1 : 0,
      archived: false,
    })),
    exam_summary: {
      scored_count: 3,
      average_score_pct: isFirst ? 76 : 68,
      latest_score_pct: isFirst ? 82 : 64,
      change_pct_points: isFirst ? 6 : -4,
      best_score_pct: isFirst ? 82 : 72,
    },
  };
}

function denseStudentGrades(studentId: number) {
  const isFirst = studentId === 7001;
  const scores = Array.from({ length: 9 }, (_, index) => 60 + index);
  return {
    exams: scores.map((score, index) => ({
      exam_id: 5000 + index,
      enrollment_id: isFirst ? 9101 : 9102,
      title: `${DENSE_EXAM_TITLE} ${index + 1}`,
      total_score: score,
      max_score: 100,
      is_pass: score >= 70,
      achievement: score >= 70 ? "PASS" : "FAIL",
      final_pass: score >= 70,
      retake_count: 0,
      session_id: 995000 + index,
      session_title: `${index + 1}차시 ${DENSE_EXAM_TITLE}`,
      session_order: index + 1,
      session_regular_order: index + 1,
      session_date: `2026-07-${String(10 + index).padStart(2, "0")}`,
      lecture_id: LECTURE_ID,
      lecture_title: "중등 수학 심화",
      lecture_color: "#2563eb",
      lecture_chip_label: "수심",
      recorded_at: `2026-07-${String(10 + index).padStart(2, "0")}T18:00:00+09:00`,
    })),
    homeworks: [],
    exam_trend: scores.slice(-4).map((score, index) => ({
      round_index: index + 1,
      exam_id: 5005 + index,
      enrollment_id: isFirst ? 9101 : 9102,
      title: `${DENSE_EXAM_TITLE} ${index + 6}`,
      score,
      max_score: 100,
      score_pct: score,
      recorded_at: `2026-07-${String(15 + index).padStart(2, "0")}T18:00:00+09:00`,
      session_id: 995005 + index,
      session_title: `${index + 6}차시`,
      session_order: index + 6,
      session_regular_order: index + 6,
      session_date: `2026-07-${String(15 + index).padStart(2, "0")}`,
      lecture_id: LECTURE_ID,
      lecture_title: "중등 수학 심화",
      lecture_color: "#2563eb",
      lecture_chip_label: "수심",
      retake_count: 0,
      archived: false,
    })),
    exam_summary: {
      scored_count: 9,
      average_score_pct: 64,
      latest_score_pct: 68,
      change_pct_points: 1,
      best_score_pct: 68,
    },
  };
}

async function installApi(page: Page, options: InstallApiOptions = {}) {
  const baseUrl = getBaseUrl("admin");
  test.skip(!isLocalBaseUrl(baseUrl), "개인 성적표 route-mock 검증은 로컬 dev 서버 전용");
  const token = createLocalJwt();
  const corsHeaders = {
    "access-control-allow-origin": baseUrl,
    "access-control-allow-headers": "authorization,content-type,x-client,x-client-version,x-tenant-code",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,OPTIONS",
  };
  const activeScoreRows = options.denseReport ? denseScoreRows() : scoreRows;
  let studentGradesRequestCount = 0;

  await page.route("**/version.json?*", async (route) => {
    await route.fulfill({ status: 404, contentType: "text/plain", body: "" });
  });
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const url = new URL(request.url());
    const pathname = url.pathname;
    const fulfill = (json: unknown) => route.fulfill({
      status: 200,
      headers: corsHeaders,
      contentType: "application/json",
      json,
    });

    if (pathname.endsWith("/token/refresh/")) {
      await fulfill({ access: token, refresh: `${token}-refresh` });
      return;
    }
    if (pathname.endsWith("/core/program/")) {
      await fulfill({
        tenantCode: "hakwonplus",
        isPlatformAdmin: true,
        display_name: "학원플러스 테스트",
        ui_config: {
          logo_url: "/tenants/hakwonplus/icon.png",
          primary_color: options.primaryColor ?? "#2563EB",
        },
        feature_flags: {},
        is_active: true,
      });
      return;
    }
    if (pathname.endsWith("/core/me/")) {
      await fulfill({
        id: 12,
        username: "report-admin",
        name: "관리자",
        is_staff: true,
        is_superuser: true,
        tenantRole: "admin",
        must_change_password: false,
      });
      return;
    }
    if (pathname.endsWith(`/lectures/lectures/${LECTURE_ID}/`)) {
      await fulfill({ id: LECTURE_ID, title: "중등 수학 심화", color: "#2563eb", chip_label: "수심" });
      return;
    }
    if (pathname.endsWith(`/lectures/sessions/${SESSION_ID}/`)) {
      await fulfill({ id: SESSION_ID, lecture: LECTURE_ID, order: 4, title: "4차시", date: "2026-07-28" });
      return;
    }
    if (pathname.endsWith("/lectures/attendance/")) {
      await fulfill({
        count: 2,
        next: null,
        previous: null,
        page_size: 500,
        results: activeScoreRows.map((row, index) => ({
          id: 8000 + index,
          enrollment_id: row.enrollment_id,
          student_id: row.student_id,
          student_name: row.student_name,
          status: index === 0 ? "PRESENT" : "LATE",
        })),
      });
      return;
    }
    if (pathname.endsWith(`/results/admin/sessions/${SESSION_ID}/scores/`)) {
      await fulfill({
        meta: {
          session_title: "4차시",
          lecture_title: "중등 수학 심화",
          lecture_id: LECTURE_ID,
          exams: [{
            exam_id: 3101,
            title: "방정식 단원평가",
            pass_score: 70,
            max_score: 100,
            display_order: 1,
            questions: options.denseReport
              ? Array.from({ length: 16 }, (_, index) => ({
                  question_id: 6000 + index,
                  number: index + 1,
                  max_score: 4,
                  kind: index % 4 === 0 ? "essay" : "choice",
                }))
              : [
                  { question_id: 4928, number: 1, max_score: 4, kind: "choice" },
                  { question_id: 4929, number: 2, max_score: 4, kind: "choice" },
                  { question_id: 4930, number: 3, max_score: 6, kind: "essay" },
                ],
          }],
          homeworks: [{
            homework_id: 4101,
            title: "방정식 오답 과제",
            unit: null,
            max_score: 100,
            display_order: 1,
          }],
        },
        rows: activeScoreRows,
      });
      return;
    }
    if (pathname.endsWith("/results/admin/student-grades/")) {
      studentGradesRequestCount += 1;
      const studentId = Number(url.searchParams.get("student_id"));
      await fulfill(options.denseReport ? denseStudentGrades(studentId) : studentGrades(studentId));
      return;
    }
    if (pathname.endsWith(`/results/admin/sessions/${SESSION_ID}/score-draft/`)) {
      await fulfill({ changes: [] });
      return;
    }
    if (pathname.endsWith("/results/admin/clinic-targets/") || pathname.endsWith("/staffs/currently-working/")) {
      await fulfill([]);
      return;
    }
    await fulfill({ count: 0, next: null, previous: null, results: [] });
  });

  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, token);

  return {
    getStudentGradesRequestCount: () => studentGradesRequestCount,
  };
}

test.describe("개인 성적표", () => {
  test("학생 전환, 1·2쪽 미리보기, 실제 PDF 다운로드", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1366, height: 900 });
    const apiTracker = await installApi(page);
    const baseUrl = getBaseUrl("admin");
    await page.goto(`${baseUrl}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`, { waitUntil: "load" });

    await expect(page.getByRole("button", { name: "추가 기능" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "추가 기능" }).click();
    await page.getByRole("button", { name: "개인 성적표", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("개인 성적표", { exact: true })).toBeVisible();
    const firstFrame = page.frameLocator('iframe[title="김서윤 개인 성적표 미리보기"]');
    await expect(firstFrame.locator(".student-report-page")).toHaveCount(2);
    await expect(firstFrame.locator("h1")).toHaveText("김서윤");
    await expect(firstFrame.locator("body")).toContainText("중등 수학 심화");
    await expect(firstFrame.getByText("최근 4회 학습 흐름", { exact: true })).toBeVisible();
    await expect(firstFrame.locator(".report-topline").first()).toHaveCSS("background-color", "rgb(37, 99, 235)");
    await expect(firstFrame.locator(".report-brand-logo").first()).toHaveAttribute("src", "/tenants/hakwonplus/icon.png");
    await expect(firstFrame.locator(".assessment-table-head")).toContainText("현재 평가");
    await expect(firstFrame.locator(".assessment-table-head")).toHaveCSS("background-color", "rgb(234, 242, 255)");
    await expect(firstFrame.locator(".assessment-title").first()).toContainText("객관 62점");
    await expect(firstFrame.locator(".assessment-title strong").first()).toHaveCSS("white-space", "normal");
    await expect(firstFrame.locator("body")).not.toContainText("9101");
    await expect(firstFrame.locator(".item-table")).toContainText("1번");
    await expect(firstFrame.locator("body")).not.toContainText("4928");
    await expect(firstFrame.locator(".report-footer")).toContainText(["1 / 2", "2 / 2"]);
    await expect(dialog.getByText("학원플러스 테스트 디자인", { exact: true })).toBeVisible();

    const secondGradesResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname.endsWith("/results/admin/student-grades/")
        && url.searchParams.get("student_id") === "7002";
    });
    await dialog.getByRole("button", { name: /박도윤/ }).click();
    await secondGradesResponse;
    const secondFrame = page.frameLocator('iframe[title="박도윤 개인 성적표 미리보기"]');
    await expect(secondFrame.locator("h1")).toHaveText("박도윤");
    await expect(secondFrame.locator(".flow-metric").first()).toContainText("64%");
    await expect(secondFrame.locator("body")).not.toContainText("김서윤");

    await dialog.getByRole("button", { name: "요약 1쪽" }).click();
    await expect(secondFrame.locator(".student-report-page")).toHaveCount(1);
    await expect(secondFrame.locator(".report-footer")).toContainText("1 / 1");
    await dialog.getByRole("button", { name: "상세 2쪽" }).click();
    await expect(secondFrame.locator(".student-report-page")).toHaveCount(2);
    await secondFrame.locator('[data-page="1"]').screenshot({
      path: testInfo.outputPath("individual-score-report-page-1.png"),
    });
    await page.screenshot({
      path: testInfo.outputPath("individual-score-report-preview.png"),
      fullPage: false,
    });
    await secondFrame.locator('[data-page="2"]').screenshot({
      path: testInfo.outputPath("individual-score-report-page-2.png"),
    });

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 90_000 }),
      dialog.getByRole("button", { name: "개인 성적표 PDF" }).click(),
    ]);
    expect(download.suggestedFilename()).toContain("박도윤");
    const outputPath = testInfo.outputPath("student-score-report.pdf");
    await download.saveAs(outputPath);
    const pdfBytes = await readFile(path.resolve(outputPath));
    expect(pdfBytes.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    const pdf = await PDFDocument.load(pdfBytes);
    expect(pdf.getPageCount()).toBe(2);
    expect(pdfBytes.byteLength).toBeLessThan(2_000_000);

    await page.setViewportSize({ width: 1100, height: 800 });
    await expect(dialog.locator(".student-score-report-students")).toBeVisible();
    expect(await dialog.locator(".student-score-report-preview__scroll").evaluate((element) =>
      element.scrollWidth <= element.clientWidth + 1
    )).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("individual-score-report-preview-1100.png"),
      fullPage: false,
    });

    const requestCountBeforeReopen = apiTracker.getStudentGradesRequestCount();
    await dialog.getByRole("button", { name: "닫기" }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: "추가 기능" }).click();
    await page.getByRole("button", { name: "개인 성적표", exact: true }).click();
    await expect.poll(() => apiTracker.getStudentGradesRequestCount()).toBeGreaterThan(requestCountBeforeReopen);
    await expect(page.getByRole("dialog").getByText("현재 저장된 성적 기준", { exact: true })).toBeVisible();
  });

  test("390px 모바일에서 학생 전환과 읽기용 재배치", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await installApi(page);
    const baseUrl = getBaseUrl("admin");
    await page.goto(`${baseUrl}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`, { waitUntil: "load" });

    await expect(page.getByRole("button", { name: "추가 기능" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "추가 기능" }).click();
    await page.getByRole("button", { name: "개인 성적표", exact: true }).click();

    const dialog = page.getByRole("dialog");
    const mobileStudentSelect = dialog.getByRole("combobox", { name: "성적표 학생 선택" });
    await expect(mobileStudentSelect).toBeVisible();
    await expect(dialog.locator(".student-score-report-students")).toBeHidden();

    const frame = page.frameLocator('iframe[title="김서윤 개인 성적표 미리보기"]');
    await expect(frame.locator(".student-report-page")).toHaveCount(2);
    await expect(frame.locator(".current-grid")).toHaveCSS("grid-template-columns", /^\d+(?:\.\d+)?px$/);
    await expect(frame.locator(".history-table thead")).toBeHidden();
    expect(await frame.locator("html").evaluate((element) =>
      element.scrollWidth <= element.clientWidth + 1
    )).toBe(true);
    expect(await frame.locator(".student-report-page").first().evaluate((element) =>
      element.scrollWidth <= element.clientWidth + 1
    )).toBe(true);

    await mobileStudentSelect.selectOption("9102");
    const secondFrame = page.frameLocator('iframe[title="박도윤 개인 성적표 미리보기"]');
    await expect(secondFrame.locator("h1")).toHaveText("박도윤");
    await expect(secondFrame.locator(".flow-metric").first()).toContainText("64%");
    await expect(dialog.getByRole("button", { name: "개인 성적표 PDF" })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("individual-score-report-preview-390.png"),
      fullPage: false,
    });
    await secondFrame.locator('[data-page="1"]').screenshot({
      path: testInfo.outputPath("individual-score-report-mobile-page-1.png"),
    });
    await secondFrame.locator('[data-page="2"]').screenshot({
      path: testInfo.outputPath("individual-score-report-mobile-page-2.png"),
    });
    await dialog.locator(".student-score-report-preview__scroll").evaluate((element) => {
      element.scrollTo({ top: 0 });
    });
  });

  test("긴 한국어·16문항은 3쪽으로 분리하고 밝은 브랜드색 대비를 보장", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1366, height: 900 });
    await installApi(page, { denseReport: true, primaryColor: "#f97316" });
    const baseUrl = getBaseUrl("admin");
    await page.goto(`${baseUrl}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`, { waitUntil: "load" });

    await expect(page.getByRole("button", { name: "추가 기능" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "추가 기능" }).click();
    await page.getByRole("button", { name: "개인 성적표", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "상세 3쪽" })).toBeVisible();
    const frame = page.frameLocator('iframe[title="김서윤 개인 성적표 미리보기"]');
    await expect(frame.locator(".student-report-page")).toHaveCount(3);
    await expect(frame.locator(".report-topline").first()).toHaveCSS("background-color", "rgb(249, 115, 22)");
    await expect(frame.locator(".report-topline").first()).toHaveCSS("color", "rgb(23, 32, 51)");
    await expect(dialog.getByRole("button", { name: "상세 3쪽" })).toHaveCSS("color", "rgb(23, 32, 51)");

    const pageFits = await frame.locator(".student-report-page").evaluateAll((pages) => pages.map((page) => {
      const footer = page.querySelector<HTMLElement>(".report-footer");
      const sections = Array.from(page.querySelectorAll<HTMLElement>(":scope > .section"));
      const contentBottom = sections.reduce(
        (bottom, section) => Math.max(bottom, section.getBoundingClientRect().bottom),
        0,
      );
      return footer ? contentBottom <= footer.getBoundingClientRect().top + 1 : false;
    }));
    expect(pageFits).toEqual([true, true, true]);
    await expect(frame.locator('[data-page="2"] .item-table')).toHaveCount(0);
    await expect(frame.locator('[data-page="3"] .item-table tbody tr')).toHaveCount(16);

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 90_000 }),
      dialog.getByRole("button", { name: "개인 성적표 PDF" }).click(),
    ]);
    const outputPath = testInfo.outputPath("student-score-report-dense.pdf");
    await download.saveAs(outputPath);
    const pdfBytes = await readFile(path.resolve(outputPath));
    const pdf = await PDFDocument.load(pdfBytes);
    expect(pdf.getPageCount()).toBe(3);
    expect(pdfBytes.byteLength).toBeLessThan(3_000_000);
    await page.screenshot({
      path: testInfo.outputPath("individual-score-report-dense-preview.png"),
      fullPage: false,
    });
  });
});
