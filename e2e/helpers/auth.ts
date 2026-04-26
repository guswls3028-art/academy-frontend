/**
 * E2E Auth Helper — API 토큰 + localStorage 방식 (CI headless 안정)
 *
 * 모든 테넌트 로그인을 이 파일로 통합.
 * 새 테넌트 추가 시 CREDS에 role 추가 + .env.e2e에 env var 추가.
 */
import { type Page } from "@playwright/test";

export type TenantRole =
  | "admin"
  | "student"
  | "tchul-admin"
  | "dnb-admin"
  | "limglish-admin";

/* ── Base URLs ── */
const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const API_BASE = process.env.E2E_API_URL || "https://api.hakwonplus.com";
const TCHUL = process.env.TCHUL_BASE_URL || "https://tchul.com";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _SSWE = process.env.SSWE_BASE_URL || "https://sswe.co.kr"; // 향후 sswe 테넌트 spec 추가 시 사용
const DNB = process.env.DNB_BASE_URL || "https://dnbacademy.co.kr";
const LIMGLISH = process.env.LIMGLISH_BASE_URL || "https://limglish.kr";

/* ── Credentials ── */
const CREDS: Record<TenantRole, { base: string; code: string; user: string; pass: string }> = {
  "admin":          { base: BASE,     code: "hakwonplus", user: process.env.E2E_ADMIN_USER      || "admin97",       pass: process.env.E2E_ADMIN_PASS      || "test1234" },
  "student":        { base: BASE,     code: "hakwonplus", user: process.env.E2E_STUDENT_USER    || "3333",          pass: process.env.E2E_STUDENT_PASS    || "test1234" },
  "tchul-admin":    { base: TCHUL,    code: "tchul",      user: process.env.TCHUL_ADMIN_USER    || "01035023313",   pass: process.env.TCHUL_ADMIN_PASS    || "727258" },
  "dnb-admin":      { base: DNB,      code: "dnb",        user: process.env.DNB_ADMIN_USER      || "dheksql88",     pass: process.env.DNB_ADMIN_PASS      || "dheksql0513" },
  "limglish-admin": { base: LIMGLISH, code: "limglish",   user: process.env.LIMGLISH_ADMIN_USER || "ggorno",        pass: process.env.LIMGLISH_ADMIN_PASS || "dlarmsgur12" },
};

/**
 * API 기반 로그인 (모든 테넌트 공통)
 * 1. JWT 토큰 API 호출
 * 2. localStorage 토큰 주입
 * 3. 대시보드 이동
 */
export async function loginViaUI(page: Page, role: TenantRole): Promise<void> {
  const c = CREDS[role];

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

  const dashPath = role === "student" ? "/student" : "/admin";

  await page.goto(`${c.base}/login`, { waitUntil: "commit" });

  await page.evaluate(({ access, refresh, code }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    try { sessionStorage.setItem("tenantCode", code); } catch { /* sessionStorage 차단 환경(비활성 쿠키 등) 무시 */ }
  }, { access: tokens.access, refresh: tokens.refresh, code: c.code });

  await page.goto(`${c.base}${dashPath}`, { waitUntil: "load", timeout: 20000 });

  // SPA 의 useEffect 데이터 fetch 안정화 — networkidle 기반 (waitForTimeout 제거)
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

/**
 * 테넌트별 base URL 조회
 */
export function getBaseUrl(role?: TenantRole | string): string {
  if (role === "tchul-admin") return TCHUL;
  if (role === "dnb-admin") return DNB;
  if (role === "limglish-admin") return LIMGLISH;
  return BASE;
}

/**
 * API base URL 조회
 */
export function getApiBaseUrl(): string {
  return API_BASE;
}
