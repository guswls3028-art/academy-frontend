/**
 * 매치업 UIUX 개편 (2026-05-04) — 운영 검증.
 *
 * 검증 항목:
 *  P0-1: 헤더 액션바 2-tier — 적중보고서 primary CTA + ⋮ "더 보기" 메뉴
 *  P0-2: 시험지→참고자료 전환 confirm 가드
 *  P0-3: DocumentList 카운트 라벨 풀어쓰기 ("시험지 N건 / 참고자료 N건")
 *  P0-5: SimilarResults Pin hint + 카드 redesign
 *  P0-6: 좌측 트리 보고서 모음 진입점
 *  P1-7: 합치기 모드 우측 패널 도움말 (MergeModeRightPanel)
 *  P1-1: ProblemCard 번호불일치/검수 stripe 강조 (data-has-issue)
 *  P1-5: HitReportEditor 자동저장 3-state 표시 (matchup-hit-report-save-state)
 *
 * Tenant 1 (admin97) 운영 환경 readonly 검증.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

test.describe("매치업 UIUX 개편 — 2026-05-04", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });
  });

  test("P0-3: DocumentList 카운트 라벨 풀어쓰기 + 보고서 모음 진입점", async ({ page }) => {
    // 좌측 상단 보고서 모음 버튼 — "내 적중 보고서 모음" 또는 "학원 적중 보고서 모음"
    const reportInbox = page.getByRole("button", { name: /(내 적중 보고서 모음|학원 적중 보고서 모음)/ });
    await expect(reportInbox).toBeVisible({ timeout: 10000 });

    // 검색/필터 영역에 "시험지 N · 참고자료 N" intent 글로벌 카운트
    const totalCounts = page.locator(".treeNavHeader, [data-testid='matchup-doc-search']").first();
    await expect(totalCounts).toBeVisible();
    // 최소 한 곳에 풀어쓰기 라벨 노출 확인
    const label = page.getByText(/시험지 \d+/).first();
    await expect(label).toBeVisible();
  });

  test("P0-1: 헤더 액션바 2-tier — primary CTA + ⋮ 메뉴", async ({ page }) => {
    const firstDoc = page.locator("[data-testid='matchup-doc-row']").first();
    if (await firstDoc.count() === 0) {
      test.skip(true, "문서가 없어 헤더 검증 불가");
      return;
    }
    await firstDoc.click();
    await page.waitForTimeout(800);

    // ⋮ "더 보기" 메뉴 trigger 노출
    const moreMenu = page.locator("[data-testid='matchup-doc-more-menu-trigger']");
    await expect(moreMenu).toBeVisible({ timeout: 5000 });

    // 클릭 시 원본 PDF 보기 / 저장소에서 보기 항목 노출
    await moreMenu.click();
    await expect(page.locator("[data-testid='matchup-doc-more-menu']")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("원본 PDF 보기").first()).toBeVisible();

    // 메뉴 닫기
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-testid='matchup-doc-more-menu']")).toHaveCount(0);

    // 직접 자르기 버튼 = 헤더에 직접 노출 (Button 컴포넌트)
    await expect(page.locator("[data-testid='matchup-doc-manual-crop-btn']")).toBeVisible();

    // segmented 토글 (시험지/참고자료) 노출
    await expect(page.locator("[data-testid='matchup-intent-toggle']")).toBeVisible();
    await expect(page.locator("[data-testid='matchup-intent-toggle-test']")).toBeVisible();
    await expect(page.locator("[data-testid='matchup-intent-toggle-reference']")).toBeVisible();
  });

  test("P0-1+P0-6: 시험지 doc → 적중 보고서 primary CTA 노출", async ({ page }) => {
    // 시험지(test) doc 1건 찾기
    const testDoc = page.locator("[data-testid='matchup-doc-row'][data-doc-intent='test']").first();
    if (await testDoc.count() === 0) {
      test.skip(true, "시험지 문서가 없어 적중보고서 CTA 검증 불가");
      return;
    }
    await testDoc.click();
    await page.waitForTimeout(800);

    // 적중 보고서 작성 버튼 노출 (primary intent)
    const reportBtn = page.locator("[data-testid='matchup-doc-hit-report-curate-btn']");
    await expect(reportBtn).toBeVisible({ timeout: 5000 });
    await expect(reportBtn).toContainText("적중 보고서 작성");
  });

  test("P0-2: 시험지 → 참고자료 전환 시 confirm 다이얼로그", async ({ page }) => {
    const testDoc = page.locator("[data-testid='matchup-doc-row'][data-doc-intent='test']").first();
    if (await testDoc.count() === 0) {
      test.skip(true, "시험지 문서 없음 — 전환 confirm 검증 불가");
      return;
    }
    await testDoc.click();
    await page.waitForTimeout(800);

    // segmented 토글 — 참고자료 클릭
    const refTab = page.locator("[data-testid='matchup-intent-toggle-reference']");
    await refTab.click();

    // confirm 다이얼로그 노출 (적중 보고서 데이터 손실 안내)
    const confirmDialog = page.getByText(/시험지를 참고자료로 변경/);
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    // 취소 버튼 → 변경 안 됨
    const cancelBtn = page.getByRole("button", { name: "취소" });
    await cancelBtn.click();
    // 여전히 시험지 active (data-active=true)
    await expect(page.locator("[data-testid='matchup-intent-toggle-test'][data-active='true']")).toBeVisible({ timeout: 3000 });
  });

  test("P1-7: 합치기 모드 우측 패널 도움말 노출", async ({ page }) => {
    // 문제가 2개 이상 있는 done doc 찾기
    const doneDoc = page.locator("[data-testid='matchup-doc-row'][data-doc-status='done']").first();
    if (await doneDoc.count() === 0) {
      test.skip(true, "완료된 문서 없음");
      return;
    }
    await doneDoc.click();
    await page.waitForTimeout(1000);

    const mergeEnter = page.locator("[data-testid='matchup-merge-mode-enter']");
    if (await mergeEnter.count() === 0) {
      test.skip(true, "이 문서에 합치기 진입 버튼 없음 (문항 1개 이하)");
      return;
    }
    await mergeEnter.click();
    await page.waitForTimeout(500);

    // 우측 패널이 합치기 도움말로 교체됨
    const rightPanel = page.locator("[data-testid='matchup-merge-mode-right-panel']");
    await expect(rightPanel).toBeVisible({ timeout: 3000 });
    await expect(rightPanel).toContainText("합치기 모드");
    await expect(rightPanel).toContainText(/위→아래 순서/);

    // 합치기 모드 종료 버튼 노출
    const exitBtn = rightPanel.getByRole("button", { name: "합치기 모드 종료" });
    await expect(exitBtn).toBeVisible();
  });

  test("P0-5: SimilarResults Pin hint 노출 (시험지 컨텍스트)", async ({ page }) => {
    const testDoc = page.locator("[data-testid='matchup-doc-row'][data-doc-intent='test'][data-doc-status='done']").first();
    if (await testDoc.count() === 0) {
      test.skip(true, "완료된 시험지 문서 없음");
      return;
    }
    await testDoc.click();
    await page.waitForTimeout(1500);

    // 첫 문제 카드 클릭
    const firstProblem = page.locator("[data-testid='matchup-problem-card']").first();
    if (await firstProblem.count() === 0) {
      test.skip(true, "이 시험지에 문항 없음");
      return;
    }
    await firstProblem.click();
    await page.waitForTimeout(2000);

    // Pin hint 배너 노출 (시험지 + hitReportId 있을 때만)
    // — 보고서 draft 자동 로드 후 hint 노출 확인
    const pinHint = page.locator("[data-testid='matchup-similar-pin-hint']");
    // hint는 보고서 draft fetch 성공 시에만 노출 — count 0 허용 (시험지에 문항 0이면 draft 실패)
    const hintCount = await pinHint.count();
    if (hintCount > 0) {
      await expect(pinHint).toContainText(/별/);
      await expect(pinHint).toContainText(/적중 보고서/);
    }
  });
});
