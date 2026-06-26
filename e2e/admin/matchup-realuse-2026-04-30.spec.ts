/**
 * 매치업 실사용 리뷰 (2026-04-30) — 전체 워크플로우 검증.
 *
 * 검증 동선 (real user path):
 *  1. 좌측 트리: 카테고리 그룹 + 문서 행 + intent 뱃지 + 검색
 *  2. 시험지(test) 문서 선택 → 문제 그리드 + 유사 문제 / 자료별 매치 탭
 *  3. 액션바: 적중 보고서 작성 / 직접 자르기 / 원본 보기 / 저장소에서 보기
 *  4. 카테고리 인라인 편집
 *  5. 문서 행 컨텍스트 메뉴 (intent/rename/category)
 *  6. 업로드 모달 (split mode + 카테고리 prefill)
 *  7. 적중 보고서 작성기 진입 + 편집기 로드 검증
 *
 * 운영 데이터 read-only 위주 + 카테고리 변경 즉시 원복.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";
import { fetchMatchupDocuments, isExamLikeMatchupDocument, type MatchupE2EDocument } from "../helpers/matchup";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { gotoAndSettle, waitForCondition } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const __filename_ = fileURLToPath(import.meta.url);
const __dirname_ = path.dirname(__filename_);
const SHOTS = path.resolve(__dirname_, "../reports/matchup-realuse-2026-04-30");
fs.mkdirSync(SHOTS, { recursive: true });

interface Defect {
  severity: "P0" | "P1" | "P2";
  area: string;
  detail: string;
}
const defects: Defect[] = [];
function rec(severity: Defect["severity"], area: string, detail: string) {
  defects.push({ severity, area, detail });
  console.log(`[${severity}] ${area} — ${detail}`);
}

async function selectDoneDocumentWithProblems(
  page: import("@playwright/test").Page,
  preferExam = true,
): Promise<MatchupE2EDocument | null> {
  const docs = await fetchMatchupDocuments(page);
  const candidates = docs.filter((doc) => doc.status === "done" && (doc.problem_count ?? 0) > 0);
  const selected = (preferExam ? candidates.find(isExamLikeMatchupDocument) : undefined) ?? candidates[0] ?? null;
  if (!selected) return null;

  await gotoAndSettle(page, `${BASE}/admin/storage/matchup?docId=${selected.id}`, { timeout: 30_000 });
  const target = page.locator(`[data-testid='matchup-doc-row'][data-doc-id='${selected.id}']`).first();
  await expect(target).toBeVisible({ timeout: 15_000 });
  await target.click();
  console.log(`[REVIEW] 검증 문서 선택 id=${selected.id}, problems=${selected.problem_count ?? 0}`);
  return selected;
}

test.describe.configure({ mode: "serial" });

test.describe("매치업 실사용 리뷰 2026-04-30", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("01. 매치업 진입 + 문서 목록 + 카테고리 트리", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/storage/matchup`);

    await page.screenshot({ path: path.join(SHOTS, "01-landing.png"), fullPage: true });

    const docRows = page.locator("[data-testid='matchup-doc-row'], [data-doc-id]");
    const count = await docRows.count();
    console.log(`[REVIEW] 문서 행: ${count}`);
    if (count === 0) {
      rec("P1", "초기 진입", "운영 환경에 매치업 문서가 0건 — Tenant 1 운영 자료 검증 필요");
    }
    expect(count).toBeGreaterThan(0);

    // intent is exposed on each row and used by grouping/counters.
    const intentRows = page.locator("[data-testid='matchup-doc-row'][data-doc-intent]");
    const intentRowCount = await intentRows.count();
    console.log(`[REVIEW] intent row attrs: ${intentRowCount}/${count}`);
    if (intentRowCount === 0 && count > 0) {
      rec("P1", "intent 표시", "문서 행에 시험지/참고자료 구분 속성 누락");
    }
  });

  test("02. 시험지 doc 선택 → 액션바 + 문제 그리드 + 유사/cross 탭", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/storage/matchup`);

    const selected = await selectDoneDocumentWithProblems(page);
    if (!selected) {
      rec("P1", "문제 그리드", "운영 환경에 완료 상태이면서 문제 수가 있는 매치업 문서가 없음");
      return;
    }

    // URL ?docId 동기화
    await waitForCondition(
      async () => /docId=\d+/.test(page.url()),
      { timeoutMs: 5_000, intervalMs: 200, description: "docId URL sync" },
    ).catch(() => {});
    const url = page.url();
    if (!/docId=\d+/.test(url)) {
      rec("P1", "URL 동기화", `?docId=N 미반영: ${url}`);
    }

    // 액션바 — 적중 보고서 작성 / 직접 자르기 / 원본 보기
    const cropBtn = page.locator("[data-testid='matchup-doc-manual-crop-btn']");
    const curateBtn = page.locator("[data-testid='matchup-doc-hit-report-curate-btn']");
    await expect(cropBtn).toBeVisible();
    await expect(curateBtn).toBeVisible();
    const moreMenuTrigger = page.locator("[data-testid='matchup-doc-more-menu-trigger']");
    await expect(moreMenuTrigger).toBeVisible({ timeout: 8000 });
    await moreMenuTrigger.click();
    await expect(page.locator("[data-testid='matchup-doc-preview-btn']")).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("Escape");
    await page.screenshot({ path: path.join(SHOTS, "02-doc-action-bar.png"), fullPage: true });

    // 문제 그리드
    const problemCards = page.locator("[data-problem-id]");
    const pCount = await problemCards.count();
    console.log(`[REVIEW] 문제 카드: ${pCount}`);
    if (pCount === 0) {
      rec("P1", "문제 그리드", "선택 doc에 추출된 문제 0건 노출 (자동 분리 미완료 가능)");
    }

    // 유사 문제 탭 (기본)
    const similarTab = page.locator("[data-testid='matchup-right-tab-similar']");
    const crossTab = page.locator("[data-testid='matchup-right-tab-cross']");
    await expect(similarTab).toBeVisible();
    await expect(crossTab).toBeVisible();

    // 첫 문제 클릭 → 유사 결과 패널
    if (pCount > 0) {
      await problemCards.first().click();
      await waitForCondition(
        async () =>
          (await page.locator("[data-testid='matchup-similar-row']").count()) > 0 ||
          (await page.locator("text=유사한 문제를 찾지 못했습니다").count()) > 0,
        { timeoutMs: 8_000, intervalMs: 300, description: "similar results or empty state" },
      ).catch(() => {});
      await page.screenshot({ path: path.join(SHOTS, "03-similar-panel.png"), fullPage: true });

      // 유사 결과 노출 (실제 마크업: matchup-similar-row)
      const simRows = page.locator("[data-testid='matchup-similar-row']");
      const simCount = await simRows.count();
      console.log(`[REVIEW] 유사 결과 행: ${simCount}`);
      if (simCount === 0) {
        // empty state guard
        const emptyHint = page.locator("text=유사한 문제를 찾지 못했습니다");
        const hasEmpty = await emptyHint.count() > 0;
        if (!hasEmpty) {
          rec("P1", "유사 검색", "결과 0건인데 빈 상태 안내 미노출");
        }
      }
    }

    // cross-matches 탭 (시험지에서만)
    if (isExamLikeMatchupDocument(selected) && pCount > 0) {
      await crossTab.click();
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.screenshot({ path: path.join(SHOTS, "04-cross-matches.png"), fullPage: true });

      const crossDisabled = await crossTab.isDisabled();
      if (crossDisabled) {
        rec("P1", "cross-matches", "시험지인데 자료별 매치 탭 disabled");
      }
    }
  });

  test("03. 적중 보고서 작성기 진입 (primary CTA 검증)", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/storage/matchup`);

    const selected = await selectDoneDocumentWithProblems(page);
    if (!selected) {
      rec("P1", "적중 보고서", "운영 환경에 완료 상태이면서 문제 수가 있는 매치업 문서가 없음");
      return;
    }

    const curateBtn = page.locator("[data-testid='matchup-doc-hit-report-curate-btn']");
    await expect(curateBtn).toBeVisible({ timeout: 5000 });

    const isDisabled = await curateBtn.isDisabled();
    if (isDisabled) {
      rec("P1", "적중 보고서", "선택 doc에서 적중 보고서 작성 버튼 disabled (status≠done)");
      return;
    }

    await curateBtn.click();
    await expect(page.getByRole("dialog", { name: "적중 보고서 작성" }))
      .toBeVisible({ timeout: 30_000 });

    await page.screenshot({ path: path.join(SHOTS, "05-hit-report-editor.png") });
  });

  test("04. 카테고리 인라인 편집 (변경 후 원복)", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/storage/matchup`);

    const firstRow = page.locator("[data-testid='matchup-doc-row'], [data-doc-id]").first();
    if (await firstRow.count() === 0) return;
    await firstRow.click();

    const catBadge = page.locator("[data-testid='matchup-doc-category-badge']");
    await expect(catBadge).toBeVisible({ timeout: 5000 });
    const original = (await catBadge.textContent())?.trim() ?? "";

    await catBadge.click();
    const editArea = page.locator("[data-testid='matchup-doc-category-edit']");
    await expect(editArea).toBeVisible();
    const input = editArea.locator("input");
    const TEST_VAL = `[E2E-RV-${Date.now()}]`;
    await input.fill(TEST_VAL);
    const saveBtn = page.locator("[data-testid='matchup-doc-category-save']");
    await saveBtn.click();
    await expect(catBadge).toContainText(TEST_VAL, { timeout: 5_000 }).catch(() => {});

    // 새 값 노출 확인
    const newCat = (await catBadge.textContent())?.trim() ?? "";
    if (newCat !== TEST_VAL && !newCat.includes(TEST_VAL)) {
      rec("P1", "카테고리 편집", `편집 후 라벨 미반영: expected ${TEST_VAL}, got ${newCat}`);
    }

    // 원복
    await catBadge.click();
    const inp2 = editArea.locator("input");
    await expect(inp2).toBeVisible({ timeout: 5_000 });
    await inp2.fill(original);
    if (original === "" || original === "+ 카테고리 지정") {
      // 빈 값으로 저장 — 미분류로 이동
      await inp2.fill("");
    }
    await saveBtn.click();
    await waitForCondition(
      async () => {
        const text = (await catBadge.textContent())?.trim() ?? "";
        return original === "" ? text !== TEST_VAL : text.includes(original) || text !== TEST_VAL;
      },
      { timeoutMs: 5_000, intervalMs: 250, description: "category restore reflected" },
    ).catch(() => {});
    console.log(`[REVIEW] 카테고리 편집 원복: "${original}"`);
  });

  test("05. 직접 자르기 모달 진입 + 페이지 로드", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/storage/matchup`);

    const firstRow = page.locator("[data-testid='matchup-doc-row'][data-doc-status='done']").first();
    if (await firstRow.count() === 0) {
      rec("P1", "직접 자르기", "테스트할 done 상태 문서 없음");
      return;
    }
    await firstRow.click();

    const cropBtn = page.locator("[data-testid='matchup-doc-manual-crop-btn']");
    await cropBtn.click();

    const modal = page.locator("[role='dialog'], [data-testid='manual-crop-modal']").first();
    await expect(modal).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(SHOTS, "06-manual-crop-modal.png"), fullPage: true });

    // ESC로 닫기
    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden({ timeout: 5_000 }).catch(() => {});
  });

  test("06. 업로드 모달 진입 + 라디오/카테고리 prefill", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/storage/matchup`);

    // 우상단 / 빈 상태 / 트리 어디서든 업로드 진입
    const uploadBtn = page.locator(
      "[data-testid='matchup-upload-button'], [data-testid='matchup-empty-test-btn'], [data-testid='matchup-empty-reference-btn']",
    ).first();
    if (await uploadBtn.count() === 0) {
      rec("P1", "업로드 진입", "업로드 버튼 셀렉터 미발견 (testid 변경 가능)");
      return;
    }
    await uploadBtn.click();

    const modal = page.locator("[data-testid='matchup-upload-modal']").first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    const fileInput = modal.getByTestId("matchup-file-input");
    await expect(fileInput).toBeAttached({ timeout: 5000 });
    const pdf = path.resolve(__dirname_, "../fixtures/test-matchup.pdf");
    await fileInput.setInputFiles([pdf, pdf]);

    // 분리 라디오는 복수 파일 선택 시 실제 사용자 조건에서 노출된다.
    const splitRadio = modal.getByTestId("matchup-split-mode-toggle");
    const mergeRadio = modal.getByTestId("matchup-merge-mode-toggle");
    if (await splitRadio.count() === 0 || await mergeRadio.count() === 0) {
      rec("P1", "split 라디오", "분리 모드 라디오 UI 누락 (B2 적용 회귀 가능)");
    }

    await page.screenshot({ path: path.join(SHOTS, "07-upload-modal.png"), fullPage: true });
    await page.keyboard.press("Escape");
  });

  test("07. 결함 요약 출력", async () => {
    console.log("\n========== 매치업 실사용 리뷰 결함 요약 ==========");
    if (defects.length === 0) {
      console.log("결함 없음");
    } else {
      const p0 = defects.filter((d) => d.severity === "P0");
      const p1 = defects.filter((d) => d.severity === "P1");
      const p2 = defects.filter((d) => d.severity === "P2");
      console.log(`P0: ${p0.length}, P1: ${p1.length}, P2: ${p2.length}`);
      [...p0, ...p1, ...p2].forEach((d) => {
        console.log(`  [${d.severity}] ${d.area}: ${d.detail}`);
      });
    }
    console.log("=================================================\n");
    fs.writeFileSync(
      path.join(SHOTS, "defects.json"),
      JSON.stringify(defects, null, 2),
    );
  });
});
