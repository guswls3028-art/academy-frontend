/**
 * E2E Auth Helper — 실제 브라우저 로그인
 */
import { type Page } from "@playwright/test";

export type TenantRole = "admin" | "student" | "tchul-admin";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const TCHUL = process.env.TCHUL_BASE_URL || "https://tchul.com";
const SSWE = process.env.SSWE_BASE_URL || "https://sswe.co.kr";

const CREDS: Record<TenantRole, { base: string; code: string; user: string; pass: string }> = {
  admin:        { base: BASE,  code: "hakwonplus", user: process.env.E2E_ADMIN_USER || "admin97",       pass: process.env.E2E_ADMIN_PASS || "test1234" },
  student:      { base: BASE,  code: "hakwonplus", user: process.env.E2E_STUDENT_USER || "3333",        pass: process.env.E2E_STUDENT_PASS || "test1234" },
  "tchul-admin": { base: TCHUL, code: "tchul",      user: process.env.TCHUL_ADMIN_USER || "01035023313", pass: process.env.TCHUL_ADMIN_PASS || "727258" },
};

export async function loginViaUI(page: Page, role: TenantRole): Promise<void> {
  const c = CREDS[role];
  // 호스트 기반 tenant 해석: /login만으로 충분 (code 불필요)
  // /login/code → /login 리다이렉트 발생할 수 있으므로 /login 직접 사용
  await page.goto(`${c.base}/login`);
  await page.waitForLoadState("domcontentloaded");

  // 로그인 폼이 보일 때까지 대기
  const idInput = page.locator('input[name="username"], input[placeholder*="아이디"], input[type="text"]').first();
  await idInput.waitFor({ state: "visible", timeout: 10000 });
  await idInput.fill(c.user);
  await page.locator('input[type="password"]').first().fill(c.pass);

  // 제출
  await page.locator('button[type="submit"], button').filter({ hasText: /로그인/ }).first().click();

  // 대시보드 도착 대기
  await page.waitForURL(/\/(admin|student|dev)/, { timeout: 20000 });
}

export function getBaseUrl(role?: TenantRole | string): string {
  if (role === "tchul-admin") return TCHUL;
  if (role === "sswe-admin") return SSWE;
  return BASE;
}
