/**
 * E2E Auth Helper — 실제 브라우저 로그인
 *
 * Tenant 1 (hakwonplus) = production-like test tenant.
 * data-testid 기반 selector로 CI headless 안정성 보장.
 */
import { type Page } from "@playwright/test";

export type TenantRole = "admin" | "student" | "tchul-admin";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const TCHUL = process.env.TCHUL_BASE_URL || "https://tchul.com";
const SSWE = process.env.SSWE_BASE_URL || "https://sswe.co.kr";

const CREDS: Record<TenantRole, { base: string; code: string; user: string; pass: string }> = {
  admin:         { base: BASE,  code: "hakwonplus", user: process.env.E2E_ADMIN_USER || "admin97",       pass: process.env.E2E_ADMIN_PASS || "kjkszpj123" },
  student:       { base: BASE,  code: "hakwonplus", user: process.env.E2E_STUDENT_USER || "3333",        pass: process.env.E2E_STUDENT_PASS || "test1234" },
  "tchul-admin": { base: TCHUL, code: "tchul",      user: process.env.TCHUL_ADMIN_USER || "01035023313", pass: process.env.TCHUL_ADMIN_PASS || "727258" },
};

/**
 * 브라우저에서 실제 로그인
 *
 * 1. /login 접근 (호스트 기반 tenant 해석)
 * 2. "로그인" 확장 버튼 클릭 (formExpanded=false 상태)
 * 3. 아이디/비밀번호 입력
 * 4. 제출
 * 5. 대시보드 도착 대기
 */
export async function loginViaUI(page: Page, role: TenantRole): Promise<void> {
  const c = CREDS[role];

  // 1. 로그인 페이지 접근
  await page.goto(`${c.base}/login`, { waitUntil: "load" });

  // 2. "로그인" 확장 버튼 클릭 (초기 상태에서 폼이 숨겨져 있음)
  const expandBtn = page.getByTestId("login-expand-btn");
  await expandBtn.waitFor({ state: "visible", timeout: 20000 });
  await expandBtn.click();

  // 3. 아이디 입력
  const usernameInput = page.getByTestId("login-username");
  await usernameInput.waitFor({ state: "visible", timeout: 5000 });
  await usernameInput.fill(c.user);

  // 4. 비밀번호 입력
  const passwordInput = page.getByTestId("login-password");
  await passwordInput.fill(c.pass);

  // 5. 제출
  const submitBtn = page.getByTestId("login-submit");
  await submitBtn.click();

  // 6. 로그인 성공 대기 — URL이 /login에서 벗어나면 성공
  await page.waitForFunction(
    () => !window.location.pathname.startsWith("/login"),
    { timeout: 20000 },
  );
}

export function getBaseUrl(role?: TenantRole | string): string {
  if (role === "tchul-admin") return TCHUL;
  if (role === "sswe-admin") return SSWE;
  return BASE;
}
