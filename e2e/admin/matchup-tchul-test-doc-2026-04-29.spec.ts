/**
 * 매치업 v3 — Tenant 2 (tchul) 운영
 *
 * v2 결과: 19개 시험지 doc은 1건뿐. 실제 시험지 doc 정확히 타겟 + cross-match + PDF 검증.
 * 업로드 모달의 split/merge 라디오는 파일 2개 이상 드롭 후 노출이 의도된 동작 — 별도 시뮬레이션.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = getBaseUrl("tchul-admin");
const __filename_ = fileURLToPath(import.meta.url);
const __dirname_ = path.dirname(__filename_);
const SHOTS = path.resolve(__dirname_, "../reports/matchup-tchul-2026-04-29");
fs.mkdirSync(SHOTS, { recursive: true });

const observations: string[] = [];
const log = (s: string) => { console.log(`[REVIEW3] ${s}`); observations.push(s); };

test.describe.configure({ mode: "serial" });

async function selectTestDoc(page: import("@playwright/test").Page) {
  await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // 좌측 트리에서 "시험지" 그룹 헤더 찾고 그 아래 행 클릭
  // intent badge가 노란색(test) — DOM에서 row내 intent 아이콘 검색
  // 또는 'KakaoTalk' 같이 알려진 시험지 제목 직접 검색
  const search = page.locator("[data-testid='matchup-doc-search']");
  await search.fill("KakaoTalk");
  await page.waitForTimeout(800);
  const rows = await page.locator("[data-testid='matchup-doc-row']").count();
  log(`검색 KakaoTalk → ${rows} rows`);
  const target = page.locator("[data-testid='matchup-doc-row']").first();
  await target.click();
  await page.waitForTimeout(2000);
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
      await page.waitForTimeout(3000);
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

  test("T2. 자동 적중 PDF 다운로드 — 시험지 doc 기준", async ({ page }) => {
    await selectTestDoc(page);

    const pdfBtn = page.locator("[data-testid='matchup-doc-hit-report-btn']");
    await expect(pdfBtn).toBeVisible({ timeout: 5000 });

    log(`PDF 버튼 발견 → 다운로드 시도 (60s timeout)`);
    const start = Date.now();
    try {
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 60_000 }),
        pdfBtn.click(),
      ]);
      const dlPath = path.join(SHOTS, "v3-02-hit-report.pdf");
      await download.saveAs(dlPath);
      const stat = fs.statSync(dlPath);
      const head = fs.readFileSync(dlPath).slice(0, 8).toString("ascii");
      const elapsed = Date.now() - start;
      log(`PDF 다운로드 OK size=${(stat.size / 1024).toFixed(0)}KB, header='${head}', elapsed=${elapsed}ms`);
    } catch (e) {
      log(`PDF 다운로드 실패: ${(e as Error).message.slice(0, 120)}`);
      await page.screenshot({ path: path.join(SHOTS, "v3-02-pdf-fail.png"), fullPage: true });
    }
  });

  test("T3. 적중 보고서 작성기 진입 + 편집 영역", async ({ page }) => {
    await selectTestDoc(page);

    const curateBtn = page.locator("[data-testid='matchup-doc-hit-report-curate-btn']");
    if (!(await curateBtn.isVisible().catch(() => false))) {
      test.skip(true, "적중 보고서 작성 버튼 미노출");
      return;
    }

    await curateBtn.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SHOTS, "v3-03-hit-report-editor.png"), fullPage: true });

    // 편집 모달/페이지 구조
    const editor = page.locator("[role='dialog'], [class*='HitReportEditor']").first();
    log(`보고서 편집기 visible=${await editor.isVisible().catch(() => false)}`);

    // 편집 가능 영역
    const inputs = await page.locator("textarea, input[type='text']").count();
    log(`편집 input/textarea 수=${inputs}`);

    // 닫기
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  });

  test("T4. 참고자료 doc — 자료별 매치 탭 비활성화 안내", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    // 완료 chip 클릭
    const doneChip = page.locator("button, label").filter({ hasText: /완료\s*\d+/ }).first();
    if (await doneChip.count() > 0) { await doneChip.click(); await page.waitForTimeout(800); }

    // 첫 doc (참고자료가 대부분)
    const target = page.locator("[data-testid='matchup-doc-row']").first();
    await target.click();
    await page.waitForTimeout(1500);

    const crossTab = page.locator("[data-testid='matchup-right-tab-cross']");
    const title = await crossTab.getAttribute("title");
    const disabled = await crossTab.isDisabled().catch(() => true);
    log(`참고자료 cross tab disabled=${disabled}, title="${title}"`);

    // 마우스 hover 시 tooltip 노출 (UX 친화)
    await crossTab.hover();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, "v3-04-reference-cross-disabled.png"), fullPage: true });
  });

  test("T5. 진행 중 doc(7건) — 진행률 표시", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    const processingChip = page.locator("button, label").filter({ hasText: /처리중\s*\d+/ }).first();
    if (await processingChip.count() === 0) { test.skip(true, "처리중 doc 없음"); return; }
    await processingChip.click();
    await page.waitForTimeout(800);

    const rows = await page.locator("[data-testid='matchup-doc-row']").count();
    const progressBars = await page.locator("[data-testid='matchup-progress-bar']").count();
    log(`처리중 doc=${rows}, progress bar=${progressBars}`);

    if (rows > 0) {
      const target = page.locator("[data-testid='matchup-doc-row']").first();
      await target.click();
      await page.waitForTimeout(1500);

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
    await page.waitForTimeout(600);
    const editBox = page.locator("[data-testid='matchup-doc-category-edit']");
    log(`인라인 편집 영역 visible=${await editBox.isVisible().catch(() => false)}`);

    // datalist suggestion
    const inlineInput = editBox.locator("input").first();
    await inlineInput.click();
    await page.waitForTimeout(300);
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
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(SHOTS, "v3-07-q1-similar.png"), fullPage: true });

      const simCards = await page.locator("[class*='SimilarCard'], [data-testid^='similar-problem']").count();
      const simEmpty = await page.locator("text=/유사 문제가 없|결과 없|매치 안됨/").count();
      log(`Q1 유사 문제 카드=${simCards}, empty=${simEmpty}`);
    }
  });
});
