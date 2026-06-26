/**
 * 매치업 v3 — Tenant 2 (tchul) 운영
 *
 * v2 결과: 19개 시험지 doc은 1건뿐. 실제 시험지 doc 정확히 타겟 + cross-match + PDF 검증.
 * 업로드 모달의 split/merge 라디오는 파일 2개 이상 드롭 후 노출이 의도된 동작 — 별도 시뮬레이션.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { gotoAndSettle, waitForCondition } from "../helpers/wait";
import { fetchMatchupDocuments, isExamLikeMatchupDocument } from "../helpers/matchup";
import type { Locator, Page } from "@playwright/test";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = getBaseUrl("tchul-admin");
const MATCHUP_URL = `${BASE}/admin/storage/matchup`;
const DOC_ROW_SELECTOR = "[data-testid='matchup-doc-row']";
const __filename_ = fileURLToPath(import.meta.url);
const __dirname_ = path.dirname(__filename_);
const SHOTS = path.resolve(__dirname_, "../reports/matchup-tchul-2026-04-29");
fs.mkdirSync(SHOTS, { recursive: true });

const observations: string[] = [];
const log = (s: string) => { console.log(`[REVIEW3] ${s}`); observations.push(s); };

test.describe.configure({ mode: "serial" });

async function waitForStableCount(locator: Locator, description: string): Promise<void> {
  let last = -1;
  let stableTicks = 0;
  await waitForCondition(
    async () => {
      const next = await locator.count();
      if (next === last) {
        stableTicks += 1;
      } else {
        last = next;
        stableTicks = 0;
      }
      return stableTicks >= 2;
    },
    { timeoutMs: 6_000, intervalMs: 300, description },
  ).catch(() => {});
}

async function waitForRowsOrEmpty(page: Page, description: string): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await waitForCondition(
    async () =>
      (await page.locator(DOC_ROW_SELECTOR).count()) > 0 ||
      (await page.locator("text=/문서가 없습니다|결과가 없습니다|없습니다/").count()) > 0,
    { timeoutMs: 8_000, description },
  ).catch(() => {});
  await waitForStableCount(page.locator(DOC_ROW_SELECTOR), `${description}: stable row count`);
}

async function openMatchup(page: Page): Promise<void> {
  await gotoAndSettle(page, MATCHUP_URL, { timeout: 30_000 });
  await waitForRowsOrEmpty(page, "matchup page settled");
}

async function clickStatusChip(page: Page, label: RegExp, description: string): Promise<boolean> {
  const chip = page.locator("button, label").filter({ hasText: label }).first();
  if (await chip.count() === 0) return false;
  await chip.click();
  await waitForRowsOrEmpty(page, description);
  return true;
}

async function waitForDocDetail(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await waitForCondition(
    async () =>
      (await page.locator("[data-testid='document-guidance-banner']").count()) > 0 ||
      (await page.locator("[data-testid='matchup-problem-grid']").count()) > 0 ||
      (await page.locator("[data-testid='matchup-right-panel']").count()) > 0 ||
      (await page.locator("[data-testid^='matchup-problem-thumb'], [data-testid^='matchup-problem-card']").count()) > 0,
    { timeoutMs: 10_000, description: "matchup document detail settled" },
  ).catch(() => {});
}

async function waitForCrossPanel(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await waitForCondition(
    async () => (await page.locator("text=/적중|STRONG|강한|부분|MEDIUM|중간|유사 자료 없음|매치 안됨|0건/i").count()) > 0,
    { timeoutMs: 10_000, description: "cross match panel settled" },
  ).catch(() => {});
}

async function selectTestDoc(page: Page): Promise<void> {
  await openMatchup(page);

  const docs = await fetchMatchupDocuments(page);
  const doneWithProblems = docs.filter((doc) => doc.status === "done" && (doc.problem_count ?? 0) > 0);
  const selected = doneWithProblems.find(isExamLikeMatchupDocument) ?? doneWithProblems[0];
  expect(selected, "tchul 매치업 검증용 done 문서").toBeTruthy();

  await gotoAndSettle(page, `${MATCHUP_URL}?docId=${selected!.id}`, { timeout: 30_000 });
  await waitForRowsOrEmpty(page, "selected doc route settled");
  const target = page.locator(`${DOC_ROW_SELECTOR}[data-doc-id='${selected!.id}']`).first();
  await expect(target).toBeVisible({ timeout: 15_000 });
  await target.click();
  log(`선택 문서 id=${selected!.id}, title=${selected!.title ?? ""}`);
  await waitForDocDetail(page);
}

test.describe("매치업 v3 — tchul 시험지 doc 직접 타겟", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
  });

  test.afterAll(() => {
    fs.writeFileSync(path.join(SHOTS, "observations-v3.md"), observations.map(o => `- ${o}`).join("\n"));
  });

  test("T1. 시험지 doc 디테일 + 자료별 매치 탭 활성화", async ({ page }) => {
    await selectTestDoc(page);

    await page.screenshot({ path: path.join(SHOTS, "v3-01-test-doc-detail.png"), fullPage: true });

    // intent badge — 우상단 시험지/참고자료 표시
    const intentBadges = await page.locator("text=/^시험지$/").allTextContents();
    log(`'시험지' 텍스트 매치 수=${intentBadges.length}`);

    // 적중 보고서 작성 버튼 — 시험지일 때만 노출
    const curateBtn = page.locator("[data-testid='matchup-doc-hit-report-curate-btn']");
    const curateVisible = await curateBtn.isVisible().catch(() => false);
    log(`적중 보고서 작성 visible=${curateVisible}`);

    // cross 탭 disabled?
    const crossTab = page.locator("[data-testid='matchup-right-tab-cross']");
    const crossDisabled = await crossTab.isDisabled().catch(() => true);
    log(`자료별 매치 탭 disabled=${crossDisabled}`);

    if (!crossDisabled) {
      await crossTab.click();
      await waitForCrossPanel(page);
      await page.screenshot({ path: path.join(SHOTS, "v3-01-cross-matches.png"), fullPage: true });

      // sim 분포
      const allText = (await page.locator("body").innerText()).slice(0, 2000);
      const strongMatches = (allText.match(/적중|STRONG|강한/g) || []).length;
      const partialMatches = (allText.match(/부분|MEDIUM|중간/g) || []).length;
      const noneMatches = (allText.match(/유사 자료 없음|매치 안됨|0건/g) || []).length;
      log(`매치 텍스트 분포: 적중=${strongMatches}, 부분=${partialMatches}, 없음=${noneMatches}`);

      // 자료 카드/blok 수
      const matchCards = await page.locator("[class*='match-card'], [data-testid^='match-cell'], [data-testid^='cross-match']").count();
      log(`매치 카드 노출=${matchCards}`);
    }
  });

  test("T2. 적중 보고서 작성 CTA — 시험지 doc 기준", async ({ page }) => {
    await selectTestDoc(page);

    const curateBtn = page.locator("[data-testid='matchup-doc-hit-report-curate-btn']");
    await expect(curateBtn).toBeVisible({ timeout: 5000 });
    await expect(curateBtn).toBeEnabled({ timeout: 5000 });
    log("적중 보고서 작성 CTA 노출/활성 확인");
    await page.screenshot({ path: path.join(SHOTS, "v3-02-hit-report-cta.png"), fullPage: true });
  });

  test("T3. 적중 보고서 작성기 진입 + 편집 영역", async ({ page }) => {
    await selectTestDoc(page);

    const curateBtn = page.locator("[data-testid='matchup-doc-hit-report-curate-btn']");
    if (!(await curateBtn.isVisible().catch(() => false))) {
      test.skip(true, "적중 보고서 작성 버튼 미노출");
      return;
    }

    await curateBtn.click();
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await waitForCondition(
      async () =>
        (await page.locator("[role='dialog'], [class*='HitReportEditor']").count()) > 0 ||
        (await page.locator("textarea, input[type='text']").count()) > 0,
      { timeoutMs: 10_000, description: "hit report editor settled" },
    ).catch(() => {});
    await page.screenshot({ path: path.join(SHOTS, "v3-03-hit-report-editor.png"), fullPage: true });

    // 편집 모달/페이지 구조
    const editor = page.locator("[role='dialog'], [class*='HitReportEditor']").first();
    log(`보고서 편집기 visible=${await editor.isVisible().catch(() => false)}`);

    // 편집 가능 영역
    const inputs = await page.locator("textarea, input[type='text']").count();
    log(`편집 input/textarea 수=${inputs}`);

    // 닫기
    await page.keyboard.press("Escape");
    await expect(editor).toBeHidden({ timeout: 5_000 }).catch(() => {});
  });

  test("T4. 참고자료 doc — 자료별 매치 탭 비활성화 안내", async ({ page }) => {
    await openMatchup(page);

    // 완료 chip 클릭
    await clickStatusChip(page, /완료\s*\d+/, "done status filter before reference doc");

    // 첫 doc (참고자료가 대부분)
    const target = page.locator(DOC_ROW_SELECTOR).first();
    await target.click();
    await waitForDocDetail(page);

    const crossTab = page.locator("[data-testid='matchup-right-tab-cross']");
    const title = await crossTab.getAttribute("title");
    const disabled = await crossTab.isDisabled().catch(() => true);
    log(`참고자료 cross tab disabled=${disabled}, title="${title}"`);

    // 마우스 hover 시 tooltip 노출 (UX 친화)
    await crossTab.hover();
    await waitForCondition(
      async () => (await page.locator("[role='tooltip']").count()) > 0,
      { timeoutMs: 3_000, description: "cross tab tooltip visible" },
    ).catch(() => {});
    await page.screenshot({ path: path.join(SHOTS, "v3-04-reference-cross-disabled.png"), fullPage: true });
  });

  test("T5. 진행 중 doc(7건) — 진행률 표시", async ({ page }) => {
    await openMatchup(page);

    const processingChip = page.locator("button, label").filter({ hasText: /처리중\s*\d+/ }).first();
    if (await processingChip.count() === 0) { test.skip(true, "처리중 doc 없음"); return; }
    await processingChip.click();
    await waitForRowsOrEmpty(page, "processing status filter applied");

    const rows = await page.locator(DOC_ROW_SELECTOR).count();
    const progressBars = await page.locator("[data-testid='matchup-progress-bar']").count();
    log(`처리중 doc=${rows}, progress bar=${progressBars}`);

    if (rows > 0) {
      const target = page.locator(DOC_ROW_SELECTOR).first();
      await target.click();
      await waitForDocDetail(page);

      await page.screenshot({ path: path.join(SHOTS, "v3-05-processing-detail.png"), fullPage: true });

      // 진행률 라벨 / 단계 라벨
      const labels = await page.locator("text=/이미지 저장|텍스트 추출|페이지 분석|분리|임베딩|문제 분리|진행/").allTextContents();
      log(`진행 단계 라벨 표본=${labels.slice(0, 5).map(s => s.trim()).join(" / ")}`);

      // 워크박스 (우상단 트레이) 노출 여부
      const workboxText = await page.locator("text=/작업박스|진행 중|85%|\\d{1,3}%/").allTextContents();
      log(`작업박스/% 표본=${workboxText.slice(0, 8).map(s => s.trim()).join(" / ")}`);
    }
  });

  test("T6. 카테고리 칩 클릭 + 카테고리 변경 인라인 편집", async ({ page }) => {
    await selectTestDoc(page);

    const catBadge = page.locator("[data-testid='matchup-doc-category-badge']");
    const catText = (await catBadge.textContent().catch(() => "") || "").trim();
    log(`카테고리 badge=${catText}`);

    // 클릭하면 인라인 편집 노출
    await catBadge.click();
    const editBox = page.locator("[data-testid='matchup-doc-category-edit']");
    await expect(editBox).toBeVisible({ timeout: 5_000 });
    log(`인라인 편집 영역 visible=${await editBox.isVisible().catch(() => false)}`);

    // datalist suggestion
    const inlineInput = editBox.locator("input").first();
    await inlineInput.click();
    await expect(inlineInput).toBeFocused({ timeout: 3_000 }).catch(() => {});
    await page.screenshot({ path: path.join(SHOTS, "v3-06-category-edit.png"), fullPage: true });

    // Esc로 취소
    await page.keyboard.press("Escape");
  });

  test("T7. 추출된 문제 그리드 - 표지 cut 시각 검사", async ({ page }) => {
    await selectTestDoc(page);

    // problem grid의 첫 4개 문제 확인 (표지/lorem ipsum/페이지 폴백 결과)
    const probCards = page.locator("[class*='ProblemCard'], [data-testid^='matchup-problem-thumb']");
    const count = await probCards.count();
    log(`시험지 문제 카드 수=${count}`);

    if (count > 0) {
      // q1 첫 카드 확대
      await probCards.first().scrollIntoViewIfNeeded();
      const q1Box = await probCards.first().boundingBox();
      log(`Q1 박스 size=${q1Box ? `${q1Box.width}x${q1Box.height}` : "n/a"}`);

      await page.screenshot({ path: path.join(SHOTS, "v3-07-q1-zoomed.png"), fullPage: true });

      // 클릭 → SimilarResults 표시
      await probCards.first().click();
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await waitForCondition(
        async () =>
          (await page.locator("[class*='SimilarCard'], [data-testid^='similar-problem']").count()) > 0 ||
          (await page.locator("text=/유사 문제가 없|결과 없|매치 안됨/").count()) > 0,
        { timeoutMs: 10_000, description: "similar problem results settled" },
      ).catch(() => {});
      await page.screenshot({ path: path.join(SHOTS, "v3-07-q1-similar.png"), fullPage: true });

      const simCards = await page.locator("[class*='SimilarCard'], [data-testid^='similar-problem']").count();
      const simEmpty = await page.locator("text=/유사 문제가 없|결과 없|매치 안됨/").count();
      log(`Q1 유사 문제 카드=${simCards}, empty=${simEmpty}`);
    }
  });
});
