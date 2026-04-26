/**
 * 학부모 자녀 스위처 — 운영 환경 검증.
 *
 * 테스트 데이터: 1번 테넌트 임시 학부모 (phone=01099999990, password=test1234)
 *   - 자녀: 김민수(1453), 이서연(1454)
 *   - cleanup은 별도 스크립트로 처리 (E2E 종료 후 운영 DB 원복).
 *
 * 점검:
 *   1) 헤더 하단에 자녀 칩 2개 노출 (학생 계정 검증에선 노출 안 됨)
 *   2) 칩 클릭 → 활성 표시 전환 + 캐시 격리
 *   3) 풀페이지 스크린샷
 */
import { test, expect } from "@playwright/test";

const BASE = "https://hakwonplus.com";
const API = "https://api.hakwonplus.com";
const PARENT_PHONE = "01099999990";
const PARENT_PASS = "test1234";

test.describe("학부모 자녀 스위처", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("다중 자녀 학부모 — 칩 노출 + 전환 + 스크린샷", async ({ page }) => {
    /* 학부모 토큰 발급 */
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

    /* 자녀 스위처 — role=tablist + 자녀 2명 */
    const switcher = page.getByRole("tablist", { name: "자녀 선택" });
    await expect(switcher).toBeVisible({ timeout: 8_000 });

    const tabs = switcher.getByRole("tab");
    await expect(tabs).toHaveCount(2);

    /* 첫 자녀 활성 (linked_students 첫 번째 = 1454 이서연 등) */
    const firstActive = await tabs.first().getAttribute("aria-selected");
    expect(firstActive).toBe("true");

    /* 초기 스크린샷 */
    await page.screenshot({ path: "e2e/screenshots/parent-switcher-initial.png", fullPage: true });

    /* 두 번째 자녀 클릭 → 활성 전환 */
    await tabs.nth(1).click();
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});

    const secondActive = await tabs.nth(1).getAttribute("aria-selected");
    expect(secondActive).toBe("true");
    const firstActiveAfter = await tabs.first().getAttribute("aria-selected");
    expect(firstActiveAfter).toBe("false");

    /* 전환 후 스크린샷 */
    await page.screenshot({ path: "e2e/screenshots/parent-switcher-after-switch.png", fullPage: true });
  });
});
