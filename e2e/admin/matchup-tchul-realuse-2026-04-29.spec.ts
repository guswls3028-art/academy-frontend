/**
 * 매치업 실사용 리뷰 v2 — Tenant 2 (tchul) 운영 환경
 * data-testid 기반 정밀 selector + 완료 doc 강제 선택.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { gotoAndSettle, waitForCondition } from "../helpers/wait";
import { selectStableDoneMatchupDocument } from "../helpers/matchup";
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
const log = (s: string) => { console.log(`[REVIEW] ${s}`); observations.push(s); };

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

test.describe.configure({ mode: "serial" });

test.describe("매치업 실사용 리뷰 v2 — tchul", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
  });

  test.afterAll(() => {
    fs.writeFileSync(path.join(SHOTS, "observations-v2.md"), observations.map(o => `- ${o}`).join("\n"));
  });

  test("L1. 인덱스 화면 + 좌측 트리 카운트", async ({ page }) => {
    await openMatchup(page);

    await page.screenshot({ path: path.join(SHOTS, "v2-01-landing.png"), fullPage: true });

    const total = await page.locator(DOC_ROW_SELECTOR).count();
    log(`총 doc rows=${total}`);

    // 카운트 칩(전체/처리중/완료/실패)
    const counts = await page.locator("text=/전체\\s*\\d+|처리중\\s*\\d+|완료\\s*\\d+|실패\\s*\\d+/").allTextContents();
    log(`status counts=${counts.join(" / ")}`);

    // 검색 input
    const search = page.locator("[data-testid='matchup-doc-search']");
    log(`search testid present=${await search.count() > 0}`);

    // 카테고리 트리 — details/folder
    const folders = await page.locator("details, [aria-expanded='true'], [aria-expanded='false']").count();
    log(`folder elements=${folders}`);

    // 시험지 / 자료 업로드 버튼 모두 노출
    const refBtn = page.locator("[data-testid='matchup-reference-upload-button']");
    const testBtn = page.locator("[data-testid='matchup-upload-button']");
    log(`자료 btn visible=${await refBtn.isVisible().catch(() => false)} / 시험지 btn visible=${await testBtn.isVisible().catch(() => false)}`);

    // 워크박스(진행중)
    const progressBars = await page.locator("[data-testid='matchup-progress-bar']").count();
    log(`진행 중 progress bar 노출=${progressBars}`);
  });

  test("L2. 카운트 필터링 — 완료/처리중/실패 상태별 클릭", async ({ page }) => {
    await openMatchup(page);

    // 상태칩 클릭 — 완료
    if (await clickStatusChip(page, /완료\s*\d+/, "done status filter applied")) {
      const doneRows = await page.locator(DOC_ROW_SELECTOR).count();
      log(`완료 chip → rows=${doneRows}`);
      await page.screenshot({ path: path.join(SHOTS, "v2-02-done-filter.png"), fullPage: true });
    }

    // 처리중
    if (await clickStatusChip(page, /처리중\s*\d+/, "processing status filter applied")) {
      const processingRows = await page.locator(DOC_ROW_SELECTOR).count();
      log(`처리중 chip → rows=${processingRows}`);
    }

    // 검색 동작
    const search = page.locator("[data-testid='matchup-doc-search']");
    if (await search.count() > 0) {
      await search.fill("개포");
      await expect(search).toHaveValue("개포");
      await waitForRowsOrEmpty(page, "search filter applied");
      const after = await page.locator(DOC_ROW_SELECTOR).count();
      log(`search='개포' → rows=${after}`);
      await search.fill("");
      await expect(search).toHaveValue("");
      await waitForRowsOrEmpty(page, "search filter reset");
    }
  });

  test("L3. 완료 doc 시험지 선택 → 디테일/탭/액션", async ({ page }) => {
    await openMatchup(page);

    // 완료 chip 클릭
    await clickStatusChip(page, /완료\s*\d+/, "done status filter before detail");

    // 시험지 doc — title contains "시험" 또는 row inner badge
    let candidates = page.locator(DOC_ROW_SELECTOR).filter({ hasText: /시험|테스트|기출|모의/ });
    if (await candidates.count() === 0) candidates = page.locator(DOC_ROW_SELECTOR);
    const target = candidates.first();
    await target.scrollIntoViewIfNeeded();
    await target.click();
    await waitForDocDetail(page);

    await page.screenshot({ path: path.join(SHOTS, "v2-03-test-doc-detail.png"), fullPage: true });

    // 액션 버튼들
    const cropBtn = page.locator("button:has-text('직접 자르기')");
    const pdfBtn = page.locator("[data-testid='matchup-doc-hit-report-btn']");
    const curateBtn = page.locator("[data-testid='matchup-doc-hit-report-curate-btn']");
    const intentBadge = page.locator("text=/^시험지$|^참고자료$/").first();
    const categoryBadge = page.locator("[data-testid='matchup-doc-category-badge']");
    log(`actions: 직접자르기=${await cropBtn.count()}, 자동PDF=${await pdfBtn.count()}, 보고서작성=${await curateBtn.count()}, intent=${(await intentBadge.textContent().catch(() => "") || "").trim()}, 카테고리=${(await categoryBadge.textContent().catch(() => "") || "").trim()}`);

    // 우측 탭
    const similarTab = page.locator("[data-testid='matchup-right-tab-similar']");
    const crossTab = page.locator("[data-testid='matchup-right-tab-cross']");
    log(`tabs: similar visible=${await similarTab.isVisible().catch(() => false)} / cross visible=${await crossTab.isVisible().catch(() => false)} / cross disabled=${await crossTab.isDisabled().catch(() => "n/a")}`);

    // problem grid — 추출된 문제 영역
    const problems = await page.locator("[data-testid^='matchup-problem-thumb'], [data-testid^='matchup-problem-card'], .problem-thumb, [class*='ProblemCell']").count();
    log(`problem cells in detail=${problems}`);
  });

  test("L4. 자료별 매치 (cross-matches) 탭 진입", async ({ page }) => {
    await openMatchup(page);

    await clickStatusChip(page, /완료\s*\d+/, "done status filter before cross matches");

    // 시험지 row 우선
    let testRow = page.locator(DOC_ROW_SELECTOR).filter({ hasText: /시험|기출|모의/ });
    if (await testRow.count() === 0) testRow = page.locator(DOC_ROW_SELECTOR);
    await testRow.first().click();
    await waitForDocDetail(page);

    // intent가 시험지가 아니면 변경 시도
    const intentBadge = page.locator("text=/^시험지$|^참고자료$/").first();
    const intentText = (await intentBadge.textContent().catch(() => "") || "").trim();
    log(`선택 doc intent=${intentText}`);

    // cross 탭 클릭
    const crossTab = page.locator("[data-testid='matchup-right-tab-cross']");
    const isDisabled = await crossTab.isDisabled().catch(() => false);
    log(`cross tab disabled=${isDisabled}`);

    if (!isDisabled) {
      await crossTab.click();
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await waitForCondition(
        async () => (await page.locator("text=/STRONG|강한|MEDIUM|부분|WEAK|약한|\\d{1,3}%|0\\.\\d{2}/i").count()) > 0,
        { timeoutMs: 10_000, description: "cross match panel populated" },
      ).catch(() => {});
      await page.screenshot({ path: path.join(SHOTS, "v2-04-cross-matches.png"), fullPage: true });

      // sim 분포
      const strong = await page.locator("text=/STRONG|강한|적중/i").count();
      const medium = await page.locator("text=/MEDIUM|부분|중간/i").count();
      const weak = await page.locator("text=/WEAK|약한|낮은/i").count();
      log(`sim 분포 STRONG=${strong}, MEDIUM=${medium}, WEAK=${weak}`);

      // sim score 텍스트 (0.85+)
      const scoreText = await page.locator("text=/\\d{1,3}%|0\\.\\d{2}/").allTextContents();
      log(`sim 텍스트 표본 (앞 5개)=${scoreText.slice(0, 5).join(", ")}`);
    } else {
      log("cross tab 비활성화 — 시험지가 아니므로 전환 시도");
    }
  });

  test("L5. 자동 적중 PDF 다운로드", async ({ page }) => {
    await openMatchup(page);

    await clickStatusChip(page, /완료\s*\d+/, "done status filter before PDF");

    let testRow = page.locator(DOC_ROW_SELECTOR).filter({ hasText: /시험|기출|모의/ });
    if (await testRow.count() === 0) testRow = page.locator(DOC_ROW_SELECTOR);
    await testRow.first().click();
    await waitForDocDetail(page);

    const pdfBtn = page.locator("[data-testid='matchup-doc-hit-report-btn']");
    if (await pdfBtn.count() === 0) { test.skip(true, "PDF 버튼 없음 (doc 미선택)"); return; }

    log(`PDF 버튼 발견 → 다운로드 시도`);
    const start = Date.now();
    try {
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 30000 }),
        pdfBtn.click(),
      ]);
      const dlPath = path.join(SHOTS, "v2-05-hit-report.pdf");
      await download.saveAs(dlPath);
      const stat = fs.statSync(dlPath);
      const head = fs.readFileSync(dlPath).slice(0, 8).toString("ascii");
      const elapsed = Date.now() - start;
      log(`PDF 다운로드 OK size=${stat.size}, header='${head}', elapsed=${elapsed}ms`);
    } catch (e) {
      log(`PDF 다운로드 실패: ${(e as Error).message.slice(0, 100)}`);
      await page.screenshot({ path: path.join(SHOTS, "v2-05-pdf-fail.png"), fullPage: true });
    }
  });

  test("L6. 직접 자르기 (수동 크롭) 모달 진입", async ({ page }) => {
    await openMatchup(page);

    const selected = await selectStableDoneMatchupDocument(page);
    log(`크롭 검증 doc=${selected.id}, title=${selected.title || ""}, problems=${selected.problem_count ?? "n/a"}`);
    await waitForDocDetail(page);

    const cropBtn = page.locator("[data-testid='matchup-doc-manual-crop-btn']").first();
    await expect(cropBtn).toBeVisible({ timeout: 10_000 });
    await cropBtn.click();

    const modal = page.locator("[data-testid='matchup-manual-crop-modal'], [role='dialog']").first();
    await expect(modal).toBeVisible({ timeout: 8000 });
    await modal.screenshot({ path: path.join(SHOTS, "v2-06-crop-modal.png") });

    // 페이지 썸네일
    const thumbs = await page.locator("[data-testid='matchup-crop-page-thumb']").count();
    log(`크롭 모달 페이지 썸네일=${thumbs}`);

    // Ctrl+V paste 안내
    const pasteHint = page.locator("text=/Ctrl\\s*\\+\\s*V|붙여넣|paste/i").first();
    log(`paste 안내 노출=${await pasteHint.count() > 0}`);

    // 캔버스
    const canvas = page.locator("[data-testid='matchup-crop-canvas']");
    log(`크롭 캔버스 visible=${await canvas.isVisible().catch(() => false)}`);

    // 기존 크롭 행
    const existingRows = await page.locator("[data-testid='matchup-crop-problem-row']").count();
    log(`기존 크롭 행=${existingRows}`);

    // 숫자 입력 가시성
    const numberInput = page.locator("[data-testid='matchup-crop-number-input']");
    log(`크롭 번호 input present=${await numberInput.count() > 0}`);

    // 닫기
    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden({ timeout: 5_000 }).catch(() => {});
  });

  test("L7. 업로드 모달 — 라디오/자동추천 pill/카테고리/intent", async ({ page }) => {
    await openMatchup(page);

    // 시험지 업로드 클릭
    const uploadBtn = page.locator("[data-testid='matchup-upload-button']");
    await expect(uploadBtn).toBeVisible({ timeout: 5000 });
    await uploadBtn.click();

    const modal = page.locator("[data-testid='matchup-upload-modal']");
    await expect(modal).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(SHOTS, "v2-07-upload-modal.png"), fullPage: true });

    // intent 토글 (시험지 / 학습자료)
    const intentToggle = await page.locator("text=/시험지|참고\\s*자료|학습\\s*자료/").allTextContents();
    log(`intent 텍스트=${intentToggle.slice(0, 5).join(", ")}`);

    // split/merge 라디오
    const splitToggle = page.locator("[data-testid='matchup-split-mode-toggle']");
    const mergeToggle = page.locator("[data-testid='matchup-merge-mode-toggle']");
    log(`split radio visible=${await splitToggle.isVisible().catch(() => false)} / merge radio visible=${await mergeToggle.isVisible().catch(() => false)}`);

    // 자동 추천 pill
    const autoPill = page.locator("text=/자동\\s*추천/").first();
    log(`자동 추천 pill 노출=${await autoPill.count() > 0}`);

    // 카테고리 chips (빈도순)
    const categoryChips = page.locator("[data-testid='matchup-upload-category-chips']");
    const categoryInput = page.locator("[data-testid='matchup-upload-category-input']");
    log(`카테고리 chips=${await categoryChips.count()}, input=${await categoryInput.count()}`);

    // 업로드 버튼 (파일 미선택 시 disabled)
    const submit = page.locator("[data-testid='matchup-upload-submit']");
    const submitDisabled = await submit.isDisabled().catch(() => null);
    log(`submit 버튼 disabled (파일 미선택)=${submitDisabled}`);

    // 모달 본문 안내
    const modalText = (await modal.textContent().catch(() => "") || "").replace(/\s+/g, " ").slice(0, 200);
    log(`modal 안내 head=${modalText}`);

    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden({ timeout: 5_000 }).catch(() => {});
  });

  test("L8. 카테고리 폴더 트리 펼침 + 행 contextual 메뉴", async ({ page }) => {
    await openMatchup(page);

    // 카테고리 메뉴 항목
    const categoryItems = page.locator("[data-testid='matchup-category-menu-item']");
    log(`category menu items=${await categoryItems.count()}`);

    // doc-row 우클릭 메뉴 (가능 여부)
    const firstRow = page.locator(DOC_ROW_SELECTOR).first();
    await firstRow.scrollIntoViewIfNeeded();
    await firstRow.click({ button: "right" });
    await waitForCondition(
      async () => (await page.locator("[role='menu'], .context-menu").count()) > 0,
      { timeoutMs: 4_000, description: "matchup row context menu visible" },
    ).catch(() => {});
    const ctxMenu = await page.locator("[role='menu'], .context-menu").count();
    log(`right-click menu=${ctxMenu}`);
    await page.keyboard.press("Escape");

    // 행 마우스 호버 시 휴지통/액션 노출
    await firstRow.hover();
    await waitForCondition(
      async () => (await page.locator("[aria-label*='삭제'], button[title*='삭제']").count()) > 0,
      { timeoutMs: 4_000, description: "matchup row hover actions visible" },
    ).catch(() => {});
    const trash = await page.locator("[aria-label*='삭제'], button[title*='삭제']").count();
    log(`hover trash btn=${trash}`);

    await page.screenshot({ path: path.join(SHOTS, "v2-08-tree.png"), fullPage: true });
  });
});
