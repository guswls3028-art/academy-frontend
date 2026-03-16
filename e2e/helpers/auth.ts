/**
 * E2E Auth Helper — 실제 브라우저 로그인 흐름
 * storageState 저장으로 세션 재사용 가능
 */
import { type Page, type BrowserContext, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_DIR = path.resolve(__dirname, "../.auth");

export type TenantRole = "tchul-admin" | "tchul-student" | "hakwonplus-admin" | "sswe-admin";

const CREDENTIALS: Record<TenantRole, { baseUrl: string; user: string; pass: string; tenantCode: string }> = {
  "tchul-admin": {
    baseUrl: process.env.TCHUL_BASE_URL || "https://tchul.com",
    user: process.env.TCHUL_ADMIN_USER || "01035023313",
    pass: process.env.TCHUL_ADMIN_PASS || "727258",
    tenantCode: "tchul",
  },
  "tchul-student": {
    baseUrl: process.env.TCHUL_BASE_URL || "https://tchul.com",
    user: process.env.TCHUL_STUDENT_USER || "01073361143",
    pass: process.env.TCHUL_STUDENT_PASS || "test1234",
    tenantCode: "tchul",
  },
  "hakwonplus-admin": {
    baseUrl: process.env.HAKWONPLUS_BASE_URL || "https://hakwonplus.com",
    user: process.env.HAKWONPLUS_ADMIN_USER || "admin97",
    pass: process.env.HAKWONPLUS_ADMIN_PASS || "test1234",
    tenantCode: "hakwonplus",
  },
  "sswe-admin": {
    baseUrl: process.env.SSWE_BASE_URL || "https://sswe.co.kr",
    user: "admin",
    pass: "admin",
    tenantCode: "sswe",
  },
};

/**
 * 브라우저에서 실제 로그인 수행
 * - 로그인 페이지 이동 → 아이디/비밀번호 입력 → 로그인 버튼 클릭 → 대시보드 도착 확인
 */
export async function loginViaUI(page: Page, role: TenantRole): Promise<void> {
  const cred = CREDENTIALS[role];
  const loginPath = `/login/${cred.tenantCode}`;

  await page.goto(`${cred.baseUrl}${loginPath}`);
  await page.waitForLoadState("networkidle");

  // 로그인 폼이 보일 때까지 대기 — "로그인" 또는 "시작" 버튼 클릭으로 폼 표시
  const loginBtn = page.locator("button").filter({ hasText: /로그인|시작/ }).first();
  if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await loginBtn.click();
  }

  // 아이디 입력
  const idInput = page.locator('input[name="username"], input[placeholder*="아이디"], input[placeholder*="ID"], input[type="text"]').first();
  await idInput.waitFor({ state: "visible", timeout: 5000 });
  await idInput.fill(cred.user);

  // 비밀번호 입력
  const pwInput = page.locator('input[type="password"]').first();
  await pwInput.fill(cred.pass);

  // 로그인 제출
  const submitBtn = page.locator('button[type="submit"], button').filter({ hasText: /로그인/ }).first();
  await submitBtn.click();

  // 페이지 전환 대기 — 대시보드 또는 메인으로
  await page.waitForURL(/\/(admin|student)/, { timeout: 15_000 });
}

/**
 * storageState 파일이 있으면 재사용, 없으면 로그인 후 저장
 */
export async function getAuthContext(
  context: BrowserContext,
  role: TenantRole,
): Promise<Page> {
  const stateFile = path.join(STORAGE_DIR, `${role}.json`);

  if (fs.existsSync(stateFile)) {
    // 기존 세션 재사용 시도 — 만료됐으면 재로그인
    const page = await context.newPage();
    try {
      await context.addCookies([]);
      // storageState는 context 생성 시 적용해야 하므로 여기서는 직접 로그인
    } catch {
      // ignore
    }
    await loginViaUI(page, role);
    return page;
  }

  const page = await context.newPage();
  await loginViaUI(page, role);

  // 세션 저장
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  await context.storageState({ path: stateFile });

  return page;
}

export { CREDENTIALS };
