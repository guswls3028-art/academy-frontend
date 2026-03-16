/**
 * E2E Auth Helper — 실제 브라우저 로그인
 *
 * E2E 테스트는 Tenant 2 (tchul.com) 전용.
 * Tenant 1은 개발 전용이므로 E2E 대상에서 제외.
 */
import { type Page, expect } from "@playwright/test";

export type TenantRole =
  | "admin"      // T2 tchul admin (owner)
  | "student";   // T2 tchul student

const BASE = process.env.E2E_BASE_URL || "https://tchul.com";

const CREDS: Record<TenantRole, { base: string; code: string; user: string; pass: string }> = {
  admin: {
    base: BASE,
    code: "tchul",
    user: process.env.E2E_ADMIN_USER || "",
    pass: process.env.E2E_ADMIN_PASS || "",
  },
  student: {
    base: BASE,
    code: "tchul",
    user: process.env.E2E_STUDENT_USER || "",
    pass: process.env.E2E_STUDENT_PASS || "",
  },
};

/**
 * 브라우저에서 실제 로그인 — 로그인 페이지 → 폼 입력 → 제출 → 대시보드 도착
 */
export async function loginViaUI(page: Page, role: TenantRole): Promise<void> {
  const c = CREDS[role];
  if (!c.user || !c.pass) {
    throw new Error(`E2E credentials not set for role "${role}". Set E2E_ADMIN_USER/PASS or E2E_STUDENT_USER/PASS.`);
  }

  await page.goto(`${c.base}/login/${c.code}`);
  await page.waitForLoadState("networkidle");

  // "로그인" 버튼으로 폼 열기 (일부 테넌트는 초기에 버튼만 보임)
  const openBtn = page.locator("button").filter({ hasText: /로그인|시작/ }).first();
  if (await openBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await openBtn.click();
    await page.waitForTimeout(500);
  }

  // 아이디
  const idInput = page.locator('input[name="username"], input[placeholder*="아이디"], input[type="text"]').first();
  await idInput.waitFor({ state: "visible", timeout: 5000 });
  await idInput.fill(c.user);

  // 비밀번호
  await page.locator('input[type="password"]').first().fill(c.pass);

  // 제출
  await page.locator('button[type="submit"], button').filter({ hasText: /로그인/ }).first().click();

  // 대시보드 도착 대기
  await page.waitForURL(/\/(admin|student|dev)/, { timeout: 15000 });
}

export function getBaseUrl(_role?: TenantRole): string {
  return BASE;
}
