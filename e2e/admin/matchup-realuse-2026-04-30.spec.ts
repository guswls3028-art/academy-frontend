/**
 * 매치업 실사용 리뷰 (2026-04-30) — 전체 워크플로우 검증.
 *
 * 검증 동선 (real user path):
 *  1. 좌측 트리: 카테고리 그룹 + 문서 행 + intent 뱃지 + 검색
 *  2. 시험지(test) 문서 선택 → 문제 그리드 + 유사 문제 / 자료별 매치 탭
 *  3. 액션바: 원본 보기 / 저장소에서 보기 / 직접 자르기 / 자동 적중 PDF / 적중 보고서 작성
 *  4. 카테고리 인라인 편집
 *  5. 문서 행 컨텍스트 메뉴 (intent/rename/category)
 *  6. 업로드 모달 (split mode + 카테고리 prefill)
 *  7. 자동 적중 PDF 실제 다운로드 + 파일 헤더 검증 (vertical stack 적용 후)
 *
 * 운영 데이터 read-only 위주 + 카테고리 변경 즉시 원복.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

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

test.describe.configure({ mode: "serial" });

test.describe("매치업 실사용 리뷰 2026-04-30", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("01. 매치업 진입 + 문서 목록 + 카테고리 트리", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    await page.screenshot({ path: path.join(SHOTS, "01-landing.png"), fullPage: true });

    const docRows = page.locator("[data-testid='matchup-doc-row'], [data-doc-id]");
    const count = await docRows.count();
    console.log(`[REVIEW] 문서 행: ${count}`);
    if (count === 0) {
      rec("P1", "초기 진입", "운영 환경에 매치업 문서가 0건 — Tenant 1 운영 자료 검증 필요");
    }
    expect(count).toBeGreaterThan(0);

    // intent 뱃지 (시험지/참고자료) 분리 표시
    const intentBadges = page.locator("[data-testid='matchup-doc-intent-badge'], [data-testid='matchup-intent-badge']");
    const badgeCount = await intentBadges.count();
    console.log(`[REVIEW] intent 뱃지: ${badgeCount}/${count}`);
    if (badgeCount === 0 && count > 0) {
      rec("P1", "intent 뱃지", "문서 행에 시험지/참고자료 구분 표시 누락");
    }
  });

  test("02. 시험지 doc 선택 → 액션바 + 문제 그리드 + 유사/cross 탭", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });

    // intent=test 문서를 우선 선택. 없으면 첫 문서.
    const testRow = page.locator("[data-testid='matchup-doc-row'][data-doc-intent='test']").first();
    const fallback = page.locator("[data-testid='matchup-doc-row']").first();
    if (await testRow.count() > 0) {
      await testRow.click();
      console.log("[REVIEW] 시험지 doc 선택");
    } else {
      await fallback.click();
      console.log("[REVIEW] 일반 doc 선택 (시험지 미발견)");
    }

    // URL ?docId 동기화
    await page.waitForTimeout(800);
    const url = page.url();
    if (!/docId=\d+/.test(url)) {
      rec("P1", "URL 동기화", `?docId=N 미반영: ${url}`);
    }

    // 액션바 — 원본 보기 / 직접 자르기 / 자동 적중 PDF
    const previewBtn = page.locator("[data-testid='matchup-doc-preview-btn']");
    const cropBtn = page.locator("[data-testid='matchup-doc-manual-crop-btn']");
    const pdfBtn = page.locator("[data-testid='matchup-doc-hit-report-btn']");
    await expect(previewBtn).toBeVisible({ timeout: 8000 });
    await expect(cropBtn).toBeVisible();
    await expect(pdfBtn).toBeVisible();
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
      await page.waitForTimeout(1500);
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
    if (await testRow.count() > 0 && pCount > 0) {
      await crossTab.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SHOTS, "04-cross-matches.png"), fullPage: true });

      const crossDisabled = await crossTab.isDisabled();
      if (crossDisabled) {
        rec("P1", "cross-matches", "시험지인데 자료별 매치 탭 disabled");
      }
    }
  });

  test("03. 자동 적중 PDF 다운로드 (vertical stack 검증)", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });

    // 시험지 doc 우선. status=done 보장
    const doneTestDoc = page.locator(
      "[data-testid='matchup-doc-row'][data-doc-status='done'][data-doc-intent='test']",
    ).first();
    let used = doneTestDoc;
    if (await doneTestDoc.count() === 0) {
      // fallback: 첫 done doc
      used = page.locator("[data-testid='matchup-doc-row'][data-doc-status='done']").first();
    }
    if (await used.count() === 0) {
      // 더 fallback: 첫 row
      used = page.locator("[data-testid='matchup-doc-row'], [data-doc-id]").first();
    }
    await used.click();
    await page.waitForTimeout(800);

    const pdfBtn = page.locator("[data-testid='matchup-doc-hit-report-btn']");
    await expect(pdfBtn).toBeVisible({ timeout: 5000 });

    const isDisabled = await pdfBtn.isDisabled();
    if (isDisabled) {
      rec("P1", "자동 PDF", "선택 doc에서 자동 적중 PDF 버튼 disabled (status≠done)");
      return;
    }

    // 다운로드 트리거 — Promise.all로 download event 캡처
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 5 * 60_000 }),
      pdfBtn.click(),
    ]);

    const savePath = path.join(SHOTS, "auto-hit-report.pdf");
    await download.saveAs(savePath);
    const stat = fs.statSync(savePath);
    console.log(`[REVIEW] PDF 크기: ${(stat.size / 1024).toFixed(1)} KB`);

    // 매직 헤더 검증
    const head = fs.readFileSync(savePath).slice(0, 5).toString("ascii");
    expect(head).toMatch(/^%PDF-/);
    if (stat.size < 50_000) {
      rec("P1", "자동 PDF", `PDF 크기 비정상적으로 작음 (${stat.size}B) — 이미지 누락 가능`);
    }

    await page.screenshot({ path: path.join(SHOTS, "05-pdf-download.png") });
  });

  test("04. 카테고리 인라인 편집 (변경 후 원복)", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });

    const firstRow = page.locator("[data-testid='matchup-doc-row'], [data-doc-id]").first();
    if (await firstRow.count() === 0) return;
    await firstRow.click();
    await page.waitForTimeout(600);

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
    await page.waitForTimeout(800);

    // 새 값 노출 확인
    const newCat = (await catBadge.textContent())?.trim() ?? "";
    if (newCat !== TEST_VAL && !newCat.includes(TEST_VAL)) {
      rec("P1", "카테고리 편집", `편집 후 라벨 미반영: expected ${TEST_VAL}, got ${newCat}`);
    }

    // 원복
    await catBadge.click();
    await page.waitForTimeout(300);
    const inp2 = editArea.locator("input");
    await inp2.fill(original);
    if (original === "" || original === "+ 카테고리 지정") {
      // 빈 값으로 저장 — 미분류로 이동
      await inp2.fill("");
    }
    await saveBtn.click();
    await page.waitForTimeout(600);
    console.log(`[REVIEW] 카테고리 편집 원복: "${original}"`);
  });

  test("05. 직접 자르기 모달 진입 + 페이지 로드", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });

    const firstRow = page.locator("[data-testid='matchup-doc-row'][data-doc-status='done']").first();
    if (await firstRow.count() === 0) {
      rec("P1", "직접 자르기", "테스트할 done 상태 문서 없음");
      return;
    }
    await firstRow.click();
    await page.waitForTimeout(600);

    const cropBtn = page.locator("[data-testid='matchup-doc-manual-crop-btn']");
    await cropBtn.click();
    await page.waitForTimeout(2000);

    const modal = page.locator("[role='dialog'], [data-testid='manual-crop-modal']").first();
    await expect(modal).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(SHOTS, "06-manual-crop-modal.png"), fullPage: true });

    // ESC로 닫기
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  });

  test("06. 업로드 모달 진입 + 라디오/카테고리 prefill", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });

    // 우상단 / 빈 상태 / 트리 어디서든 업로드 진입
    const uploadBtn = page.locator(
      "[data-testid='matchup-upload-button'], [data-testid='matchup-empty-test-btn'], [data-testid='matchup-empty-reference-btn']",
    ).first();
    if (await uploadBtn.count() === 0) {
      rec("P1", "업로드 진입", "업로드 버튼 셀렉터 미발견 (testid 변경 가능)");
      return;
    }
    await uploadBtn.click();
    await page.waitForTimeout(800);

    const modal = page.locator("[data-testid='matchup-upload-modal']").first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 분리 라디오 (B2 적용)
    const splitRadio = page.locator("[data-testid='matchup-split-mode-toggle']");
    const mergeRadio = page.locator("[data-testid='matchup-merge-mode-toggle']");
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
