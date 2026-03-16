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
  await page.goto(`${c.base}/login/${c.code}`);
  await page.waitForLoadState("networkidle");

  const openBtn = page.locator("button").filter({ hasText: /로그인|시작/ }).first();
  if (await openBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await openBtn.click();
    await page.waitForTimeout(500);
  }

  const idInput = page.locator('input[name="username"], input[placeholder*="아이디"], input[type="text"]').first();
  await idInput.waitFor({ state: "visible", timeout: 5000 });
  await idInput.fill(c.user);
  await page.locator('input[type="password"]').first().fill(c.pass);
  await page.locator('button[type="submit"], button').filter({ hasText: /로그인/ }).first().click();
  await page.waitForURL(/\/(admin|student|dev)/, { timeout: 15000 });
}

export function getBaseUrl(role?: TenantRole | string): string {
  if (role === "tchul-admin") return TCHUL;
  if (role === "sswe-admin") return SSWE;
  return BASE;
}
