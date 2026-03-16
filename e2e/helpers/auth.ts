/**
 * E2E Auth Helper — 실제 UI 로그인 (브라우저 클릭)
 */
import { type Page } from "@playwright/test";

export type TenantRole = "admin" | "student" | "tchul-admin";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const TCHUL = process.env.TCHUL_BASE_URL || "https://tchul.com";
const SSWE = process.env.SSWE_BASE_URL || "https://sswe.co.kr";

const CREDS: Record<TenantRole, { base: string; code: string; user: string; pass: string }> = {
  admin:         { base: BASE,  code: "hakwonplus", user: process.env.E2E_ADMIN_USER || "admin97",       pass: process.env.E2E_ADMIN_PASS || "test1234" },
  student:       { base: BASE,  code: "hakwonplus", user: process.env.E2E_STUDENT_USER || "3333",        pass: process.env.E2E_STUDENT_PASS || "test1234" },
  "tchul-admin": { base: TCHUL, code: "tchul",      user: process.env.TCHUL_ADMIN_USER || "01035023313", pass: process.env.TCHUL_ADMIN_PASS || "727258" },
};

export async function loginViaUI(page: Page, role: TenantRole): Promise<void> {
  const c = CREDS[role];
  await page.goto(`${c.base}/login/${c.code}`);
  await page.waitForLoadState("load");

  // "로그인" 버튼으로 폼 열기
  const openBtn = page.locator("button").filter({ hasText: /로그인|시작/ }).first();
  if (await openBtn.isVisible({ timeout: 15000 }).catch(() => false)) {
    await openBtn.click();
    await page.waitForTimeout(500);
  }

  // 아이디 (type="" 또는 type 없음 — input[type="text"] 매치 안 됨)
  const idInput = page.locator('input[name="username"]').first();
  await idInput.waitFor({ state: "visible", timeout: 20000 });
  await idInput.fill(c.user);

  // 비밀번호
  await page.locator('input[type="password"]').first().fill(c.pass);

  // 로그인
  await page.locator('button[type="submit"], button').filter({ hasText: /로그인/ }).first().click();

  // 대시보드 도착 대기
  await page.waitForURL(/\/(admin|student|dev)/, { timeout: 20000 });
  await page.waitForTimeout(2000);
}

export async function loginDirect(page: Page, base: string, code: string, user: string, pass: string): Promise<void> {
  await page.goto(`${base}/login/${code}`);
  await page.waitForLoadState("load");

  const openBtn = page.locator("button").filter({ hasText: /로그인|시작/ }).first();
  if (await openBtn.isVisible({ timeout: 15000 }).catch(() => false)) {
    await openBtn.click();
    await page.waitForTimeout(500);
  }

  const idInput2 = page.locator('input[name="username"]').first();
  await idInput2.waitFor({ state: "visible", timeout: 20000 });
  await idInput2.fill(user);
  await page.locator('input[name="password"], input[type="password"]').first().fill(pass);
  await page.locator('button[type="submit"], button').filter({ hasText: /로그인/ }).first().click();
  await page.waitForURL(/\/(admin|student|dev)/, { timeout: 20000 });
  await page.waitForTimeout(2000);
}

export function getBaseUrl(role?: TenantRole | string): string {
  if (role === "tchul-admin") return TCHUL;
  if (role === "sswe-admin") return SSWE;
  return BASE;
}
