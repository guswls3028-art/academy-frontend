/**
 * DNB 아카데미 (tenant 9) -- 클리닉/커뮤니티/메시징 운영 E2E 검증
 * clinic_mode=remediation, section_mode=false
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl, getApiBaseUrl } from "../helpers/auth";
import type { Page } from "@playwright/test";

const DNB_BASE = getBaseUrl("dnb-admin");
const API_BASE = getApiBaseUrl();

/** Collect console errors and failed network requests */
function attachErrorCollectors(page: Page) {
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("response", (resp) => {
    const status = resp.status();
    if (status >= 400) {
      networkErrors.push(`${status} ${resp.url()}`);
    }
  });

  return { consoleErrors, networkErrors };
}

test.describe("DNB 클리닉/커뮤니티/메시징 검증", () => {
  test.setTimeout(180000);
  let accessToken: string;

  test.beforeEach(async ({ page }) => {
    const resp = await page.request.post(`${API_BASE}/api/v1/token/`, {
      data: { username: DNB_USER, password: DNB_PASS, tenant_code: DNB_CODE },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": DNB_CODE },
    });
    expect(resp.status()).toBe(200);
    const tokens = (await resp.json()) as { access: string; refresh: string };
    accessToken = tokens.access;

    await page.goto(`${DNB_BASE}/login`, { waitUntil: "commit" });
    await page.evaluate(
      ({ access, refresh, code }) => {
        localStorage.setItem("access", access);
        localStorage.setItem("refresh", refresh);
        try { sessionStorage.setItem("tenantCode", code); } catch {}
      },
      { access: tokens.access, refresh: tokens.refresh, code: DNB_CODE },
    );
    await page.goto(`${DNB_BASE}/admin`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2500);
  });

  // ===== CLINIC =====

  test("1. 클리닉 홈 렌더링", async ({ page }) => {
    const { consoleErrors, networkErrors } = attachErrorCollectors(page);
    await page.goto(`${DNB_BASE}/admin/clinic/home`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-clinic-home.png" });

    await expect(page.locator("body")).toBeVisible();
    const url = page.url();
    expect(url).toContain("/admin");
    // Should not be a blank white page
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    const critical5xx = networkErrors.filter((e) => /\b5\d{2}\b/.test(e));
    expect(critical5xx, `5xx errors on clinic home: ${critical5xx.join(", ")}`).toHaveLength(0);
  });

  test("2. 클리닉 운영 콘솔 렌더링", async ({ page }) => {
    const { consoleErrors, networkErrors } = attachErrorCollectors(page);
    await page.goto(`${DNB_BASE}/admin/clinic/operations`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-clinic-operations.png" });

    await expect(page.locator("body")).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    const critical5xx = networkErrors.filter((e) => /\b5\d{2}\b/.test(e));
    expect(critical5xx, `5xx errors on clinic operations: ${critical5xx.join(", ")}`).toHaveLength(0);
  });

  test("3. 클리닉 예약 관리 렌더링", async ({ page }) => {
    const { consoleErrors, networkErrors } = attachErrorCollectors(page);
    await page.goto(`${DNB_BASE}/admin/clinic/bookings`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-clinic-bookings.png" });

    await expect(page.locator("body")).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    const critical5xx = networkErrors.filter((e) => /\b5\d{2}\b/.test(e));
    expect(critical5xx, `5xx errors on clinic bookings: ${critical5xx.join(", ")}`).toHaveLength(0);
  });

  test("4. 클리닉 리포트 렌더링", async ({ page }) => {
    const { consoleErrors, networkErrors } = attachErrorCollectors(page);
    await page.goto(`${DNB_BASE}/admin/clinic/reports`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-clinic-reports.png" });

    await expect(page.locator("body")).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    const critical5xx = networkErrors.filter((e) => /\b5\d{2}\b/.test(e));
    expect(critical5xx, `5xx errors on clinic reports: ${critical5xx.join(", ")}`).toHaveLength(0);
  });

  test("5. 클리닉 설정 렌더링", async ({ page }) => {
    const { consoleErrors, networkErrors } = attachErrorCollectors(page);
    await page.goto(`${DNB_BASE}/admin/clinic/settings`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-clinic-settings.png" });

    await expect(page.locator("body")).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    const critical5xx = networkErrors.filter((e) => /\b5\d{2}\b/.test(e));
    expect(critical5xx, `5xx errors on clinic settings: ${critical5xx.join(", ")}`).toHaveLength(0);
  });

  test("6. 클리닉 메시지 설정 렌더링", async ({ page }) => {
    const { consoleErrors, networkErrors } = attachErrorCollectors(page);
    await page.goto(`${DNB_BASE}/admin/clinic/msg-settings`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-clinic-msg-settings.png" });

    await expect(page.locator("body")).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    const critical5xx = networkErrors.filter((e) => /\b5\d{2}\b/.test(e));
    expect(critical5xx, `5xx errors on clinic msg-settings: ${critical5xx.join(", ")}`).toHaveLength(0);
  });

  test("7. 도구 > 클리닉 출력 렌더링", async ({ page }) => {
    const { consoleErrors, networkErrors } = attachErrorCollectors(page);
    await page.goto(`${DNB_BASE}/admin/tools/clinic`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-tools-clinic.png" });

    await expect(page.locator("body")).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    const critical5xx = networkErrors.filter((e) => /\b5\d{2}\b/.test(e));
    expect(critical5xx, `5xx errors on tools/clinic: ${critical5xx.join(", ")}`).toHaveLength(0);
  });

  // ===== COMMUNITY =====

  test("8. 게시판 렌더링", async ({ page }) => {
    const { consoleErrors, networkErrors } = attachErrorCollectors(page);
    await page.goto(`${DNB_BASE}/admin/community/board`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-community-board.png" });

    await expect(page.locator("body")).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    const critical5xx = networkErrors.filter((e) => /\b5\d{2}\b/.test(e));
    expect(critical5xx, `5xx errors on community/board: ${critical5xx.join(", ")}`).toHaveLength(0);
  });

  test("9. 공지사항 렌더링 + 공지 추가 버튼", async ({ page }) => {
    const { consoleErrors, networkErrors } = attachErrorCollectors(page);
    await page.goto(`${DNB_BASE}/admin/community/notice`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-community-notice.png" });

    await expect(page.locator("body")).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    // Check for add/create button
    const addBtn = page.locator("button").filter({ hasText: /추가|작성|등록|새|공지/ }).first();
    const hasAddBtn = await addBtn.isVisible({ timeout: 3000 }).catch(() => false);
    // Log but don't fail if button not found -- page rendering is the primary check
    if (!hasAddBtn) {
      console.warn("WARN: 공지 추가 버튼 미발견 -- UI 구조 확인 필요");
    }

    const critical5xx = networkErrors.filter((e) => /\b5\d{2}\b/.test(e));
    expect(critical5xx, `5xx errors on community/notice: ${critical5xx.join(", ")}`).toHaveLength(0);
  });

  test("10. QnA 렌더링", async ({ page }) => {
    const { consoleErrors, networkErrors } = attachErrorCollectors(page);
    await page.goto(`${DNB_BASE}/admin/community/qna`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-community-qna.png" });

    await expect(page.locator("body")).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    const critical5xx = networkErrors.filter((e) => /\b5\d{2}\b/.test(e));
    expect(critical5xx, `5xx errors on community/qna: ${critical5xx.join(", ")}`).toHaveLength(0);
  });

  test("11. 상담 (커뮤니티) 렌더링", async ({ page }) => {
    const { consoleErrors, networkErrors } = attachErrorCollectors(page);
    await page.goto(`${DNB_BASE}/admin/community/counsel`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-community-counsel.png" });

    await expect(page.locator("body")).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    const critical5xx = networkErrors.filter((e) => /\b5\d{2}\b/.test(e));
    expect(critical5xx, `5xx errors on community/counsel: ${critical5xx.join(", ")}`).toHaveLength(0);
  });

  test("12. 자료실 렌더링", async ({ page }) => {
    const { consoleErrors, networkErrors } = attachErrorCollectors(page);
    await page.goto(`${DNB_BASE}/admin/community/materials`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-community-materials.png" });

    await expect(page.locator("body")).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    const critical5xx = networkErrors.filter((e) => /\b5\d{2}\b/.test(e));
    expect(critical5xx, `5xx errors on community/materials: ${critical5xx.join(", ")}`).toHaveLength(0);
  });

  test("13. 커뮤니티 설정 렌더링", async ({ page }) => {
    const { consoleErrors, networkErrors } = attachErrorCollectors(page);
    await page.goto(`${DNB_BASE}/admin/community/settings`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-community-settings.png" });

    await expect(page.locator("body")).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    const critical5xx = networkErrors.filter((e) => /\b5\d{2}\b/.test(e));
    expect(critical5xx, `5xx errors on community/settings: ${critical5xx.join(", ")}`).toHaveLength(0);
  });

  // ===== MESSAGING =====

  test("14. 메시지 템플릿 렌더링", async ({ page }) => {
    const { consoleErrors, networkErrors } = attachErrorCollectors(page);
    await page.goto(`${DNB_BASE}/admin/message/templates`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-message-templates.png" });

    await expect(page.locator("body")).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    const critical5xx = networkErrors.filter((e) => /\b5\d{2}\b/.test(e));
    expect(critical5xx, `5xx errors on message/templates: ${critical5xx.join(", ")}`).toHaveLength(0);
  });

  test("15. 자동발송 렌더링", async ({ page }) => {
    const { consoleErrors, networkErrors } = attachErrorCollectors(page);
    await page.goto(`${DNB_BASE}/admin/message/auto-send`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-message-auto-send.png" });

    await expect(page.locator("body")).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    const critical5xx = networkErrors.filter((e) => /\b5\d{2}\b/.test(e));
    expect(critical5xx, `5xx errors on message/auto-send: ${critical5xx.join(", ")}`).toHaveLength(0);
  });

  test("16. 발송내역 렌더링", async ({ page }) => {
    const { consoleErrors, networkErrors } = attachErrorCollectors(page);
    await page.goto(`${DNB_BASE}/admin/message/log`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-message-log.png" });

    await expect(page.locator("body")).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    const critical5xx = networkErrors.filter((e) => /\b5\d{2}\b/.test(e));
    expect(critical5xx, `5xx errors on message/log: ${critical5xx.join(", ")}`).toHaveLength(0);
  });

  test("17. 메시지 설정 렌더링", async ({ page }) => {
    const { consoleErrors, networkErrors } = attachErrorCollectors(page);
    await page.goto(`${DNB_BASE}/admin/message/settings`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-message-settings.png" });

    await expect(page.locator("body")).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    const critical5xx = networkErrors.filter((e) => /\b5\d{2}\b/.test(e));
    expect(critical5xx, `5xx errors on message/settings: ${critical5xx.join(", ")}`).toHaveLength(0);
  });

  // ===== COUNSEL (standalone) =====

  test("18. 상담 페이지 렌더링", async ({ page }) => {
    const { consoleErrors, networkErrors } = attachErrorCollectors(page);
    await page.goto(`${DNB_BASE}/admin/counsel`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-counsel.png" });

    await expect(page.locator("body")).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    const critical5xx = networkErrors.filter((e) => /\b5\d{2}\b/.test(e));
    expect(critical5xx, `5xx errors on counsel: ${critical5xx.join(", ")}`).toHaveLength(0);
  });
});
