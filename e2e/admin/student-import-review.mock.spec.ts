import ExcelJS from "exceljs";
import type { Locator, Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import {
  installLocalAuthApiStubs,
  installTenantOneInitScript,
} from "../helpers/localAuthApiStubs";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5173").replace(/\/+$/, "");

async function expectAnimationsSettled(locator: Locator): Promise<void> {
  await expect.poll(
    () => locator.evaluate((element) =>
      element.getAnimations({ subtree: true }).every((animation) => animation.playState === "finished")
    ),
    { timeout: 3_000 },
  ).toBe(true);
}

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function studentWorkbook(allStudentPhonesMissing = false): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("학생목록");
  worksheet.addRow(["이름", "학부모전화번호", "학생전화번호"]);
  worksheet.addRow(["김지우a", "01070001111", allStudentPhonesMissing ? "" : "01080001111"]);
  worksheet.addRow(["김지우1", "01070001111", ""]);
  worksheet.addRow(["김지우(쌍둥이)", "01070001111", ""]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function installStudentPage(
  page: Page,
  options: { importResult?: Record<string, unknown> } = {},
): Promise<void> {
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  const token = localJwt();
  await page.addInitScript((access) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", `${access}-refresh`);
  }, token);

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (
      path === "/core/program/"
      || path === "/core/me/"
      || path === "/token/refresh/"
      || path === "/results/admin/clinic-targets/"
    ) {
      return route.fallback();
    }
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, body: "" });
    if (path === "/students/" && request.method() === "GET") {
      return json({ count: 0, page_size: 50, results: [] });
    }
    if (path === "/students/bulk_create_from_excel/" && request.method() === "POST") {
      return json({ job_id: "synthetic-student-import", status: "PENDING" }, 202);
    }
    if (path === "/jobs/synthetic-student-import/progress/") {
      return json({
        job_id: "synthetic-student-import",
        job_type: "excel_parsing",
        status: "DONE",
        result: options.importResult ?? {},
      });
    }
    if (path === "/students/custom-fields/") return json([]);
    if (path === "/students/tags/") return json([]);
    if (path === "/landing/has-published/") return json({ has_published: false });
    return json({ count: 0, next: null, previous: null, results: [] });
  });
}

async function openExcelRegistration(
  page: Page,
  options: { allStudentPhonesMissing?: boolean } = {},
): Promise<void> {
  await page.goto(`${BASE}/workspace/students/home`, {
    waitUntil: "commit",
    timeout: 60_000,
  });
  const addStudentButton = page.getByRole("button", { name: "학생 추가" }).first();
  await expect(addStudentButton).toBeVisible({ timeout: 60_000 });
  await addStudentButton.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("엑셀 업로드", { exact: true }).click();
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "동명이인-학생등록.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await studentWorkbook(options.allStudentPhonesMissing),
  });
  await expect(dialog.getByText("파일을 읽었습니다", { exact: true })).toBeVisible();
}

async function confirmStudentImport(page: Page, count = 3): Promise<void> {
  const confirmation = page.getByRole("alertdialog", { name: "학생 일괄 등록 최종 확인" });
  await expect(confirmation.locator(".confirm-dialog__review-list")).toContainText(`${count}명`);
  await confirmation.getByRole("button", { name: `${count}명 등록 요청`, exact: true }).click();
}

test.use({ serviceWorkers: "block" });

