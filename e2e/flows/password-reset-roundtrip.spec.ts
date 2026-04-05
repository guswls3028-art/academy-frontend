/**
 * 비밀번호 일괄 변경 E2E
 * 전용 테스트 계정(e2e_pwtest)으로 비밀번호 변경 → 확인 → 복원
 * 다른 테스트의 학생 계정에 영향 없음
 *
 * 테스트 계정이 DB에 없으면 전체 suite를 skip한다.
 */
import { test, expect, type Page, type Browser } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";

const API_BASE = process.env.E2E_API_URL || process.env.API_BASE_URL || "https://api.hakwonplus.com";
const PW_TEST_USER = "e2e_pwtest";
const PW_TEST_NAME = "[E2E]비번테스트";
const ORIGINAL_PW = "test1234";
const TEMP_PW = "e2eChanged9876";

test.describe.serial("[E2E] 비밀번호 일괄 변경", () => {
  let browser: Browser;
  let adminPage: Page;
  let accountExists = true;

  test.beforeAll(async ({ browser: b }) => { browser = b; });

  test("1. 선생이 학생 비밀번호를 변경한다", async () => {
    const ctx = await browser.newContext();
    adminPage = await ctx.newPage();
    await loginViaUI(adminPage, "admin");

    const resp = await apiCall(adminPage, "POST", "/students/password_reset_send/", {
      target: "student",
      student_name: PW_TEST_NAME,
      student_ps_number: PW_TEST_USER,
      temp_password: TEMP_PW,
      skip_notify: true,
    });
    if (resp.status === 404) {
      accountExists = false;
      test.skip(true, `테스트 계정 ${PW_TEST_USER}이 DB에 없음 — skip`);
      return;
    }
    expect(resp.status).toBe(200);
  });

  test("2. 변경된 비밀번호로 JWT 발급 성공", async () => {
    test.skip(!accountExists, "테스트 계정 없음 — skip");
    const resp = await adminPage.request.post(`${API_BASE}/api/v1/token/`, {
      data: { username: PW_TEST_USER, password: TEMP_PW, tenant_code: "hakwonplus" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    });
    expect(resp.status()).toBe(200);
  });

  test("3. 학부모 비밀번호를 변경한다", async () => {
    test.skip(!accountExists, "테스트 계정 없음 — skip");
    const resp = await apiCall(adminPage, "POST", "/students/password_reset_send/", {
      target: "parent",
      student_name: PW_TEST_NAME,
      parent_phone: "01099999999",
      temp_password: TEMP_PW,
      skip_notify: true,
    });
    expect(resp.status).toBe(200);
  });

  test("4. 비밀번호 복원", async () => {
    test.skip(!accountExists, "테스트 계정 없음 — skip");
    // 학생 복원
    const resp = await apiCall(adminPage, "POST", "/students/password_reset_send/", {
      target: "student",
      student_name: PW_TEST_NAME,
      student_ps_number: PW_TEST_USER,
      temp_password: ORIGINAL_PW,
      skip_notify: true,
    });
    expect(resp.status).toBe(200);

    // 원래 비밀번호 확인
    const login = await adminPage.request.post(`${API_BASE}/api/v1/token/`, {
      data: { username: PW_TEST_USER, password: ORIGINAL_PW, tenant_code: "hakwonplus" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    });
    expect(login.status()).toBe(200);
  });

  test.afterAll(async () => {
    // 어떤 상황에서도 원래 비밀번호로 복원
    try {
      if (accountExists && adminPage && !adminPage.isClosed()) {
        await apiCall(adminPage, "POST", "/students/password_reset_send/", {
          target: "student",
          student_name: PW_TEST_NAME,
          student_ps_number: PW_TEST_USER,
          temp_password: ORIGINAL_PW,
          skip_notify: true,
        });
      }
    } catch { /* 복원 실패해도 전용 계정이라 다른 테스트 무관 */ }
    await adminPage?.context()?.close().catch(() => {});
  });
});
