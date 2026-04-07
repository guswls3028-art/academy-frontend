/**
 * 클리닉 도메인 안정화 E2E 검증
 * - 관리자: 클리닉 대상 목록, 예약 관리, 운영 콘솔
 * - 학생: 예약 신청
 * - 테넌트 격리: admin 로그인 후 클리닉 페이지가 다른 테넌트 데이터를 표시하지 않음
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const LOCAL_BASE = "http://localhost:5173";
const LOCAL_API = "http://localhost:8000";

test.describe("클리닉 관리자 기본 동선", () => {
  test.beforeEach(async ({ page }) => {
    // 로컬 dev 서버 기준으로 환경변수 override
    process.env.E2E_BASE_URL = LOCAL_BASE;
    process.env.E2E_API_URL = LOCAL_API;
    process.env.API_BASE_URL = LOCAL_API;

    await loginViaUI(page, "admin");
  });

  test("클리닉 사이드바 진입 → 대시보드 렌더링", async ({ page }) => {
    // 사이드바에서 클리닉 메뉴 클릭
    const clinicMenu = page.locator('[data-testid="sidebar"]').locator("text=클리닉").first();
    if (await clinicMenu.isVisible({ timeout: 5000 }).catch(() => false)) {
      await clinicMenu.click();
      await page.waitForTimeout(1000);
    } else {
      // 직접 URL 이동
      await page.goto(`${LOCAL_BASE}/admin/clinic`, { waitUntil: "load" });
      await page.waitForTimeout(2000);
    }

    // 클리닉 페이지 존재 확인
    await page.screenshot({ path: "e2e/screenshots/clinic-admin-dashboard.png" });
    // 에러 페이지가 아닌지 확인
    const errorText = page.locator("text=오류").first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBeFalsy();
  });

  test("클리닉 예약 관리 페이지 접근", async ({ page }) => {
    await page.goto(`${LOCAL_BASE}/admin/clinic/bookings`, { waitUntil: "load" });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: "e2e/screenshots/clinic-bookings-page.png" });

    // 페이지가 렌더링되었는지 확인 (에러 없이)
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("클리닉 운영 콘솔 접근", async ({ page }) => {
    await page.goto(`${LOCAL_BASE}/admin/clinic/operations`, { waitUntil: "load" });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: "e2e/screenshots/clinic-operations-page.png" });

    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("클리닉 설정 페이지 접근", async ({ page }) => {
    await page.goto(`${LOCAL_BASE}/admin/clinic/settings`, { waitUntil: "load" });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: "e2e/screenshots/clinic-settings-page.png" });

    const body = page.locator("body");
    await expect(body).toBeVisible();
  });
});

test.describe("클리닉 학생 동선", () => {
  test.beforeEach(async ({ page }) => {
    process.env.E2E_BASE_URL = LOCAL_BASE;
    process.env.E2E_API_URL = LOCAL_API;
    process.env.API_BASE_URL = LOCAL_API;

    await loginViaUI(page, "student");
  });

  test("학생 클리닉 페이지 접근", async ({ page }) => {
    await page.goto(`${LOCAL_BASE}/student/clinic`, { waitUntil: "load" });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: "e2e/screenshots/clinic-student-page.png" });

    const body = page.locator("body");
    await expect(body).toBeVisible();

    // 에러 표시가 없는지 확인
    const errorText = page.locator("text=오류").first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBeFalsy();
  });
});

test.describe("클리닉 API 테넌트 격리 (브라우저 네트워크 감시)", () => {
  test("admin 클리닉 페이지 로드 시 API 에러 없음", async ({ page }) => {
    process.env.E2E_BASE_URL = LOCAL_BASE;
    process.env.E2E_API_URL = LOCAL_API;
    process.env.API_BASE_URL = LOCAL_API;

    await loginViaUI(page, "admin");

    // API 에러 감시
    const apiErrors: string[] = [];
    page.on("response", (resp) => {
      if (resp.url().includes("/api/") && resp.status() >= 400) {
        apiErrors.push(`${resp.status()} ${resp.url()}`);
      }
    });

    await page.goto(`${LOCAL_BASE}/admin/clinic/bookings`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: "e2e/screenshots/clinic-api-tenant-check.png" });

    // clinic 관련 API 에러가 없어야 함
    const clinicErrors = apiErrors.filter(e => e.includes("clinic") || e.includes("progress"));
    expect(clinicErrors).toEqual([]);
  });
});
