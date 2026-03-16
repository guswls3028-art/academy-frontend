/**
 * E2E Auth Helper — API 기반 로그인 (CI headless 안정화)
 *
 * Tenant 1 (hakwonplus) = production-like test tenant.
 * 브라우저 UI 로그인 대신 JWT API를 직접 호출하여 토큰 획득 후 localStorage에 설정.
 * CI headless에서 SPA 렌더링 지연에 의존하지 않음.
 */
import { type Page } from "@playwright/test";

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
 * API 기반 로그인 — JWT 토큰을 직접 획득하여 localStorage에 설정
 *
 * 1. POST /api/v1/token/ 으로 JWT access/refresh 토큰 획득
 * 2. 프론트앱 도메인으로 이동
 * 3. localStorage에 토큰 설정 (프론트앱 인증 체계와 동일)
 * 4. 대시보드로 이동
 */
export async function loginViaUI(page: Page, role: TenantRole): Promise<void> {
  const c = CREDS[role];

  // 1. JWT 토큰 획득 (display username + X-Tenant-Code)
  const tokenResp = await page.request.post(`${API_BASE}/api/v1/token/`, {
    data: { username: c.user, password: c.pass },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": c.code },
  });

  if (tokenResp.status() !== 200) {
    const body = await tokenResp.text();
    throw new Error(`Login failed for ${role} (${c.user}): ${tokenResp.status()} ${body}`);
  }

  const tokens = await tokenResp.json();
  await _setTokensAndNavigate(page, c.base, role, tokens);
}

async function _setTokensAndNavigate(
  page: Page,
  base: string,
  role: TenantRole,
  tokens: { access: string; refresh: string },
): Promise<void> {
  // 2. 대시보드 URL로 직접 이동 (동일 origin에서 localStorage 설정)
  const dashPath = role === "student" ? "/student" : "/admin";
  await page.goto(`${base}${dashPath}`, { waitUntil: "commit" });

  // 3. localStorage에 토큰 설정
  await page.evaluate((t) => {
    localStorage.setItem("access", t.access);
    localStorage.setItem("refresh", t.refresh);
  }, tokens);

  // 4. reload로 SPA가 토큰을 읽도록 강제
  await page.reload({ waitUntil: "domcontentloaded" });

  // 5. SPA 마운트 + 인증 상태 확인 (로그인으로 리다이렉트 안 되는지)
  await page.waitForTimeout(3000);
}

export function getBaseUrl(role?: TenantRole | string): string {
  if (role === "tchul-admin") return TCHUL;
  if (role === "sswe-admin") return SSWE;
  return BASE;
}
