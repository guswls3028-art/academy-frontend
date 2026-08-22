import { readFile } from "fs/promises";
import { expect, test, type Page } from "./fixtures/strictTest";
import { getBaseUrl } from "./helpers/auth";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "./helpers/localAuthApiStubs";

const LECTURE_ID = 990001;
const SESSION_ID = 990002;

function isLocalBaseUrl(url: string) {
  return /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(url);
}

function createLocalJwt() {
  const encode = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ exp: now + 3600, tenant_code: "hakwonplus", user_id: 12 })}.sig`;
}

const examBlock = (passed: boolean | null, score: number | null) => ({
  score,
  max_score: 100,
  passed,
  clinic_required: false,
  is_locked: false,
  lock_reason: null,
  objective_score: score,
  subjective_score: 0,
  remediated: false,
  final_pass: passed,
  achievement: passed === false ? "FAIL" : null,
  meta: score == null ? { status: "NOT_SUBMITTED" } : null,
});

const homeworkBlock = (passed: boolean | null, score: number | null) => ({
  score,
  max_score: 100,
  passed,
  clinic_required: false,
  is_locked: false,
  lock_reason: null,
  meta: score == null ? { status: "NOT_SUBMITTED" } : null,
});

const scoreRows = [
  {
    enrollment_id: 9101,
    student_id: 9101,
    student_name: "현장둘다",
    exams: [{ exam_id: 3101, title: "주간평가", pass_score: 70, block: examBlock(null, null), clinic_link_id: 7101, items: [], attempts: [] }],
    homeworks: [{ homework_id: 4101, title: "오늘 과제", block: homeworkBlock(null, null), clinic_link_id: 7201 }],
    updated_at: new Date().toISOString(),
    clinic_required: true,
    progress_completed: false,
    progress_status: "in_progress",
  },
  {
    enrollment_id: 9102,
    student_id: 9102,
    student_name: "현장시험",
    exams: [{ exam_id: 3101, title: "주간평가", pass_score: 70, block: examBlock(false, 42), clinic_link_id: 7102, items: [], attempts: [] }],
    homeworks: [{ homework_id: 4101, title: "오늘 과제", block: homeworkBlock(true, 100), clinic_link_id: null }],
    updated_at: new Date().toISOString(),
    clinic_required: true,
    progress_completed: false,
    progress_status: "in_progress",
  },
  {
    enrollment_id: 9103,
    student_id: 9103,
    student_name: "현장과제",
    exams: [{ exam_id: 3101, title: "주간평가", pass_score: 70, block: examBlock(true, 90), clinic_link_id: null, items: [], attempts: [] }],
    homeworks: [{ homework_id: 4101, title: "오늘 과제", block: homeworkBlock(null, null), clinic_link_id: 7203 }],
    updated_at: new Date().toISOString(),
    clinic_required: true,
    progress_completed: false,
    progress_status: "in_progress",
  },
  {
    enrollment_id: 9104,
    student_id: 9104,
    student_name: "영상대상",
    exams: [{ exam_id: 3101, title: "주간평가", pass_score: 70, block: examBlock(false, 30), clinic_link_id: 7104, items: [], attempts: [] }],
    homeworks: [],
    updated_at: new Date().toISOString(),
    clinic_required: true,
    progress_completed: false,
    progress_status: "in_progress",
  },
  {
    enrollment_id: 9105,
    student_id: 9105,
    student_name: "서버해소",
    exams: [{ exam_id: 3101, title: "주간평가", pass_score: 70, block: examBlock(false, 20), clinic_link_id: null, items: [], attempts: [] }],
    homeworks: [],
    updated_at: new Date().toISOString(),
    clinic_required: false,
    progress_completed: false,
    progress_status: "in_progress",
  },
];

async function openClinicPreview(page: Page, options: { failFirstAttendance?: boolean } = {}) {
  const baseUrl = getBaseUrl("admin");
  test.skip(!isLocalBaseUrl(baseUrl), "클리닉 PDF 회귀 검증은 로컬 route mock 전용");

  const token = createLocalJwt();
  let attendanceAttempts = 0;
  let allowAttendanceSuccess = !options.failFirstAttendance;
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  await page.route("**/version.json?*", async (route) => {
    await route.fulfill({ status: 404, contentType: "text/plain", body: "" });
  });
  const corsHeaders = {
    "access-control-allow-origin": baseUrl,
    "access-control-allow-headers": "authorization,content-type,x-client,x-client-version,x-tenant-code",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,OPTIONS",
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith("/token/refresh/")) {
      await route.fulfill({ status: 200, headers: corsHeaders, contentType: "application/json", json: { access: token, refresh: `${token}-refresh` } });
      return;
    }
    if (pathname.endsWith("/core/program/")) {
      await route.fulfill({ status: 200, headers: corsHeaders, contentType: "application/json", json: { tenantCode: "hakwonplus", isPlatformAdmin: true, display_name: "학원플러스", ui_config: {}, feature_flags: {}, is_active: true } });
      return;
    }
    if (pathname.endsWith("/core/me/")) {
      await route.fulfill({ status: 200, headers: corsHeaders, contentType: "application/json", json: { id: 12, username: "t1_admin97", name: "관리자", is_staff: true, is_superuser: true, tenantRole: "admin", must_change_password: false } });
      return;
    }
    if (pathname.endsWith(`/lectures/lectures/${LECTURE_ID}/`)) {
      await route.fulfill({ status: 200, headers: corsHeaders, contentType: "application/json", json: { id: LECTURE_ID, title: "테스트 강의" } });
      return;
    }
    if (pathname.endsWith(`/lectures/sessions/${SESSION_ID}/`)) {
      await route.fulfill({ status: 200, headers: corsHeaders, contentType: "application/json", json: { id: SESSION_ID, lecture: LECTURE_ID, order: 6, regular_order: 6, title: "6차시" } });
      return;
    }
    if (pathname.endsWith("/lectures/attendance/")) {
      attendanceAttempts += 1;
      if (!allowAttendanceSuccess) {
        await route.fulfill({ status: 503, headers: corsHeaders, contentType: "application/json", json: { detail: "temporary" } });
        return;
      }
      const statuses = ["PRESENT", "LATE", "SUPPLEMENT", "ONLINE", "PRESENT"];
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        json: {
          count: scoreRows.length,
          next: null,
          previous: null,
          page_size: 500,
          results: scoreRows.map((row, index) => ({
            id: 8000 + index,
            enrollment_id: row.enrollment_id,
            student_id: row.student_id,
            name: row.student_name,
            status: statuses[index],
          })),
        },
      });
      return;
    }
    if (pathname.endsWith(`/results/admin/sessions/${SESSION_ID}/scores/`)) {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        json: {
          meta: {
            session_title: "6차시",
            lecture_title: "테스트 강의",
            lecture_id: LECTURE_ID,
            exams: [{ exam_id: 3101, title: "주간평가", pass_score: 70, max_score: 100, display_order: 1, questions: [] }],
            homeworks: [{ homework_id: 4101, title: "오늘 과제", unit: null, grading_mode: "COMPLETION", max_score: 100, display_order: 1 }],
          },
          rows: scoreRows,
        },
      });
      return;
    }
    if (pathname.endsWith(`/results/admin/sessions/${SESSION_ID}/score-draft/`)) {
      await route.fulfill({ status: 200, headers: corsHeaders, contentType: "application/json", json: { changes: [] } });
      return;
    }
    if (pathname.endsWith("/results/admin/clinic-targets/") || pathname.endsWith("/staffs/currently-working/")) {
      await route.fulfill({ status: 200, headers: corsHeaders, contentType: "application/json", json: [] });
      return;
    }
    await route.fulfill({ status: 200, headers: corsHeaders, contentType: "application/json", json: { count: 0, next: null, previous: null, results: [] } });
  });
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, token);

  await page.goto(`${baseUrl}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "성적 도구" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "성적 도구" }).click();
  await page.locator("button").filter({ hasText: "클리닉 대상" }).first().click();
  return {
    allowAttendanceSuccess: () => { allowAttendanceSuccess = true; },
    getAttendanceAttempts: () => attendanceAttempts,
  };
}