test.describe("신규 학생 Excel 등록 확인 화면", () => {
  test("이름 표기를 보존하고 누락 전화번호의 실제 등록 인원을 먼저 보여준다", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await installStudentPage(page);
    await openExcelRegistration(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("읽은 학생").locator("..")).toContainText("3명");
    await expect(dialog.getByText("학생 전화번호 있음").locator("..")).toContainText("1명");
    await expect(dialog.getByText("없음·식별번호 사용").locator("..")).toContainText("2명");
    await expect(dialog.getByText("2명은 현재 비밀번호 방식에서 제외됩니다.")).toBeVisible();
    await expect(dialog.getByRole("status")).toHaveCount(1);
    await expect(dialog.getByRole("button", { name: "1명 등록 요청" })).toBeVisible();
    await expect(dialog.getByText("김지우a·김지우1·괄호 표기도 이름 그대로")).toBeVisible();
    await expect(dialog.getByText("형제·자매는 학부모 번호가 같아도 됩니다.")).toBeVisible();

    await dialog.getByRole("radio", { name: "공통 비밀번호 직접 입력" }).check();
    await dialog.getByLabel("공통 초기 비밀번호").fill("0982");
    await expect(dialog.getByText("2명도 자동 아이디를 받아 함께 등록됩니다.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "3명 등록 요청" })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath("student-import-review-desktop.png") });
  });

  test("390px에서도 단계·인원·등록 버튼이 가로로 잘리지 않는다", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installStudentPage(page);
    await openExcelRegistration(page);

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: "학생별 랜덤 비밀번호" }).check();
    await expect(dialog.getByRole("button", { name: "3명 등록 요청" })).toBeEnabled();
    await expect(dialog.getByText("3명 확인 · 전원 등록 요청 가능")).not.toBeVisible();

    const overflow = await dialog.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const buttonBox = await dialog.getByRole("button", { name: "3명 등록 요청" }).boundingBox();
    expect(buttonBox).not.toBeNull();
    expect(buttonBox!.x).toBeGreaterThanOrEqual(-1);
    expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(391);
    await dialog.locator(".modal-scroll-body").evaluate((element) => {
      element.scrollTop = 0;
    });
    await dialog.getByRole("button", { name: "3명 등록 요청" }).click();
    const confirmation = page.getByRole("alertdialog", { name: "학생 일괄 등록 최종 확인" });
    await expect(confirmation.getByText("동명이인-학생등록.xlsx", { exact: true })).toBeVisible();
    await expect(confirmation.getByText("학생별 랜덤 비밀번호", { exact: true })).toBeVisible();
    await expect(confirmation.getByRole("button", { name: "다시 확인" })).toBeFocused();
    expect(await confirmation.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await confirmation.getByRole("button", { name: "다시 확인" }).click();
    await expect(dialog).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("student-import-review-mobile-390.png") });
  });

  test("390px 학생 단건 등록은 비밀번호를 숨긴 검토표 뒤에만 저장한다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installStudentPage(page);
    await page.goto(`${BASE}/workspace/students/home`, { waitUntil: "commit" });
    await page.getByRole("button", { name: "학생 추가" }).first().click();
    const dialog = page.getByRole("dialog", { name: "학생 등록" });
    await dialog.getByText("1명만 등록", { exact: true }).click();
    await dialog.getByPlaceholder("이름").fill("최종확인 학생");
    await dialog.getByPlaceholder("초기 비밀번호").fill("never-show-this-value");
    await dialog.getByLabel("학부모 전화 앞 4자리").fill("70001111");
    await dialog.getByRole("button", { name: "등록", exact: true }).click();

    const confirmation = page.getByRole("alertdialog", { name: "학생 등록 최종 확인" });
    await expect(confirmation.getByText("최종확인 학생", { exact: true })).toBeVisible();
    await expect(confirmation.getByText("010-7000-1111", { exact: true })).toBeVisible();
    await expect(confirmation).not.toContainText("never-show-this-value");
    await expect(confirmation.getByRole("button", { name: "다시 확인" })).toBeFocused();
    expect(await confirmation.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await confirmation.getByRole("button", { name: "다시 확인" }).click();
    await expect(dialog).toBeVisible();
  });

  test("현재 비밀번호 방식의 등록 가능 인원이 0명이면 요청을 막는다", async ({ page }) => {
    await installStudentPage(page);
    await openExcelRegistration(page, { allStudentPhonesMissing: true });

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("3명은 현재 비밀번호 방식에서 제외됩니다.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "0명 등록 요청" })).toBeDisabled();
  });

  test("완료 뒤 큰 결과창에서 신규·기존·실패 행과 안전한 사유를 보여주고 새로고침 뒤 복구한다", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await installStudentPage(page, {
      importResult: {
        total: 3,
        created: 1,
        created_rows: [{ row: 2, name: "합성신규학생", student_id: 101 }],
        duplicates: [{ row: 3, name: "합성기존학생", student_id: 102 }],
        restored: [],
        failed: [{
          row: 4,
          name: "합성확인학생",
          error: "이미 사용 중인 전화번호입니다.",
          reason_code: "phone_in_use",
        }],
      },
    });
    await openExcelRegistration(page);

    const uploadDialog = page.getByRole("dialog");
    await uploadDialog.getByRole("radio", { name: "공통 비밀번호 직접 입력" }).check();
    await uploadDialog.getByLabel("공통 초기 비밀번호").fill("0982");
    await uploadDialog.getByRole("button", { name: "3명 등록 요청" }).click();
    await confirmStudentImport(page);

    let resultDialog = page.getByRole("dialog", { name: "학생 등록 결과" });
    await expect(resultDialog).toBeVisible({ timeout: 15_000 });
    await expect(resultDialog.getByText("전체 3명")).toBeVisible();
    const summary = resultDialog.getByLabel("등록 결과 요약");
    await expect(summary.getByText("신규 등록", { exact: true }).locator("..")).toContainText("1명");
    await expect(summary.getByText("이미 등록", { exact: true }).locator("..")).toContainText("1명");
    await expect(summary.getByText("확인 필요", { exact: true }).locator("..")).toContainText("1명");
    await expect(resultDialog.getByText("2행")).toBeVisible();
    await expect(resultDialog.getByText("합성신규학생")).toBeVisible();
    await expect(resultDialog.getByText("합성기존학생")).toBeVisible();
    await expect(resultDialog.getByText("합성확인학생")).toBeVisible();
    await expect(resultDialog.getByText("이미 사용 중인 전화번호입니다.")).toBeVisible();
    await expectAnimationsSettled(resultDialog);
    await page.screenshot({ path: testInfo.outputPath("student-import-result-desktop.png") });

    await page.reload({ waitUntil: "commit" });
    resultDialog = page.getByRole("dialog", { name: "학생 등록 결과" });
    await expect(resultDialog).toBeVisible({ timeout: 15_000 });

    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await resultDialog.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expectAnimationsSettled(resultDialog);
    await page.screenshot({ path: testInfo.outputPath("student-import-result-mobile-390.png") });

    await resultDialog.getByRole("button", { name: "확인" }).click();
    await page.getByRole("button", { name: "작업박스 열기" }).click();
    await page.getByText(/학생 일괄 등록 — 신규 등록 1명, 이미 등록된 학생 1명, 실패 1명/).click();
    await expect(page.getByRole("dialog", { name: "학생 등록 결과" })).toBeVisible();

    const redPartialFailure = page.locator(".async-status-bar__item-error");
    await expect(redPartialFailure).toHaveCount(0);
  });

  test("500명을 넘는 결과도 전체 건수와 최대 500명 표본을 분리해 보존한다", async ({ page }) => {
    const rows = (count: number, prefix: string) => Array.from({ length: count }, (_, index) => ({
      row: index + 2,
      name: `${prefix}${index + 1}`,
    }));
    const failed = rows(603, "실패학생").map((row) => ({
      ...row,
      error: "입력값을 확인해 주세요.",
      reason_code: "invalid_row",
    }));
    await installStudentPage(page, {
      importResult: {
        total: 2406,
        created: 600,
        created_rows: rows(600, "신규학생"),
        duplicates: rows(601, "기존학생"),
        restored: rows(602, "복원학생"),
        failed,
      },
    });
    await openExcelRegistration(page);

    const uploadDialog = page.getByRole("dialog");
    await uploadDialog.getByRole("radio", { name: "공통 비밀번호 직접 입력" }).check();
    await uploadDialog.getByLabel("공통 초기 비밀번호").fill("0982");
    await uploadDialog.getByRole("button", { name: "3명 등록 요청" }).click();
    await confirmStudentImport(page);

    let resultDialog = page.getByRole("dialog", { name: "학생 등록 결과" });
    await expect(resultDialog).toBeVisible({ timeout: 15_000 });
    await expect(resultDialog.getByText("전체 2,406명", { exact: true })).toBeVisible();
    const summary = resultDialog.getByLabel("등록 결과 요약");
    await expect(summary.getByText("신규 등록", { exact: true }).locator("..")).toContainText("600명");
    await expect(summary.getByText("복원", { exact: true }).locator("..")).toContainText("602명");
    await expect(summary.getByText("이미 등록", { exact: true }).locator("..")).toContainText("601명");
    await expect(summary.getByText("확인 필요", { exact: true }).locator("..")).toContainText("603명");
    await expect(resultDialog.getByText("행별 목록은 유형별 최대 500명의 표본이며, 위 요약은 전체 처리 건수입니다.", { exact: true })).toBeVisible();
    await expect(resultDialog.getByText("신규 전체 600명 중 500명 표본을 표시합니다.", { exact: true })).toBeVisible();
    await expect(resultDialog.getByText("복원 전체 602명 중 500명 표본을 표시합니다.", { exact: true })).toBeVisible();
    await expect(resultDialog.getByText("전체 601명 중 500명 표본을 표시합니다.", { exact: true })).toBeVisible();
    await expect(resultDialog.getByText("전체 603명 중 500명 표본을 표시합니다.", { exact: true })).toBeVisible();

    await page.reload({ waitUntil: "commit" });
    resultDialog = page.getByRole("dialog", { name: "학생 등록 결과" });
    await expect(resultDialog).toBeVisible({ timeout: 15_000 });
    await expect(resultDialog.getByLabel("등록 결과 요약")).toContainText("600명");
    await expect(resultDialog.getByLabel("등록 결과 요약")).toContainText("602명");
    await expect(resultDialog.getByLabel("등록 결과 요약")).toContainText("601명");
    await expect(resultDialog.getByLabel("등록 결과 요약")).toContainText("603명");
    await resultDialog.getByRole("button", { name: "확인" }).click();
    await page.getByRole("button", { name: "작업박스 열기" }).click();
    await expect(page.getByText(/신규 등록 600명, 이미 등록된 학생 601명, 복원 602명, 실패 603명/)).toBeVisible();
    await expect(page.locator(".async-status-bar__item-error")).toHaveCount(0);
  });
});
