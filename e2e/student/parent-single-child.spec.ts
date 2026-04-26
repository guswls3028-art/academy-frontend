/**
 * 자녀 1명 학부모 — 자녀 스위처 미노출 + TopBar displayName 노출 확인.
 * 테스트 학부모(01099999990 / test1234) 자녀 1명만 매핑된 상태에서 실행.
 */
import { test, expect } from "@playwright/test";

const BASE = "https://hakwonplus.com";
const API = "https://api.hakwonplus.com";
const PARENT_PHONE = "01099999990";
const PARENT_PASS = "test1234";

test.describe("자녀 1명 학부모", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("스위처 미노출 + TopBar displayName 노출 + 스크린샷", async ({ page }) => {
    const resp = await page.request.post(`${API}/api/v1/token/`, {
      data: { username: PARENT_PHONE, password: PARENT_PASS, tenant_code: "hakwonplus" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
      timeout: 60_000,
    });
    expect(resp.status()).toBe(200);
    const tokens = await resp.json() as { access: string; refresh: string };

    await page.goto(`${BASE}/login`, { waitUntil: "commit" });
    await page.evaluate(({ access, refresh }) => {
      localStorage.setItem("access", access);
      localStorage.setItem("refresh", refresh);
      sessionStorage.setItem("tenantCode", "hakwonplus");
    }, tokens);

    await page.goto(`${BASE}/student/dashboard`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {});

    /* 자녀 스위처(role=tablist) 노출 안 됨 — 자녀 1명이라 display:none 또는 미렌더 */
    await expect(page.getByRole("tablist", { name: "자녀 선택" })).toHaveCount(0);

    /* TopBar displayName 노출 — 자녀 이름이 우상단에 (학부모 모드 단일 채널) */
    const topbarName = page.locator(".stu-topbar__name");
    await expect(topbarName).toBeVisible({ timeout: 8_000 });

    await page.screenshot({ path: "e2e/screenshots/parent-single-child.png", fullPage: true });
  });
});
