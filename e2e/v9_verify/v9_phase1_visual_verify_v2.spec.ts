/**
 * V9 + Phase 1 시각검증 v2 — 좌측 사이드바 클릭 + 카테고리 필터로 모든 doc 캡처.
 *
 * v1 결함: ?doc=N URL 파라미터 미동작. 7 캡처 모두 default landing.
 *
 * v2 전략:
 *   1. 좌측 자료 검색박스에 키워드 입력 → 자료 클릭 → 매치업 추천 결과 캡처
 *   2. 시험지 클릭 → 추천 결과는 그 시험지의 source view
 *   3. 참고자료 클릭 → 그 자료의 problem grid + 추천
 *
 * 매치업 페이지 구조:
 *   - 좌측: 자료 리스트 (시험지 / 참고자료 탭) + 카테고리 필터 (전체/시험지/자료)
 *   - 가운데: 선택 doc 의 problem grid
 *   - 우측: 선택 problem 의 추천 결과 (V9 + Phase 1 image weight 효과)
 *
 * 검증 sample (T2 박철 과학):
 *   각 양식별 1-2 doc 클릭 → full screenshot.
 */
import { test } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import { mkdirSync } from "fs";

const OUT_DIR = "C:/academy/_artifacts/sessions/matchup-rebuild-2026-05-05/v9_phase1_visual_verify_v2";
mkdirSync(OUT_DIR, { recursive: true });

const TCHUL = process.env.TCHUL_BASE_URL || "https://tchul.com";

// 검증 자료 — 좌측 검색박스에 입력할 키워드 + sample 양식
const SAMPLES = [
  { search: "26-1 m 은광", label: "01_commercial_은광여고_신과함께", desc: "신과함께 commercial 은광여고 (manual 300)" },
  { search: "메인자료 은광", label: "02_academy_메인자료_은광여고", desc: "메인자료 academy 은광여고" },
  { search: "은광여고 1학기 중간", label: "03_student_은광여고_1학기중간", desc: "학생 시험사진 은광여고 (manual 32)" },
  { search: "별의 진화", label: "04_academy_별의진화", desc: "메인자료 별의진화 (V9 학습 양식)" },
  { search: "2026 개포고 1학기", label: "05_student_개포고_시험지", desc: "개포고 시험지 (mirror, T1 학원장 cut)" },
  { search: "통합과학1 출제원안", label: "06_other_출제원안", desc: "출제원안 양식 (V9 신규 양식)" },
];

test.describe("V9 + Phase 1 시각검증 v2 — T2 매치업 (좌측 클릭)", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${TCHUL}/admin/storage/matchup`, { waitUntil: "load", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2000);
  });

  test("00 매치업 페이지 진입", async ({ page }) => {
    await page.screenshot({ path: `${OUT_DIR}/00_matchup_landing.png`, fullPage: true });

    // "전체 자료" 또는 "자료" 탭 클릭 (참고자료 모두 보기)
    const allTab = page.getByText(/^전체 자료/, { exact: false }).first();
    if (await allTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await allTab.click({ timeout: 5000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT_DIR}/01_all_documents_tab.png`, fullPage: true });
    }
  });

  for (const s of SAMPLES) {
    test(`${s.label} — ${s.desc}`, async ({ page }) => {
      // 검색박스 → 키워드
      const searchBox = page.locator('input[placeholder*="검색"], input[placeholder*="제목"]').first();
      await searchBox.waitFor({ state: "visible", timeout: 10_000 });
      await searchBox.click();
      await searchBox.fill(s.search);
      await page.waitForTimeout(2000); // debounce + filter

      await page.screenshot({ path: `${OUT_DIR}/${s.label}_a_search.png`, fullPage: true });

      // 검색 결과 첫 자료 클릭 (data-testid 또는 자료 제목)
      const firstDoc = page
        .locator(
          'button[class*="DocumentItem"], div[class*="DocumentItem"], li[class*="DocumentItem"], [data-testid="document-item"]',
        )
        .first();

      if (!(await firstDoc.isVisible({ timeout: 3000 }).catch(() => false))) {
        // fallback: text 매칭으로 자료 찾기
        const byText = page.locator(`text=${s.search}`).first();
        if (await byText.isVisible({ timeout: 2000 }).catch(() => false)) {
          await byText.click({ timeout: 5000 });
        } else {
          // 더 일반적인 selector — 좌측 리스트 안의 클릭 가능한 행
          const generic = page.locator('aside button, aside [role="button"], aside li').first();
          if (await generic.isVisible({ timeout: 2000 }).catch(() => false)) {
            await generic.click({ timeout: 5000 });
          }
        }
      } else {
        await firstDoc.click({ timeout: 5000 });
      }

      await page.waitForTimeout(4000); // 추천 결과 fetch 대기

      // 전체 페이지 캡처
      await page.screenshot({ path: `${OUT_DIR}/${s.label}_b_doc_selected.png`, fullPage: true });

      // 첫 problem 클릭 → 우측 추천 결과 변화
      const problem = page.locator('button[class*="ProblemCard"], div[class*="ProblemCard"], img[alt*="문제"]').first();
      if (await problem.isVisible({ timeout: 3000 }).catch(() => false)) {
        await problem.click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(3500);
        await page.screenshot({ path: `${OUT_DIR}/${s.label}_c_problem_click.png`, fullPage: true });
      }
    });
  }
});
