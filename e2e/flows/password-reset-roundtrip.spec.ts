/**
 * 비밀번호 일괄 변경 왕복 E2E
 * 선생이 학생/학부모 비밀번호 변경(API) → 변경된 비밀번호로 로그인 확인 → 복원
 */
import { test, expect, type Page, type Browser } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";

const BASE = getBaseUrl("admin");
const API_BASE = process.env.E2E_API_URL || process.env.API_BASE_URL || "https://api.hakwonplus.com";
const TEMP_PW = "e2eTemp1234";
const STUDENT_USER = process.env.E2E_STUDENT_USER || "3333";
const STUDENT_PASS = process.env.E2E_STUDENT_PASS || "test1234";

test.describe.serial("[E2E] 비밀번호 일괄 변경", () => {
  let browser: Browser;
  let adminPage: Page;

  test.beforeAll(async ({ browser: b }) => { browser = b; });

  test("1. 선생이 학생 비밀번호를 변경한다 (skip_notify)", async () => {
    const ctx = await browser.newContext();
    adminPage = await ctx.newPage();
    await loginViaUI(adminPage, "admin");

    // 학생 목록에서 테스트 학생 찾기
    const listResp = await apiCall(adminPage, "GET", "/students/?page_size=50");
    expect(listResp.status).toBe(200);
    const students = listResp.body?.results || [];
    const target = students.find((s: { psNumber?: string; ps_number?: string }) =>
      (s.psNumber || s.ps_number) === STUDENT_USER
    );

    if (!target) {
      test.skip();
      return;
    }

    // 비밀번호 변경 (알림톡 미발송)
    const resp = await apiCall(adminPage, "POST", "/students/password_reset_send/", {
      target: "student",
      student_name: target.name || target.displayName,
      student_ps_number: STUDENT_USER,
      temp_password: TEMP_PW,
      skip_notify: true,
    });
    expect(resp.status).toBe(200);
  });

  test("2. 변경된 비밀번호로 학생 로그인 성공", async () => {
    // 새 비밀번호로 JWT 발급 시도
    const resp = await adminPage.request.post(`${API_BASE}/api/v1/token/`, {
      data: { username: STUDENT_USER, password: TEMP_PW, tenant_code: "hakwonplus" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    });
    expect(resp.status()).toBe(200);
    const tokens = await resp.json();
    expect(tokens.access).toBeTruthy();
  });

  test("3. 원래 비밀번호 복원", async () => {
    const listResp = await apiCall(adminPage, "GET", "/students/?page_size=50");
    const students = listResp.body?.results || [];
    const target = students.find((s: { psNumber?: string; ps_number?: string }) =>
      (s.psNumber || s.ps_number) === STUDENT_USER
    );

    const resp = await apiCall(adminPage, "POST", "/students/password_reset_send/", {
      target: "student",
      student_name: target?.name || target?.displayName || "",
      student_ps_number: STUDENT_USER,
      temp_password: STUDENT_PASS,
      skip_notify: true,
    });
    expect(resp.status).toBe(200);

    // 원래 비밀번호로 로그인 확인
    const loginResp = await adminPage.request.post(`${API_BASE}/api/v1/token/`, {
      data: { username: STUDENT_USER, password: STUDENT_PASS, tenant_code: "hakwonplus" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    });
    expect(loginResp.status()).toBe(200);
  });

  test.afterAll(async () => {
    await adminPage?.context()?.close();
  });
});
