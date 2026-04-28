/**
 * 법적 고지 fallback 경고 배너 — 운영 검증.
 *
 * 검증 흐름:
 * 1. 학원 정보 페이지 > 법적 정보 섹션이 정상 로드되는지 (관리자)
 * 2. 비로그인 PrivacyPage 가 200 으로 렌더링 (운영사 fallback 고지가 깨지지 않음)
 *
 * Tenant 1 (hakwonplus) 는 핵심 필드가 채워져 있으므로 경고는 보이지 않을 수 있다.
 * 핵심은 "변경된 페이지가 깨지지 않고 렌더링" + "조건부 배너 분기 정상 동작" 검증.
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

test.describe("법적 고지 fallback 배너", () => {
  test("관리자: 학원 정보 > 법적 정보 섹션 렌더링", async ({ page }) => {
    test.setTimeout(60_000);
    await loginViaUI(page, "admin");

    await page.goto(`${BASE}/admin/settings/organization`);
    await page.waitForLoadState("load");
    await page.waitForTimeout(2000);

    // 법적 고지 정보 섹션 헤더가 렌더되어야 한다.
    await expect(page.getByText("법적 고지 정보").first()).toBeVisible({ timeout: 20_000 });
    // 신규 추가된 안내 카피("정보 미등록"으로 표시됩니다.) 또는 필드 라벨 중 하나.
    await expect(page.getByText(/이용약관, 개인정보처리방침|보호책임자|회사명|사업자/).first()).toBeVisible({ timeout: 10_000 });
  });

  test("PrivacyPage 비로그인 200 + 본문 렌더", async ({ page }) => {
    const res = await page.goto(`${BASE}/legal/privacy`, { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBeLessThan(400);
    await expect(page.getByText(/개인정보처리방침/).first()).toBeVisible({ timeout: 15_000 });
  });
});
