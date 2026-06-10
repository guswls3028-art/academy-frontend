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

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isLocalOrPreviewBase(base: string): boolean {
  try {
    const hostname = new URL(base).hostname.trim().toLowerCase();
    return hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".pages.dev") ||
      hostname.endsWith(".trycloudflare.com");
  } catch {
    return false;
  }
}

function seedBrowserAuth({ access, refresh, code }: { access: string; refresh: string; code: string }): void {
  localStorage.setItem("access", access);
  localStorage.setItem("refresh", refresh);
  localStorage.setItem("tenant_code", code);
  try { sessionStorage.setItem("tenantCode", code); } catch { /* sessionStorage 차단 환경(비활성 쿠키 등) 무시 */ }
}

async function gotoCommitted(page: Page, url: string, timeout: number): Promise<void> {
  try {
    await page.goto(url, { waitUntil: "commit", timeout });
  } catch (error) {
    const message = String((error as Error)?.message || error);
    const recoverableNavigation =
      message.includes("NS_BINDING_ABORTED") ||
      message.includes("interrupted by another navigation") ||
      message.includes("__hplus_reload");
    if (!recoverableNavigation) throw error;
  }
}

/* ── Credentials ── */
const CREDS: Record<TenantRole, { base: string; code: string; userEnv: string; passEnv: string }> = {
  "admin":          { base: BASE,     code: "hakwonplus", userEnv: "E2E_ADMIN_USER",      passEnv: "E2E_ADMIN_PASS" },
  "student":        { base: BASE,     code: "hakwonplus", userEnv: "E2E_STUDENT_USER",    passEnv: "E2E_STUDENT_PASS" },
  "tchul-admin":    { base: TCHUL,    code: "tchul",      userEnv: "TCHUL_ADMIN_USER",    passEnv: "TCHUL_ADMIN_PASS" },
  "dnb-admin":      { base: DNB,      code: "dnb",        userEnv: "DNB_ADMIN_USER",      passEnv: "DNB_ADMIN_PASS" },
  "limglish-admin": { base: LIMGLISH, code: "limglish",   userEnv: "LIMGLISH_ADMIN_USER", passEnv: "LIMGLISH_ADMIN_PASS" },
};

function requiredEnv(name: string, role: TenantRole): string {
  const value = process.env[name];
  if (typeof value === "string" && value.trim()) return value.trim();
  throw new Error(`Missing required E2E credential env ${name} for role ${role}. See .env.e2e.example.`);
}

function resolveCred(role: TenantRole): { base: string; code: string; user: string; pass: string } {
  const c = CREDS[role];
  return {
    base: c.base,
    code: c.code,
    user: requiredEnv(c.userEnv, role),
    pass: requiredEnv(c.passEnv, role),
  };
}

/**
 * API 기반 로그인 (모든 테넌트 공통)
 * 1. JWT 토큰 API 호출
 * 2. localStorage 토큰 주입
 * 3. 대시보드 이동
 */
export async function loginViaUI(
  page: Page,
  role: TenantRole,
  options?: { landingPath?: string },
): Promise<void> {
  const c = resolveCred(role);

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

  const dashPath = options?.landingPath ?? (role === "student" ? "/student" : "/admin");
  const base = trimTrailingSlash(c.base);
  const loginPath = isLocalOrPreviewBase(base) ? `/login/${c.code}` : "/login";

  await page.addInitScript(seedBrowserAuth, { access: tokens.access, refresh: tokens.refresh, code: c.code });

  await gotoCommitted(page, `${base}${loginPath}`, 45_000);

  await page.evaluate(seedBrowserAuth, { access: tokens.access, refresh: tokens.refresh, code: c.code });

  await gotoCommitted(page, `${base}${dashPath}`, 45_000);
  await page.waitForLoadState("domcontentloaded", { timeout: 45_000 }).catch(() => undefined);

  // SPA 의 useEffect 데이터 fetch 안정화 — networkidle 기반 (waitForTimeout 제거)
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
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
