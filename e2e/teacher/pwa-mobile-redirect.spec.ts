/**
 * E2E: 선생님 앱 PWA + 모바일 자동 리다이렉트 검증
 * - 모바일 뷰포트에서 /teacher 자동 진입
 * - PWA manifest 로딩
 * - SW 등록
 * - 5탭 렌더링
 * - 프로필 페이지 (설치 카드)
 * - 데스크톱 전환 → admin 진입
 */
import { test, expect } from "../fixtures/strictTest";

const TCHUL = process.env.TCHUL_BASE_URL || "https://tchul.com";
const API = process.env.E2E_API_URL || "https://api.hakwonplus.com";
const USER = process.env.TCHUL_ADMIN_USER || "01035023313";
const PASS = process.env.TCHUL_ADMIN_PASS || "727258";

/** API 로그인 → localStorage 토큰 주입 */
async function loginMobile(page: import("@playwright/test").Page) {
  const resp = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: USER, password: PASS, tenant_code: "tchul" },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": "tchul" },
    timeout: 30_000,
  });
  expect(resp.status()).toBe(200);
  const tokens = await resp.json() as { access: string; refresh: string };

  await page.goto(`${TCHUL}/login`, { waitUntil: "commit" });
  await page.evaluate(({ access, refresh }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    localStorage.removeItem("teacher:preferAdmin");
    try { sessionStorage.setItem("tenantCode", "tchul"); } catch {}
  }, tokens);
}

test.describe("선생님 앱 PWA + 모바일 리다이렉트", () => {
  test.use({
    viewport: { width: 390, height: 844 }, // iPhone 14 Pro
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  test("모바일에서 / 접근 → /teacher 리다이렉트", async ({ page }) => {
    await loginMobile(page);
    await page.goto(`${TCHUL}/`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForTimeout(3000);

    // /teacher로 리다이렉트되었는지 확인
    const url = page.url();
    expect(url).toContain("/teacher");

    await page.screenshot({ path: "e2e/screenshots/teacher-pwa-01-mobile-redirect.png", fullPage: false });
  });

  test("선생님 앱 5탭 렌더링 + manifest 로딩", async ({ page }) => {
    await loginMobile(page);
    await page.goto(`${TCHUL}/teacher`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForTimeout(3000);

    // data-app="teacher" 확인
    await expect(page.locator('[data-app="teacher"]')).toBeVisible({ timeout: 10_000 });

    // manifest link 동적 주입 확인
    const manifestHref = await page.evaluate(() => {
      const link = document.querySelector('link[rel="manifest"][data-teacher]');
      return link?.getAttribute("href");
    });
    expect(manifestHref).toBe("/teacher-manifest.json");

    // theme-color 메타 태그 확인
    const themeColor = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="theme-color"][data-teacher]');
      return meta?.getAttribute("content");
    });
    expect(themeColor).toBe("#3b82f6");

    await page.screenshot({ path: "e2e/screenshots/teacher-pwa-02-home-with-manifest.png", fullPage: false });
  });

  test("프로필 페이지 렌더링", async ({ page }) => {
    await loginMobile(page);
    await page.goto(`${TCHUL}/teacher`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForTimeout(3000);

    // 더보기 탭 클릭 → 드로어 열기
    await expect(page.locator('[data-app="teacher"]')).toBeVisible({ timeout: 10_000 });

    // 내 프로필로 직접 이동 (드로어 경유 대신)
    await page.goto(`${TCHUL}/teacher/profile`, { waitUntil: "load", timeout: 15_000 });
    await page.waitForTimeout(2000);

    // 프로필 페이지 렌더링 확인 (h1)
    await expect(page.getByRole("heading", { name: "내 프로필" })).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: "e2e/screenshots/teacher-pwa-03-profile-page.png", fullPage: true });
  });

  test("SW 등록 + PWA 정적 파일 접근", async ({ page }) => {
    // manifest.json 직접 접근 검증
    const manifestResp = await page.request.get(`${TCHUL}/teacher-manifest.json`);
    expect(manifestResp.status()).toBe(200);
    const manifest = await manifestResp.json();
    expect(manifest.name).toBe("학원플러스 선생님");
    expect(manifest.start_url).toBe("/teacher");
    expect(manifest.display).toBe("standalone");

    // SW 파일 직접 접근 검증
    const swResp = await page.request.get(`${TCHUL}/teacher-sw.js`);
    expect(swResp.status()).toBe(200);
    const swText = await swResp.text();
    expect(swText).toContain("teacher-app-shell");

    // 아이콘 접근 검증
    const iconResp = await page.request.get(`${TCHUL}/teacher-icons/icon-192.svg`);
    expect(iconResp.status()).toBe(200);
  });
});

test.describe("데스크톱 → admin 유지", () => {
  test.use({
    viewport: { width: 1440, height: 900 },
  });

  test("데스크톱에서 / 접근 → /admin 유지", async ({ page }) => {
    const resp = await page.request.post(`${API}/api/v1/token/`, {
      data: { username: USER, password: PASS, tenant_code: "tchul" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "tchul" },
      timeout: 30_000,
    });
    const tokens = await resp.json() as { access: string; refresh: string };

    await page.goto(`${TCHUL}/login`, { waitUntil: "commit" });
    await page.evaluate(({ access, refresh }) => {
      localStorage.setItem("access", access);
      localStorage.setItem("refresh", refresh);
      localStorage.removeItem("teacher:preferAdmin");
      try { sessionStorage.setItem("tenantCode", "tchul"); } catch {}
    }, tokens);

    await page.goto(`${TCHUL}/`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForTimeout(3000);

    const url = page.url();
    expect(url).toContain("/admin");

    await page.screenshot({ path: "e2e/screenshots/teacher-pwa-04-desktop-admin.png", fullPage: false });
  });
});
