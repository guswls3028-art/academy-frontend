/**
 * E2E Auth Helper — API 토큰 + localStorage 방식 (CI headless 안정)
 *
 * Tenant 1 (hakwonplus) = production-like test tenant.
 * 브라우저 UI 로그인 대신 API로 JWT 획득 → localStorage 주입 → 페이지 로드.
 */
import { type Page, type APIRequestContext } from "@playwright/test";

export type TenantRole = "admin" | "student" | "tchul-admin";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const API_BASE = process.env.E2E_API_URL || process.env.API_BASE_URL || "https://api.hakwonplus.com";
const TCHUL = process.env.TCHUL_BASE_URL || "https://tchul.com";
const SSWE = process.env.SSWE_BASE_URL || "https://sswe.co.kr";

const CREDS: Record<TenantRole, { base: string; code: string; user: string; pass: string }> = {
  admin:         { base: BASE,  code: "hakwonplus", user: process.env.E2E_ADMIN_USER || "admin97",       pass: process.env.E2E_ADMIN_PASS || "test1234" },
  student:       { base: BASE,  code: "hakwonplus", user: process.env.E2E_STUDENT_USER || "3333",        pass: process.env.E2E_STUDENT_PASS || "test1234" },
  "tchul-admin": { base: TCHUL, code: "tchul",      user: process.env.TCHUL_ADMIN_USER || "01035023313", pass: process.env.TCHUL_ADMIN_PASS || "727258" },
};

/**
 * API 기반 로그인
 * 1. page.request로 JWT 토큰 API 직접 호출 (tenant_code body + X-Tenant-Code header)
 * 2. 프론트앱 도메인에서 localStorage 토큰 주입
 * 3. 대시보드 이동
 */
export async function loginViaUI(page: Page, role: TenantRole): Promise<void> {
  const c = CREDS[role];

  // 1. JWT 토큰 획득 — API 직접 호출 (프론트 login 함수와 동일한 형태)
  const resp = await page.request.post(`${API_BASE}/api/v1/token/`, {
    data: { username: c.user, password: c.pass, tenant_code: c.code },
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Code": c.code,
    },
    timeout: 60_000,
  });

  if (resp.status() !== 200) {
    const body = await resp.text();
    throw new Error(`E2E login failed for ${role} (${c.user}@${c.code}): ${resp.status()} ${body}`);
  }

  const tokens = await resp.json() as { access: string; refresh: string };

  // 2. 프론트앱 origin 확보 + localStorage 토큰 주입
  //    Playwright goto는 동일 origin이어야 localStorage 접근 가능
  const dashPath = role === "student" ? "/student" : "/admin";

  // about:blank에서는 origin이 없으므로 빈 페이지 로드
  await page.goto(`${c.base}/login`, { waitUntil: "commit" });

  // localStorage에 토큰 설정 (SPA 마운트 전)
  await page.evaluate(({ access, refresh, code }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    try { sessionStorage.setItem("tenantCode", code); } catch {}
  }, { access: tokens.access, refresh: tokens.refresh, code: c.code });

  // 3. 대시보드로 이동 — 이미 토큰이 있으므로 auth guard 통과
  await page.goto(`${c.base}${dashPath}`, { waitUntil: "load", timeout: 20000 });

  // SPA 마운트 대기
  await page.waitForTimeout(2000);
}

/** UI 기반 로그인 (로컬 개발용, CI에서는 사용하지 않음) */
export async function loginDirect(page: Page, base: string, code: string, user: string, pass: string): Promise<void> {
  await page.goto(`${base}/login/${code}`);
  await page.waitForLoadState("load");

  const openBtn = page.locator("button").filter({ hasText: /로그인|시작/ }).first();
  if (await openBtn.isVisible({ timeout: 15000 }).catch(() => false)) {
    await openBtn.click();
    await page.waitForTimeout(500);
  }

  const idInput = page.locator('input[name="username"]').first();
  await idInput.waitFor({ state: "visible", timeout: 20000 });
  await idInput.fill(user);
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
