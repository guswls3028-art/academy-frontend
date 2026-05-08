/**
 * 최종 종합 시각 검증 (2026-05-06).
 *
 * 사용자 명시: "복구 / 자동분리 / 중대부고 초안 / 개선사항 + 리스크 — 서비스 마인드"
 *
 * 검증:
 *   1. 보고서 #14 중대부고 — 학원장 3 entries 보존 + 자동 33 entries 합쳐짐
 *   2. 보고서 #25/#27 — 학원장 selected 자료 표시 (indexable 복구 후)
 *   3. T2 자동분리 sample — V11 reanalyze 후 자료 분리 상태
 *
 * 출력: _artifacts/sessions/matchup-rebuild-2026-05-05/final_verification/
 */
import { test } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import { mkdirSync } from "fs";

const OUT_DIR = "C:/academy/_artifacts/sessions/matchup-rebuild-2026-05-05/final_verification";
mkdirSync(OUT_DIR, { recursive: true });

const TCHUL = process.env.TCHUL_BASE_URL || "https://tchul.com";

test.describe("최종 종합 시각 검증", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${TCHUL}/admin/storage/matchup`, { waitUntil: "load", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2500);
  });

  test("01 매치업 페이지 진입", async ({ page }) => {
    await page.screenshot({ path: `${OUT_DIR}/01_matchup_landing.png`, fullPage: true });
  });

  test("02 학원장 적중 보고서 모음", async ({ page }) => {
    const reportListBtn = page.getByText(/학원 적중 보고서 모음/, { exact: false }).first();
    if (await reportListBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await reportListBtn.click({ timeout: 5000 });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${OUT_DIR}/02_hit_report_list.png`, fullPage: true });
    }
  });

  test("03 보고서 #14 중대부고 진입 — 학원장 3 + 자동 33 entries", async ({ page }) => {
    // 보고서 모음 진입
    const reportListBtn = page.getByText(/학원 적중 보고서 모음/, { exact: false }).first();
    if (await reportListBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await reportListBtn.click({ timeout: 5000 });
      await page.waitForTimeout(2500);
    }

    // #14 보고서 클릭 (중대부고)
    const report14 = page.locator('text=/중대부고.*기출 통과|2026 중대부고 1학기/').first();
    if (await report14.isVisible({ timeout: 3000 }).catch(() => false)) {
      await report14.click({ timeout: 5000 });
      await page.waitForTimeout(4000);
      await page.screenshot({ path: `${OUT_DIR}/03_report14_landing.png`, fullPage: true });

      // 첫 problem 클릭 (q=1, 자동 셋팅)
      const firstProblem = page.locator('[data-testid="matchup-problem-card"]').first();
      if (await firstProblem.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstProblem.click({ timeout: 5000 });
        await page.waitForTimeout(3500);
        await page.screenshot({ path: `${OUT_DIR}/03b_report14_q1_auto.png`, fullPage: true });
      }

      // q=3 학원장 작성 (excluded) — 3번째 problem 클릭
      const thirdProblem = page.locator('[data-testid="matchup-problem-card"]').nth(2);
      if (await thirdProblem.isVisible({ timeout: 3000 }).catch(() => false)) {
        await thirdProblem.click({ timeout: 5000 });
        await page.waitForTimeout(3500);
        await page.screenshot({ path: `${OUT_DIR}/03c_report14_q3_owner_excluded.png`, fullPage: true });
      }

      // q=5 학원장 작성 (sel=[76710])
      const fifthProblem = page.locator('[data-testid="matchup-problem-card"]').nth(4);
      if (await fifthProblem.isVisible({ timeout: 3000 }).catch(() => false)) {
        await fifthProblem.click({ timeout: 5000 });
        await page.waitForTimeout(3500);
        await page.screenshot({ path: `${OUT_DIR}/03d_report14_q5_owner_selected.png`, fullPage: true });
      }
    }
  });

  test("04 보고서 #25 숙명여고 — indexable 복구 검증", async ({ page }) => {
    const reportListBtn = page.getByText(/학원 적중 보고서 모음/, { exact: false }).first();
    if (await reportListBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await reportListBtn.click({ timeout: 5000 });
      await page.waitForTimeout(2500);
    }

    const report25 = page.locator('text=/숙명여고.*1학기 중간/').first();
    if (await report25.isVisible({ timeout: 3000 }).catch(() => false)) {
      await report25.click({ timeout: 5000 });
      await page.waitForTimeout(4000);
      await page.screenshot({ path: `${OUT_DIR}/04_report25_sukmyeong.png`, fullPage: true });

      // 첫 problem (학원장 작성 entry)
      const firstProblem = page.locator('[data-testid="matchup-problem-card"]').first();
      if (await firstProblem.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstProblem.click({ timeout: 5000 });
        await page.waitForTimeout(3500);
        await page.screenshot({ path: `${OUT_DIR}/04b_report25_q1_owner.png`, fullPage: true });
      }
    }
  });

  test("05 자동분리 sample — 메인자료 자료 시각", async ({ page }) => {
    const searchBox = page.locator('input[placeholder*="검색"], input[placeholder*="제목"]').first();
    await searchBox.waitFor({ state: "visible", timeout: 10_000 });

    // sample 1: 메인자료 (V11 reanalyze 영향 — 자동분리 회복 가능성)
    await searchBox.click();
    await searchBox.fill("빅뱅과 원소의 생성 중대부고");
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT_DIR}/05a_search_빅뱅중대부고.png`, fullPage: true });

    const firstDoc = page.locator(`text=/빅뱅과.*중대부고/`).first();
    if (await firstDoc.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstDoc.click({ timeout: 5000 });
      await page.waitForTimeout(3500);
      await page.screenshot({ path: `${OUT_DIR}/05b_doc123_빅뱅중대부고_after_v11.png`, fullPage: true });
    }

    // sample 2: 학생 시험사진 (V11 분리 결과)
    await searchBox.click({ clickCount: 3 });
    await page.keyboard.press("Backspace");
    await searchBox.fill("2026 중대부고 1학기 중간");
    await page.waitForTimeout(2500);
    const doc148 = page.locator('text=/2026 중대부고.*기출/').first();
    if (await doc148.isVisible({ timeout: 3000 }).catch(() => false)) {
      await doc148.click({ timeout: 5000 });
      await page.waitForTimeout(3500);
      await page.screenshot({ path: `${OUT_DIR}/05c_doc148_중대부고시험지.png`, fullPage: true });
    }
  });
});
