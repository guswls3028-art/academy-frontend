import ExcelJS from "exceljs";
import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const LECTURE_ID = 9961;
const SESSION_ID = 9962;

type ApiOptions = {
  firstJobFailed?: boolean;
};

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function existingStudentWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("학생목록");
  worksheet.addRow(["학생번호", "이름", "학부모전화번호", "학생전화번호", "강의명"]);
  worksheet.addRow(["EXISTING-001", "김지우a", "01087654321", "", "고1 기존학생반"]);
  worksheet.addRow(["", "김지우b", "01087654321", "", "고1 기존학생반"]);
  worksheet.addRow(["", "김지우1", "01082220000", "", "고1 기존학생반"]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function installApi(page: Page, submittedBodies: string[], options: ApiOptions = {}) {
  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") {
      return json({
        tenantCode: "hakwonplus",
        isPlatformAdmin: true,
        display_name: "학원플러스",
        feature_flags: {},
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      return json({
        id: 12,
        username: "admin",
        name: "관리자",
        is_staff: true,
        is_superuser: true,
        tenantRole: "admin",
        must_change_password: false,
      });
    }
    if (path === `/lectures/lectures/${LECTURE_ID}/`) {
      return json({
        id: LECTURE_ID,
        title: "고1 기존학생반",
        name: "고1 기존학생반",
        subject: "수학",
        start_date: "2026-08-01",
        end_date: "2026-09-30",
      });
    }
    if (path === `/lectures/sessions/${SESSION_ID}/`) {
      return json({
        id: SESSION_ID,
        lecture: LECTURE_ID,
        title: "기존학생 확인 1차시",
        order: 1,
        regular_order: 1,
        session_type: "REGULAR",
        date: "2026-08-01",
      });
    }
    if (path === "/lectures/sessions/") {
      return json({
        count: 1,
        results: [{
          id: SESSION_ID,
          lecture: LECTURE_ID,
          title: "기존학생 확인 1차시",
          order: 1,
          regular_order: 1,
          session_type: "REGULAR",
          date: "2026-08-01",
        }],
      });
    }
    if (path === "/lectures/attendance/matrix/") {
      return json({
        lecture: { id: LECTURE_ID, title: "고1 기존학생반" },
        sessions: [],
        students: [],
      });
    }
    if (path === "/lectures/attendance/" && method === "GET") {
      return json({ count: 0, page_size: 50, results: [] });
    }
    if (path === "/enrollments/session-enrollments/" || path === "/enrollments/") {
      return json([]);
    }
    if (path === "/students/") {
      return json({ count: 0, page_size: 100, results: [] });
    }
    if (path === "/enrollments/lecture_enroll_from_excel/" && method === "POST") {
      submittedBodies.push(request.postDataBuffer()?.toString("latin1") ?? "");
      return json({ job_id: `existing-enroll-${submittedBodies.length}`, status: "PENDING" }, 202);
    }
    const progressMatch = path.match(/^\/jobs\/existing-enroll-(\d+)\/progress\/$/);
    if (progressMatch) {
      const attempt = Number(progressMatch[1]);
      if (options.firstJobFailed && attempt === 1) {
        return json({
          job_id: `existing-enroll-${attempt}`,
          job_type: "excel_parsing",
          status: "FAILED",
          error_message: "학생 명부에서 등록할 수 있는 학생을 찾지 못했습니다.",
        });
      }
      return json({
        job_id: `existing-enroll-${attempt}`,
        job_type: "excel_parsing",
        status: "DONE",
        result: {
          enrolled_count: 1,
          created_students_count: 0,
          not_found_students_count: attempt === 1 ? 1 : 0,
          ambiguous_students_count: attempt === 1 ? 1 : 0,
          session_id: SESSION_ID,
        },
      });
    }
    return json({ count: 0, results: [] });
  });
}

