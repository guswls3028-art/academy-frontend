/**
 * 법적 고지 설정/공개 약관 — 운영 검증.
 *
 * 검증 흐름:
 * 1. 학원 정보 페이지 > 법적 정보 섹션이 정상 로드되는지 (관리자)
 * 2. 비로그인 PrivacyPage 가 200 으로 렌더링되고 플랫폼 운영사 정보가 표시되는지
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

test.describe("법적 고지 설정/공개 약관", () => {
  test("관리자: 학원 정보 > 법적 정보 섹션 렌더링", async ({ page }) => {
    test.setTimeout(60_000);
    await loginViaUI(page, "admin");

    await gotoAndSettle(page, `${BASE}/admin/settings/organization`, { timeout: 20_000 });

    // 법적 고지 정보 섹션 헤더가 렌더되어야 한다.
    await expect(page.getByText("법적 고지 정보").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/학원별 프로필|보호책임자|사업자/).first()).toBeVisible({ timeout: 10_000 });
  });

  test("PrivacyPage 비로그인 200 + 플랫폼 운영사 정보 렌더", async ({ page }) => {
    const res = await page.goto(`${BASE}/privacy`, { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBeLessThan(400);
    await expect(page.getByText(/개인정보처리방침/).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("학원플러스").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("608-35-75724").first()).toBeVisible({ timeout: 15_000 });
  });
});
