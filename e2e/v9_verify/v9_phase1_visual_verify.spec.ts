/**
 * V9 + Phase 1 시각검증 — T2 (박철 과학) 매치업 결과 누락 없이 캡처.
 *
 * 검증 대상:
 *   - V9 모델 (mAP50 0.9646) 운영 적용
 *   - Phase 1 image weight 상향 (짧은 0.5→0.7 / 중간 0.3→0.5 / 긴 0.15→0.3)
 *   - Phase 1 manual_crop image_embedding=None reset
 *
 * 캡처 양식 sample (T2):
 *   1. 매치업 페이지 진입 — 자료 리스트 전체
 *   2. 신과함께 (commercial 26-1m) — doc 284 은광여고 내지
 *   3. 메인자료 (academy 꾸불한선) — doc 290 은광여고 메인자료
 *   4. 학생시험사진 — doc 294 은광여고 1학기 중간고사
 *   5. 매치업 자료 (메인자료 V9 미포함, 자동분리 결과) — doc 178 별의진화 메인자료 숙명여고
 *
 * 출력: _artifacts/sessions/matchup-rebuild-2026-05-05/v9_phase1_visual_verify/
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import { resolve } from "path";
import { mkdirSync } from "fs";

const OUT_DIR = "C:/academy/_artifacts/sessions/matchup-rebuild-2026-05-05/v9_phase1_visual_verify";

mkdirSync(OUT_DIR, { recursive: true });

const TCHUL = process.env.TCHUL_BASE_URL || "https://tchul.com";

// 검증 대상 doc 리스트 (양식별 sample)
const DOCS = [
  { id: 284, label: "01_commercial_26-1m_은광여고", desc: "신과함께 (commercial)" },
  { id: 290, label: "02_academy_메인자료_은광여고", desc: "메인자료(꾸불한선)" },
  { id: 294, label: "03_student_은광여고_1학기중간", desc: "학생시험사진" },
  { id: 178, label: "04_v9_미포함_별의진화_숙명여고", desc: "메인자료 V9 미포함 (자동분리 결과)" },
  { id: 305, label: "05_commercial_단대부고_내지", desc: "신과함께 단대부고" },
  { id: 293, label: "06_academy_물체의운동_은광여고", desc: "메인자료 물체의운동" },
];

test.describe("V9 + Phase 1 시각검증 — T2 매치업", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
    await page.goto(`${TCHUL}/admin/storage/matchup`, { waitUntil: "load", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test("00 매치업 페이지 진입 — 전체 자료 리스트", async ({ page }) => {
    await page.waitForTimeout(2000); // SPA 데이터 로딩 안정
    await page.screenshot({
      path: resolve(OUT_DIR, "00_matchup_landing.png"),
      fullPage: true,
    });
  });

  for (const doc of DOCS) {
    test(`${doc.label} — ${doc.desc}`, async ({ page }) => {
      // doc 직접 URL 이동 (자료 클릭 대신)
      await page.goto(`${TCHUL}/admin/storage/matchup?doc=${doc.id}`, {
        waitUntil: "load",
        timeout: 30_000,
      });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(3000); // 추천 결과 fetch 대기

      // 전체 페이지 캡처
      await page.screenshot({
        path: resolve(OUT_DIR, `${doc.label}_full.png`),
        fullPage: true,
      });

      // 우측 SimilarResults 영역 별도 캡처 (있으면)
      const similar = page.locator('[data-testid="similar-results"], [class*="SimilarResults"], aside').first();
      if (await similar.isVisible({ timeout: 2000 }).catch(() => false)) {
        await similar.screenshot({ path: resolve(OUT_DIR, `${doc.label}_recommendations.png`) });
      }

      // 첫 problem 클릭 → 매치업 추천 결과 변화 캡처
      const firstProblem = page.locator('[data-testid="problem-card"], [class*="ProblemCard"]').first();
      if (await firstProblem.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstProblem.click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(3000);
        await page.screenshot({
          path: resolve(OUT_DIR, `${doc.label}_problem1_clicked.png`),
          fullPage: true,
        });
      }
    });
  }
});