async function openEnrollmentExcel(
  page: Page,
  submittedBodies: string[],
  options: ApiOptions = {},
  installRoutes = true,
) {
  test.skip(
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE),
    "기존 학생 Excel 수강등록 route-mock 검증은 로컬 dev 서버 전용",
  );
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
  if (installRoutes) await installApi(page, submittedBodies, options);
  await page.goto(`${BASE}/workspace/lectures/${LECTURE_ID}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });

  const enrollButton = page.getByRole("button", { name: "수강생 등록" }).first();
  await expect(enrollButton).toBeVisible({ timeout: 30_000 });
  await enrollButton.click();
  await page.getByText("엑셀로 일괄 등록 (추천)", { exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "수강생 엑셀 업로드" })).toBeVisible();
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "existing-students.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await existingStudentWorkbook(),
  });
  await expect(dialog.getByText("강의 일치 확인", { exact: true })).toBeVisible();
  return dialog;
}

for (const viewport of [
  { label: "desktop", width: 1366, height: 900 },
  { label: "390px", width: 390, height: 844 },
] as const) {
  test(`${viewport.label} 기존 학생 Excel 수강등록은 비밀번호 질문 없이 기존 명부만 등록한다`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const submittedBodies: string[] = [];
    const dialog = await openEnrollmentExcel(page, submittedBodies);

    await expect(dialog.getByText("신규 학생 초기 비밀번호 방식", { exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("radio")).toHaveCount(0);
    await expect(dialog.getByText(/학생 명부에 이미 등록된 활성 학생만/)).toBeVisible();
    await expect(dialog.getByText(/명부에 없는 학생은 새로 만들지 않습니다/)).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);

    await dialog.getByRole("button", { name: "맞아요, 등록하기" }).click();
    await expect.poll(() => submittedBodies.length).toBe(1);
    expect(submittedBodies[0]).toContain('name="lecture_id"');
    expect(submittedBodies[0]).not.toContain("password_mode");
    expect(submittedBodies[0]).not.toContain("initial_password");
    await expect(page.getByText(
      "엑셀 수강등록 — 등록 1명, 명부 없음 1명, 명부 중복 1명",
      { exact: true },
    )).toBeVisible();
    await expect(page.getByText(/학생 등록 또는 명부 정리 후 다시 시도해 주세요/).first()).toBeVisible();
  });
}

test("기존 학생 Excel 수강등록을 다시 열어 재시도해도 계정 옵션이 생기지 않는다", async ({ page }) => {
  const submittedBodies: string[] = [];
  let dialog = await openEnrollmentExcel(page, submittedBodies, { firstJobFailed: true });
  await dialog.getByRole("button", { name: "맞아요, 등록하기" }).click();
  await expect.poll(() => submittedBodies.length).toBe(1);
  await expect(page.getByText(
    "학생 명부에서 등록할 수 있는 학생을 찾지 못했습니다.",
    { exact: true },
  )).toBeVisible();

  dialog = await openEnrollmentExcel(
    page,
    submittedBodies,
    { firstJobFailed: true },
    false,
  );
  await expect(dialog.getByRole("radio")).toHaveCount(0);
  await dialog.getByRole("button", { name: "맞아요, 등록하기" }).click();
  await expect.poll(() => submittedBodies.length).toBe(2);
  await expect(page.getByText("엑셀 수강등록 — 등록 1명", { exact: true })).toBeVisible();
  for (const body of submittedBodies) {
    expect(body).not.toContain("password_mode");
    expect(body).not.toContain("initial_password");
  }
});

for (const viewport of [
  { label: "desktop", width: 1366, height: 900 },
  { label: "390px", width: 390, height: 844 },
] as const) {
  test(`${viewport.label} 차시 Excel 수강등록도 기존 학생만 처리하고 session_id만 추가한다`, async ({ page }) => {
    const submittedBodies: string[] = [];
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await installTenantOneInitScript(page);
    await page.addInitScript((jwt) => {
      localStorage.setItem("access", jwt);
      localStorage.setItem("refresh", `${jwt}-refresh`);
    }, localJwt());
    await installApi(page, submittedBodies);
    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/attendance`,
      { waitUntil: "domcontentloaded", timeout: 45_000 },
    );

    const enrollButton = page.getByRole("button", { name: "수강생 등록" }).first();
    await expect(enrollButton).toBeVisible({ timeout: 30_000 });
    await enrollButton.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("차시 수강생 등록", { exact: true })).toBeVisible();
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "existing-students.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await existingStudentWorkbook(),
    });
    await expect(dialog.getByText(/학생 명부의 기존 활성 학생만 등록합니다/)).toBeVisible();
    await expect(dialog.getByRole("radio")).toHaveCount(0);
    await dialog.getByRole("button", { name: "엑셀로 일괄 등록", exact: true }).click();

    await expect.poll(() => submittedBodies.length).toBe(1);
    expect(submittedBodies[0]).toContain('name="lecture_id"');
    expect(submittedBodies[0]).toContain('name="session_id"');
    expect(submittedBodies[0]).toContain(String(SESSION_ID));
    expect(submittedBodies[0]).not.toContain("password_mode");
    expect(submittedBodies[0]).not.toContain("initial_password");
  });
}