test.describe("성적표 공식 클리닉 대상 PDF", () => {
  test("ClinicLink 원인만 분류하고 영상 학생을 제외한 PDF를 내려받는다", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await openClinicPreview(page);

    const frame = page.frameLocator('iframe[title="클리닉 대상자 미리보기"]');
    await expect(frame.locator(".section-header.both")).toContainText("(1명)", { timeout: 10_000 });
    await expect(frame.locator(".section-header.exam")).toContainText("(1명)");
    await expect(frame.locator(".section-header.hw")).toContainText("(1명)");
    await expect(frame.locator(".columns")).toContainText("현장둘다");
    await expect(frame.locator(".columns")).toContainText("현장시험");
    await expect(frame.locator(".columns")).toContainText("현장과제");
    await expect(frame.locator(".columns")).not.toContainText("영상대상");
    await expect(frame.locator(".columns")).not.toContainText("서버해소");
    await expect(frame.locator(".footer-left")).toContainText("클리닉 대상 3명 / 전체 출석 4명");
    await page.screenshot({ path: testInfo.outputPath("clinic-preview-1366.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    // 데스크톱/모바일 점수 화면이 서로 다른 셸이어서 전환 시 모달이 닫힌다.
    await page.getByRole("button", { name: "성적 도구" }).click();
    await page.locator("button").filter({ hasText: "클리닉 대상" }).first().click();
    await expect(page.getByRole("button", { name: "PDF 다운로드" })).toBeVisible();
    await expect(page.getByRole("button", { name: "닫기" })).toBeVisible();
    const mobileLayout = await page.locator('[role="dialog"]').evaluate((dialog) => {
      const rect = dialog.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(mobileLayout.left).toBeGreaterThanOrEqual(0);
    expect(mobileLayout.right).toBeLessThanOrEqual(390);
    expect(mobileLayout.documentOverflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath("clinic-preview-390.png"), fullPage: true });

    const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });
    await page.getByRole("button", { name: "PDF 다운로드" }).click();
    const download = await downloadPromise;
    const pdfPath = await download.path();
    expect(pdfPath).toBeTruthy();
    if (pdfPath) {
      const pdf = await readFile(pdfPath);
      expect(pdf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
      expect(pdf.length).toBeGreaterThan(20_000);
    }
  });

  test("출결 조회 실패 시 명단 추정을 중단하고 재시도한다", async ({ page }) => {
    const state = await openClinicPreview(page, { failFirstAttendance: true });

    await expect(page.getByText("출결 정보를 불러오지 못했습니다", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "PDF 다운로드" })).toBeDisabled();
    state.allowAttendanceSuccess();
    await page.getByRole("button", { name: "다시 시도" }).click();

    const frame = page.frameLocator('iframe[title="클리닉 대상자 미리보기"]');
    await expect(frame.locator(".footer-left")).toContainText("클리닉 대상 3명 / 전체 출석 4명", { timeout: 10_000 });
    expect(state.getAttendanceAttempts()).toBeGreaterThanOrEqual(2);
  });
});
