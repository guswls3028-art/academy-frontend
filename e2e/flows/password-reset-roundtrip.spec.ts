/**
 * 비밀번호 일괄 변경 E2E
 * 전용 테스트 계정(e2e_pwtest)으로 비밀번호 변경 → 확인 → 복원
 * 다른 테스트의 학생 계정에 영향 없음
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page, Browser } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import { apiCall } from "../helpers/api";

const API_BASE = process.env.E2E_API_URL || process.env.API_BASE_URL || "https://api.hakwonplus.com";
const TS = Date.now();
const PW_TEST_USER = `e2epw${String(TS).slice(-8)}`;
const PW_TEST_NAME = `[E2E-${TS}]비번테스트`;
const ORIGINAL_PW = "test1234";
const TEMP_PW = "e2eChanged9876";
const PARENT_PHONE = "01031217466";
let createdStudentId: number | null = null;

async function ensurePasswordTestAccount(page: Page): Promise<void> {
  const resp = await apiCall<{
    code?: string;
    detail?: string;
    existing_student?: { id?: number };
    id?: number;
  }>(page, "POST", "/students/", {
    name: PW_TEST_NAME,
    parent_phone: PARENT_PHONE,
    ps_number: PW_TEST_USER,
    no_phone: true,
    school_type: "HIGH",
    grade: 1,
    initial_password: ORIGINAL_PW,
    memo: "E2E password reset fixture. 계정 안내 필수 발송 정책과 함께 비밀번호 변경 라운드트립 검증용.",
  });

  if (resp.status === 201) {
    createdStudentId = Number(resp.body?.id || 0) || null;
    return;
  }

  throw new Error(
    `비밀번호 E2E 테스트 계정 준비 실패: ${resp.status} ${JSON.stringify(resp.body)}`,
  );
}

async function cleanupPasswordTestAccount(page: Page): Promise<void> {
  if (!createdStudentId) return;
  await apiCall(page, "POST", "/students/bulk_delete/", { ids: [createdStudentId] }).catch(() => undefined);
  await apiCall(page, "POST", "/students/bulk_permanent_delete/", { ids: [createdStudentId] }).catch(() => undefined);
  createdStudentId = null;
}

test.describe.serial("[E2E] 비밀번호 일괄 변경", () => {
  let browser: Browser;
  let adminPage: Page;

  test.beforeAll(async ({ browser: b }) => { browser = b; });

  test("1. 선생이 학생 비밀번호를 변경한다", async () => {
    const ctx = await browser.newContext();
    adminPage = await ctx.newPage();
    await loginViaUI(adminPage, "admin");
    await ensurePasswordTestAccount(adminPage);

    const resp = await apiCall(adminPage, "POST", "/students/password_reset_send/", {
      target: "student",
      student_name: PW_TEST_NAME,
      student_ps_number: PW_TEST_USER,
      temp_password: TEMP_PW,
    });
    expect(resp.status).toBe(200);
  });

  test("2. 변경된 비밀번호로 JWT 발급 성공", async () => {
    const resp = await adminPage.request.post(`${API_BASE}/api/v1/token/`, {
      data: { username: PW_TEST_USER, password: TEMP_PW, tenant_code: "hakwonplus" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    });
    expect(resp.status()).toBe(200);
  });

  test("3. 학부모 비밀번호를 변경한다", async () => {
    const resp = await apiCall(adminPage, "POST", "/students/password_reset_send/", {
      target: "parent",
      student_name: PW_TEST_NAME,
      parent_phone: PARENT_PHONE,
      temp_password: TEMP_PW,
    });
    expect(resp.status).toBe(200);
  });

  test("4. 비밀번호 복원", async () => {
    // 학생 복원
    const resp = await apiCall(adminPage, "POST", "/students/password_reset_send/", {
      target: "student",
      student_name: PW_TEST_NAME,
      student_ps_number: PW_TEST_USER,
      temp_password: ORIGINAL_PW,
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
    // 어떤 상황에서도 원래 비밀번호로 복원 후 fixture 제거
    try {
      if (adminPage && !adminPage.isClosed()) {
        await apiCall(adminPage, "POST", "/students/password_reset_send/", {
          target: "student",
          student_name: PW_TEST_NAME,
          student_ps_number: PW_TEST_USER,
          temp_password: ORIGINAL_PW,
        });
        await cleanupPasswordTestAccount(adminPage);
      }
    } catch { /* 복원 실패해도 전용 계정이라 다른 테스트 무관 */ }
    await adminPage?.context()?.close().catch(() => {});
  });
});
