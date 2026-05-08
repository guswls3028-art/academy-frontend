/**
 * V9 + Phase 1 시각검증 v3 — 정확한 testid 사용. 학원장 워크플로우 끝까지.
 *
 * v2 결함: problem click selector 매칭 실패 → 우측 추천 결과 미캡처.
 * v3 fix: data-testid="matchup-problem-card" / "matchup-similar-row" 사용.
 *
 * 검증 흐름:
 *   1. 시험지 (source) → problem 클릭 → 우측 추천 자료 캡처
 *   2. 양식별 자료 (commercial / academy / student) → problem grid + 추천
 *   3. 적중 보고서 모음 화면
 *
 * 출력: _artifacts/sessions/matchup-rebuild-2026-05-05/v9_phase1_visual_verify_v3/
 */
import { test } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import { mkdirSync } from "fs";

const OUT_DIR = "C:/academy/_artifacts/sessions/matchup-rebuild-2026-05-05/v9_phase1_visual_verify_v3";
mkdirSync(OUT_DIR, { recursive: true });

const TCHUL = process.env.TCHUL_BASE_URL || "https://tchul.com";

// 검증 자료 — 양식별 sample
const SAMPLES = [
  { search: "2026 개포고 1학기 중간", label: "01_test_개포고_시험지", desc: "시험지 (source) — V9 + Phase 1 추천 결과 핵심" },
  { search: "26-1 m 개포고", label: "02_commercial_개포고_신과함께", desc: "신과함께 commercial (manual mirror)" },
  { search: "메인자료 은광", label: "03_academy_메인자료_은광여고", desc: "메인자료 academy 양식" },
  { search: "은광여고 1학기 중간", label: "04_student_은광여고_시험지", desc: "학생 시험사진" },
  { search: "별의 진화", label: "05_academy_별의진화", desc: "메인자료 별의진화 (V9 학습 양식 다양성)" },
];

test.describe("V9 + Phase 1 시각검증 v3 — testid 정확", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${TCHUL}/admin/storage/matchup`, { waitUntil: "load", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2500);
  });

  test("00 매치업 페이지 + 학원장 적중 보고서 모음 진입", async ({ page }) => {
    await page.screenshot({ path: `${OUT_DIR}/00_landing.png`, fullPage: true });
    // 학원장 적중 보고서 모음 버튼 클릭
    const reportListBtn = page.getByText(/학원 적중 보고서 모음/, { exact: false }).first();
    if (await reportListBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await reportListBtn.click({ timeout: 5000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${OUT_DIR}/01_hit_report_list.png`, fullPage: true });
    }
  });

  for (const s of SAMPLES) {
    test(`${s.label} — ${s.desc}`, async ({ page }) => {
      // 검색박스에 키워드
      const searchBox = page.locator('input[placeholder*="검색"], input[placeholder*="제목"]').first();
      await searchBox.waitFor({ state: "visible", timeout: 10_000 });
      await searchBox.click();
      await searchBox.fill(s.search);
      await page.waitForTimeout(1800);

      // 검색 결과 첫 자료 클릭 (text 기반)
      const firstDoc = page.locator(`text=${s.search.split(' ')[0]}`).filter({ hasText: s.search.split(' ')[1] || "" }).first();
      if (await firstDoc.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstDoc.click({ timeout: 5000 });
      } else {
        // fallback: aside/sidebar 안의 첫 클릭 가능 행
        const generic = page.locator('aside button, aside [role="button"], aside li').first();
        if (await generic.isVisible({ timeout: 2000 }).catch(() => false)) {
          await generic.click({ timeout: 5000 });
        }
      }

      // 자료 fetch + problem grid render 대기
      await page.waitForTimeout(3500);
      await page.screenshot({ path: `${OUT_DIR}/${s.label}_a_grid.png`, fullPage: true });

      // 첫 problem card 클릭 (data-testid 정확 selector)
      const firstProblem = page.locator('[data-testid="matchup-problem-card"]').first();
      if (await firstProblem.isVisible({ timeout: 5000 }).catch(() => false)) {
        await firstProblem.click({ timeout: 5000 });
        // 추천 결과 fetch (V9 + Phase 1 image weight 0.7/0.5/0.3)
        await page.waitForTimeout(4500);
        await page.screenshot({ path: `${OUT_DIR}/${s.label}_b_problem1_recommendations.png`, fullPage: true });

        // 추천 결과 첫 row hover (자세히 보기)
        const firstRow = page.locator('[data-testid="matchup-similar-row"]').first();
        if (await firstRow.isVisible({ timeout: 2000 }).catch(() => false)) {
          await firstRow.hover().catch(() => {});
          await page.waitForTimeout(800);
          await page.screenshot({ path: `${OUT_DIR}/${s.label}_c_recommendation_hover.png`, fullPage: true });
        }
      }

      // 두 번째 problem 클릭 (다양성)
      const secondProblem = page.locator('[data-testid="matchup-problem-card"]').nth(1);
      if (await secondProblem.isVisible({ timeout: 2000 }).catch(() => false)) {
        await secondProblem.click({ timeout: 5000 });
        await page.waitForTimeout(4000);
        await page.screenshot({ path: `${OUT_DIR}/${s.label}_d_problem2_recommendations.png`, fullPage: true });
      }
    });
  }
});
