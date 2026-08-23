import ExcelJS from "exceljs";
import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import {
  installLocalAuthApiStubs,
  installTenantOneInitScript,
} from "../helpers/localAuthApiStubs";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5173").replace(/\/+$/, "");

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

async function installStudentPage(page: Page): Promise<void> {
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
    await page.screenshot({ path: testInfo.outputPath("student-import-review-mobile-390.png") });
  });

  test("현재 비밀번호 방식의 등록 가능 인원이 0명이면 요청을 막는다", async ({ page }) => {
    await installStudentPage(page);
    await openExcelRegistration(page, { allStudentPhonesMissing: true });

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("3명은 현재 비밀번호 방식에서 제외됩니다.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "0명 등록 요청" })).toBeDisabled();
  });
});
