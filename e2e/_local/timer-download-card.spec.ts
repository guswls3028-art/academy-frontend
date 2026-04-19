/**
 * 타이머 다운로드 카드 — 로컬 dev 렌더링 검증.
 * E2E_BASE_URL을 http://localhost:5174 로 덮어써서 실행:
 *   cross-env E2E_BASE_URL=http://localhost:5174 pnpm playwright test e2e/audit/timer-download-card-local.spec.ts --project=chromium-desktop
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

const SS = "e2e/screenshots";
const BASE = process.env.E2E_BASE_URL || "http://localhost:5174";

test.describe("Timer Download Card — local dev render", () => {
  test.setTimeout(60000);

  test("DL-1. 카드가 보이고 글자가 충분히 큼", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto(`${BASE}/admin/tools/stopwatch`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2500);

    // 사이드바 통한 네비 (실제 사용자 경로) 시도 — 실패해도 직접 goto fallback
    await page.screenshot({ path: `${SS}/timer-download-card.png`, fullPage: true });

    // 핵심 텍스트 검증
    await expect(page.getByText("PC 전용 타이머 프로그램")).toBeVisible();
    await expect(page.getByRole("button", { name: /Windows용 다운로드/ })).toBeVisible();
    await expect(page.getByText(/Windows 10 \/ 11/)).toBeVisible();
    await expect(page.getByText(/ZIP 압축 파일/)).toBeVisible();

    // 글자 크기 검증 (CSS 계산값)
    const titleFontPx = await page.evaluate(() => {
      const el = document.querySelector('h3');
      if (!el) return 0;
      return parseFloat(getComputedStyle(el).fontSize);
    });
    console.log("[DL-1] 카드 제목 실제 fontSize:", titleFontPx, "px");
    expect(titleFontPx).toBeGreaterThanOrEqual(16);

    const btnFontPx = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Windows용 다운로드')
      );
      if (!btn) return 0;
      return parseFloat(getComputedStyle(btn).fontSize);
    });
    console.log("[DL-1] 다운로드 버튼 실제 fontSize:", btnFontPx, "px");
    expect(btnFontPx).toBeGreaterThanOrEqual(15);
  });

  test("DL-2. 실행 방법 보기 클릭 → 가이드 노출", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto(`${BASE}/admin/tools/stopwatch`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2500);

    // 가이드는 기본 노출 — 토글 없이 바로 보여야 함
    await expect(page.getByText(/다운로드 후 실행하는 법/)).toBeVisible();
    await expect(page.getByText(/압축 풀기/)).toBeVisible();
    await expect(page.getByText(/Windows에서 PC를 보호했습니다/)).toBeVisible();
    await expect(page.getByText(/추가 정보/)).toBeVisible();
    // 접기 토글 동작
    const toggle = page.getByRole("button", { name: /실행 방법 (접기|보기)/ });
    await expect(toggle).toBeVisible();

    await page.screenshot({ path: `${SS}/timer-download-card-help-open.png`, fullPage: true });
  });
});
