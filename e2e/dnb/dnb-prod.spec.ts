/**
 * DNB 운영 환경 전기능 E2E
 * 도메인: dnbacademy.co.kr
 * API: api.hakwonplus.com (X-Tenant-Code: dnb)
 */
import { test, expect } from "../fixtures/strictTest";
import { getBaseUrl, loginViaUI, hasRoleCredentials } from "../helpers/auth";
import type { Page } from "@playwright/test";

const DNB_BASE = getBaseUrl("dnb-admin");

async function loginDNB(page: Page) {
  await loginViaUI(page, "dnb-admin");
}

/** 페이지 렌더 에러 없음 확인 */
async function assertNoRenderError(page: Page) {
  const body = await page.textContent("body");
  expect(body).not.toContain("Cannot read properties");
  expect(body).not.toContain("Unexpected Application Error");
  return body ?? "";
}

/** API 요청이 dnb 테넌트인지 검증 */
function watchTenantHeaders(page: Page) {
  const headers: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("api.hakwonplus.com")) {
      const h = req.headers()["x-tenant-code"];
      if (h) headers.push(h);
    }
  });
  return headers;
}

// ============================================================
test.describe("DNB 운영 전기능", () => {
  test.skip(!hasRoleCredentials("dnb-admin"), "DNB_ADMIN_USER/PASS not configured in .env.e2e");

  test.setTimeout(120000);
  test.beforeEach(async ({ page }) => {
    await loginDNB(page);
  });

  test("테넌트 격리 — API 요청에 X-Tenant-Code: dnb", async ({ page }) => {
    const headers = watchTenantHeaders(page);
    await page.goto(`${DNB_BASE}/admin/students`);
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    expect(headers.length).toBeGreaterThan(0);
    for (const h of headers) expect(h).toBe("dnb");
  });

  test("대시보드", async ({ page }) => {
    await assertNoRenderError(page);
  });

  test("학생 관리", async ({ page }) => {
    await page.goto(`${DNB_BASE}/admin/students`);
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await assertNoRenderError(page);
  });

  test("강의 관리", async ({ page }) => {
    await page.goto(`${DNB_BASE}/admin/lectures`);
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await assertNoRenderError(page);
  });

  test("클리닉 홈", async ({ page }) => {
    await page.goto(`${DNB_BASE}/admin/clinic/home`);
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await assertNoRenderError(page);
  });

  test("클리닉 진행", async ({ page }) => {
    await page.goto(`${DNB_BASE}/admin/clinic/operations`);
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await assertNoRenderError(page);
  });

  test("클리닉 진행중 항목", async ({ page }) => {
    await page.goto(`${DNB_BASE}/admin/clinic/bookings`);
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await assertNoRenderError(page);

    // section_mode=false이므로 반 필터 없어야 함
    const sectionFilter = page.locator(".clinic-section-filter");
    await expect(sectionFilter).toHaveCount(0);
  });

  test("영상 관리", async ({ page }) => {
    await page.goto(`${DNB_BASE}/admin/videos`);
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await assertNoRenderError(page);
  });

  test("시험/성적", async ({ page }) => {
    await page.goto(`${DNB_BASE}/admin/exams`);
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await assertNoRenderError(page);
  });

  test("출석", async ({ page }) => {
    await page.goto(`${DNB_BASE}/admin/attendance`);
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await assertNoRenderError(page);
  });

  test("메시지 설정", async ({ page }) => {
    await page.goto(`${DNB_BASE}/admin/message/auto-send`);
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await assertNoRenderError(page);
  });
});
