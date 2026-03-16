/**
 * E2E Auth Helper — 실제 브라우저 로그인
 */
import { type Page, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import * as fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const STORAGE_DIR = resolve(__dirname, "../.auth");

export type TenantRole =
  | "admin"      // T1 hakwonplus admin
  | "student"    // T1 hakwonplus student
  | "tchul-admin"
  | "sswe-admin";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const TCHUL = process.env.TCHUL_BASE_URL || "https://tchul.com";
const SSWE = process.env.SSWE_BASE_URL || "https://sswe.co.kr";

const CREDS: Record<TenantRole, { base: string; code: string; user: string; pass: string }> = {
  admin:       { base: BASE, code: "hakwonplus", user: process.env.E2E_ADMIN_USER || "admin97", pass: process.env.E2E_ADMIN_PASS || "test1234" },
  student:     { base: BASE, code: "hakwonplus", user: process.env.E2E_STUDENT_USER || "3333", pass: process.env.E2E_STUDENT_PASS || "test1234" },
  "tchul-admin": { base: TCHUL, code: "tchul", user: process.env.TCHUL_ADMIN_USER || "01035023313", pass: process.env.TCHUL_ADMIN_PASS || "727258" },
  "sswe-admin": { base: SSWE, code: "sswe", user: "admin", pass: "admin" },
};

/**
 * 브라우저에서 실제 로그인 — 로그인 페이지 → 폼 입력 → 제출 → 대시보드 도착
 */
export async function loginViaUI(page: Page, role: TenantRole): Promise<void> {
  const c = CREDS[role];
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

  // 대시보드 도착 대기 (superuser는 /dev로 갈 수 있음)
  await page.waitForURL(/\/(admin|student|dev)/, { timeout: 15000 });
}

export function getBaseUrl(role: TenantRole): string {
  return CREDS[role].base;
}
