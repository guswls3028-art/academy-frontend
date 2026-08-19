import ExcelJS from "exceljs";
import type { Download, Page } from "@playwright/test";

import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";
import { apiCall } from "../helpers/api";

test.use({ trace: "off", video: "off", screenshot: "off" });

function rowsFromApi<T>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[];
  if (body && typeof body === "object") {
    const record = body as { results?: unknown; items?: unknown };
    if (Array.isArray(record.results)) return record.results as T[];
    if (Array.isArray(record.items)) return record.items as T[];
  }
  return [];
}

async function studentWorkbookFromTemplate(download: Download): Promise<Buffer> {
  const path = await download.path();
  if (!path) throw new Error("다운로드한 학생 양식의 로컬 경로를 확인할 수 없습니다.");

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const worksheet = workbook.getWorksheet("학생목록") ?? workbook.worksheets[0];
  if (!worksheet) throw new Error("학생 양식에 워크시트가 없습니다.");

  const headerRow = worksheet.getRows(1, worksheet.rowCount)?.find((row) =>
    Array.isArray(row.values) &&
    row.values.some((value) => String(value ?? "").trim() === "이름"),
  );
  if (!headerRow) throw new Error("학생 양식에서 이름 헤더를 찾지 못했습니다.");

  const headerIndexes = new Map<string, number>();
  headerRow.eachCell((cell, column) => {
    headerIndexes.set(String(cell.value ?? "").trim(), column);
  });
  const nameColumn = headerIndexes.get("이름");
  const parentPhoneColumn = headerIndexes.get("학부모전화번호");
  const studentPhoneColumn = headerIndexes.get("학생전화번호");
  if (!nameColumn || !parentPhoneColumn || !studentPhoneColumn) {
    throw new Error("학생 양식의 필수 헤더가 누락되었습니다.");
  }

  const studentRow = worksheet.addRow([]);
  studentRow.getCell(nameColumn).value = "[E2E-비밀번호옵션] 번호없는학생";
  studentRow.getCell(parentPhoneColumn).value = "01070001111";
  studentRow.getCell(studentPhoneColumn).value = "";
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

async function impersonateYmathOwner(page: Page): Promise<void> {
  await loginViaUI(page, "admin", { landingPath: "/dev/tenants/4" });
  const owners = await apiCall<Array<{ userId: number; role: string }>>(
    page,
    "GET",
    "/core/tenants/4/owners/",
  );
  expect(owners.status).toBe(200);
  const owner = owners.body.find((candidate) => candidate.role === "owner");
  expect(owner?.userId, "Ymath owner is required for the controlled regression").toBeTruthy();

  const impersonation = await apiCall<{
    access: string;
    refresh: string;
    target: { tenant_code: string };
  }>(
    page,
    "POST",
    "/core/dev/tenants/4/impersonate/",
    { user_id: owner!.userId },
  );
  expect(impersonation.status).toBe(200);
  expect(impersonation.body.target.tenant_code).toBe("ymath");

  await page.addInitScript(({ access, refresh }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    localStorage.setItem("tenant_code", "ymath");
    sessionStorage.setItem("tenantCode", "ymath");
  }, impersonation.body);
  await page.goto("https://ymath.co.kr/login");
  await page.evaluate(({ access, refresh }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    localStorage.setItem("tenant_code", "ymath");
    sessionStorage.setItem("tenantCode", "ymath");
  }, impersonation.body);
}

test("학생 엑셀 등록에서 번호가 빠진 행만 제외하고 업로드를 허용한다", async ({ page }) => {
  await loginViaUI(page, "admin");

  const studentMenu = page.getByText("학생", { exact: true }).first();
  await expect(studentMenu).toBeVisible();
  await studentMenu.click();
  await expect(page).toHaveURL(/\/workspace\/students(?:\/home)?(?:[?#].*)?$/);

  await page.getByRole("button", { name: "학생 추가" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByText("엑셀 업로드", { exact: true }).click();

  const templateDownloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "엑셀 양식 다운로드" }).click();
  const templateDownload = await templateDownloadPromise;
  expect(templateDownload.suggestedFilename()).toBe("학생_일괄등록_양식.xlsx");
  const workbookBuffer = await studentWorkbookFromTemplate(templateDownload);
  await templateDownload.delete();

  await dialog.locator('input[type="file"]').setInputFiles({
    name: "student-password-options.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: workbookBuffer,
  });

  const phoneMode = dialog.getByRole("radio", { name: "학생 휴대폰 번호 뒤 4자리" });
  await expect(phoneMode).toBeChecked();
  await expect(dialog.getByRole("status")).toContainText("해당 행은 등록하지 않고, 나머지 정상 행만 등록합니다");

  const registerButton = dialog.getByRole("button", { name: "등록", exact: true });
  await expect(registerButton).toBeEnabled();

  await dialog.getByRole("radio", { name: "공통 비밀번호 직접 입력" }).check();
  const fixedPassword = dialog.getByLabel("공통 초기 비밀번호");
  await expect(fixedPassword).toBeVisible();
  await fixedPassword.fill("12");
  await expect(registerButton).toBeDisabled();
  await fixedPassword.fill("1234");
  await expect(registerButton).toBeEnabled();

  await dialog.getByRole("radio", { name: "학생별 랜덤 비밀번호" }).check();
  await expect(dialog.getByText("등록 완료 후 학생별 비밀번호 목록이 자동으로 내려받아집니다.")).toBeVisible();
  await expect(registerButton).toBeEnabled();
});

test("Ymath 고객 제보 회귀: 소유자 화면에서 Excel 양식과 파일 파싱이 오류 없이 열린다", async ({ page }) => {
  test.skip(
    process.env.E2E_ENABLE_YMATH_EXCEL_REGRESSION !== "1",
    "운영 플랫폼 대리 로그인 감사 기록을 남기는 통제 실행에서만 사용",
  );

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(`${error.name}: ${error.message}`));

  await impersonateYmathOwner(page);
  await page.goto("https://ymath.co.kr/workspace/students/home");

  await page.getByRole("button", { name: "학생 추가" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByText("엑셀 업로드", { exact: true }).click();

  const templateDownloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "엑셀 양식 다운로드" }).click();
  const templateDownload = await templateDownloadPromise;
  expect(templateDownload.suggestedFilename()).toBe("학생_일괄등록_양식.xlsx");
  const workbookBuffer = await studentWorkbookFromTemplate(templateDownload);
  await templateDownload.delete();

  await dialog.locator('input[type="file"]').setInputFiles({
    name: "ymath-student-excel-regression.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: workbookBuffer,
  });
  await expect(dialog.getByRole("status")).toContainText("학생 전화번호가 없거나 올바르지 않은 학생이 1명");
  await expect(pageErrors, pageErrors.join("\n")).toEqual([]);
});

test("Ymath 운영 오류 회귀: 실제 차시 시험·채점 결과와 출결 화면이 예외 없이 열린다", async ({ page }) => {
  test.skip(
    process.env.E2E_ENABLE_YMATH_EXCEL_REGRESSION !== "1",
    "운영 플랫폼 대리 로그인 감사 기록을 남기는 통제 실행에서만 사용",
  );

  const pageErrors: string[] = [];
  const serverErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(`${error.name}: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 500) {
      serverErrors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });

  await impersonateYmathOwner(page);
  const lecturesResponse = await apiCall<unknown>(
    page,
    "GET",
    "/lectures/lectures/?page_size=100",
  );
  expect(lecturesResponse.status).toBe(200);
  const lectures = rowsFromApi<{ id: number }>(lecturesResponse.body);

  let target: { lectureId: number; sessionId: number; examId: number } | null = null;
  for (const lecture of lectures.slice(0, 30)) {
    const sessionsResponse = await apiCall<unknown>(
      page,
      "GET",
      `/lectures/sessions/?lecture=${lecture.id}&page_size=100`,
    );
    if (sessionsResponse.status !== 200) continue;
    const sessions = rowsFromApi<{ id: number }>(sessionsResponse.body);
    for (const session of sessions.slice().reverse()) {
      const examsResponse = await apiCall<unknown>(
        page,
        "GET",
        `/results/admin/sessions/${session.id}/exams/`,
      );
      if (examsResponse.status !== 200) continue;
      const exam = rowsFromApi<{ exam_id: number }>(examsResponse.body)
        .find((candidate) => Number.isFinite(Number(candidate.exam_id)));
      if (exam) {
        target = {
          lectureId: Number(lecture.id),
          sessionId: Number(session.id),
          examId: Number(exam.exam_id),
        };
        break;
      }
    }
    if (target) break;
  }
  expect(target, "Ymath needs at least one existing session exam for the read-only regression").not.toBeNull();

  await page.goto(
    `https://ymath.co.kr/workspace/lectures/${target!.lectureId}/sessions/${target!.sessionId}/exams?examId=${target!.examId}`,
  );
  await expect(page.getByRole("tab", { name: "운영" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("tab", { name: "채점·결과" }).click();
  await expect(page.getByText("채점결과", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("오류가 발생했습니다. 페이지를 새로고침해 주세요.")).toHaveCount(0);

  await page.goto(
    `https://ymath.co.kr/workspace/lectures/${target!.lectureId}/sessions/${target!.sessionId}/attendance`,
  );
  await expect(page).toHaveURL(/\/workspace\/lectures\/\d+\/sessions\/\d+\/attendance(?:[/?#]|$)/);
  await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("오류가 발생했습니다. 페이지를 새로고침해 주세요.")).toHaveCount(0);
  await expect(pageErrors, pageErrors.join("\n")).toEqual([]);
  await expect(serverErrors, serverErrors.join("\n")).toEqual([]);
});
