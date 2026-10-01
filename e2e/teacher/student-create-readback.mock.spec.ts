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

async function installTeacherStudentPage(
  page: Page,
  onCreateStudent: (payload: Record<string, unknown>) => void,
): Promise<void> {
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  const token = localJwt();
  await page.addInitScript((access) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", `${access}-refresh`);
  }, token);

  const students: Array<Record<string, unknown>> = [];
  let policy = { student_mode: "phone_last4", parent_mode: "phone_last4", student_fixed_password: "", parent_fixed_password: "" };
  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    if (
      path === "/core/program/"
      || path === "/core/me/"
      || path === "/token/refresh/"
      || path === "/results/admin/clinic-targets/"
    ) {
      return route.fallback();
    }
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, body: "" });
    if (path === "/students/account-password-settings/") {
      if (request.method() === "PATCH") policy = { ...policy, ...request.postDataJSON() };
      return route.fulfill({ json: policy });
    }
    if (path === "/students/" && request.method() === "GET") {
      return route.fulfill({ json: { count: students.length, results: students } });
    }
    if (path === "/students/101/" && request.method() === "GET") return route.fulfill({ json: students[0] });
    if (path === "/students/" && request.method() === "POST") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      onCreateStudent(payload);
      const student = { id: 101, ...payload, ps_number: payload.ps_number || "QA-STUDENT-101", is_managed: true };
      students.push(student);
      return route.fulfill({ json: student });
    }
    return route.fulfill({ json: { count: 0, results: [] } });
  });
}

test.use({ serviceWorkers: "block" });

for (const width of [390, 1366]) {
test(`${width}px 선생님 등록은 학생·학부모 비밀번호와 로그인 ID를 유지한다`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 844 });
  let createPayload: Record<string, unknown> | null = null;
  await installTeacherStudentPage(page, (payload) => {
    createPayload = payload;
  });

  await page.goto(`${BASE}/workspace/mobile/students`, { waitUntil: "commit" });
  await expect(page.getByText("학생 관리", { exact: true })).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "추가", exact: true }).click();

  const sheet = page.getByRole("dialog", { name: "학생 추가" });
  await sheet.getByPlaceholder("학생 이름").fill("즉시검수 학생");
  await sheet.getByLabel("학생 초기 비밀번호 (선택)", { exact: true }).fill("teacher-selected-password");
  await sheet.getByLabel("학부모 초기 비밀번호 (선택)", { exact: true }).fill(" parent chosen password ");
  await sheet.getByRole("button", { name: "비밀번호 보기", exact: true }).click();
  await expect(sheet.getByLabel("학부모 초기 비밀번호 (선택)", { exact: true })).toHaveAttribute("type", "text");
  await page.screenshot({ path: testInfo.outputPath(`student-passwords-${width}.png`), fullPage: true });
  await sheet.getByPlaceholder("010-").nth(0).fill("01080001111");
  await sheet.getByPlaceholder("010-").nth(1).fill("01070001111");
  await sheet.getByRole("button", { name: "등록", exact: true }).click();

  await expect.poll(() => createPayload).not.toBeNull();
  expect(createPayload).toMatchObject({
    phone: "01080001111",
    ps_number: "01080001111",
    initial_password: "teacher-selected-password",
    parent_initial_password: " parent chosen password ",
  });
  await expect(sheet.getByText("등록 완료 · 계정 준비됨", { exact: true })).toBeVisible();
  await expect(sheet.getByText("01080001111", { exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "학생 화면 바로 검수" })).toBeVisible();
  expect(await sheet.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
});

}

for (const width of [390, 1366]) {
  test(`${width}px 관리자 기본 비밀번호 설정은 저장·새로고침·단건 등록에서 유지된다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    let created: Record<string, unknown> | null = null;
    await installTeacherStudentPage(page, (payload) => { created = payload; });
    await page.goto(`${BASE}/workspace/students`, { waitUntil: "commit" });
    await expect(page.getByText("학생 · 학부모 초기 비밀번호 설정", { exact: true })).toBeVisible({ timeout: 45_000 });
    await page.getByText("학생 · 학부모 초기 비밀번호 설정", { exact: true }).click();
    await page.getByLabel("학생 초기 비밀번호 방식", { exact: true }).selectOption("fixed");
    await page.getByLabel("학생 공통 초기 비밀번호", { exact: true }).fill(" student common ");
    await page.getByLabel("학부모 초기 비밀번호 방식", { exact: true }).selectOption("random");
    await page.getByRole("button", { name: "초기 비밀번호 설정 저장", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("신규 계정부터 적용");
    await page.reload();
    await expect(page.getByText("학생 · 학부모 초기 비밀번호 설정", { exact: true })).toBeVisible({ timeout: 45_000 });
    await page.getByText("학생 · 학부모 초기 비밀번호 설정", { exact: true }).click();
    await expect(page.getByLabel("학생 공통 초기 비밀번호", { exact: true })).toHaveValue(" student common ");
    await expect(page.getByLabel("학부모 초기 비밀번호 방식", { exact: true })).toHaveValue("random");
    await page.screenshot({ path: testInfo.outputPath(`password-policy-${width}.png`), fullPage: true });
    await page.locator("[data-guide=students-add-btn]").click();
    await page.getByRole("button", { name: "1명만 등록", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "학생 등록", exact: true });
    await expect(dialog.getByLabel("학생 초기 비밀번호 (선택)", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("학부모 초기 비밀번호 (선택)", { exact: true })).toBeVisible();
    await dialog.getByPlaceholder("이름", { exact: true }).fill("기본설정 학생");
    await dialog.getByPlaceholder("0000").nth(0).fill("7000");
    await dialog.getByPlaceholder("0000").nth(1).fill("1111");
    await page.screenshot({ path: testInfo.outputPath(`admin-passwords-${width}.png`), fullPage: true });
    expect(await dialog.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await dialog.getByRole("button", { name: "등록", exact: true }).click();
    await page.getByRole("button", { name: "확인하고 등록", exact: true }).click();
    await expect.poll(() => created).not.toBeNull();
    expect(created).not.toHaveProperty("initial_password");
    expect(created).not.toHaveProperty("parent_initial_password");
    await expect(page.getByText(/로그인 ID: QA-STUDENT-101/)).toBeVisible();
    await page.reload();
    await expect(page.getByText("기본설정 학생", { exact: true }).first()).toBeVisible();
  });
}
