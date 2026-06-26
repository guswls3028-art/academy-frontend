/**
 * E2E: 매치업 엔드투엔드 — PDF 업로드 → AI 분석 → 문제 추출 → 유사 검색
 * Tenant 1 (hakwonplus), 운영 서버 대상
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";
import { apiCall } from "../helpers/api";
import { gotoAndSettle } from "../helpers/wait";
import { fetchMatchupDocuments, openMatchupUploadModal, waitForMatchupDocumentByTitle } from "../helpers/matchup";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TAG = `[E2E-${Date.now()}]`;

test.describe("매치업 E2E — 업로드 → AI 처리 → 검증", () => {
  let cleanupTitle: string | null = null;

  test.afterEach(async ({ page }) => {
    if (!cleanupTitle) return;
    const docs = await fetchMatchupDocuments(page).catch(() => []);
    const targets = docs.filter((doc) => doc.title === cleanupTitle);
    for (const doc of targets) {
      await apiCall(page, "DELETE", `/matchup/documents/${doc.id}/`).catch(() => undefined);
    }
    cleanupTitle = null;
  });

  test("PDF 업로드 → AI 분석 대기 → 문제 추출 확인", async ({ page }) => {
    test.setTimeout(480_000); // 운영 worker cold-start + 분석 대기 고려

    await loginViaUI(page, "admin");

    // 1. 매치업 탭으로 이동
    await page.goto("https://hakwonplus.com/admin/storage/matchup", {
      waitUntil: "load",
      timeout: 15000,
    });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    // 2. 업로드 모달 열기
    const modal = await openMatchupUploadModal(page, "test");
    await expect(modal.locator('[data-testid="matchup-file-input"]')).toBeAttached({ timeout: 5000 });

    // 3. 파일 선택 + 메타데이터 입력
    const fileInput = page.locator('[data-testid="matchup-file-input"]');
    const testPdf = path.resolve(__dirname, "../fixtures/test-matchup.pdf");
    await fileInput.setInputFiles(testPdf);

    // 제목 자동 채워지는지 확인
    await expect(page.locator('input[placeholder="문서 제목"]')).not.toHaveValue("");

    // 제목을 E2E 태그로 변경
    const title = `${TAG} 수학 테스트`;
    cleanupTitle = title;
    await page.locator('input[placeholder="문서 제목"]').fill(title);
    await page.locator('input[placeholder="예: 수학"]').fill("수학");
    await page.locator('input[placeholder="예: 고1"]').fill("고1");

    // 스크린샷: 업로드 직전
    await page.screenshot({ path: "e2e/screenshots/matchup-upload-filled.png", fullPage: true });

    // 4. 업로드 실행 — 모달 안의 '업로드' 버튼 (마지막 버튼)
    const uploadBtn = page.locator('[data-testid="matchup-upload-submit"]');
    await uploadBtn.click();

    // 모달 닫힘 확인
    await expect(page.locator('[data-testid="matchup-upload-modal"]')).not.toBeVisible({ timeout: 30_000 });

    // 5. 업로드한 문서가 운영 API에서 완료될 때까지 대기
    const doc = await waitForMatchupDocumentByTitle(page, title, 360_000);
    expect(doc.status, "업로드 문서 처리 상태").toBe("done");
    expect(doc.problem_count ?? 0, "추출된 문제 수").toBeGreaterThan(0);

    // 스크린샷: 업로드 직후 (processing 상태)
    await page.screenshot({ path: "e2e/screenshots/matchup-processing.png", fullPage: true });

    // 6. 업로드한 문서 상세로 진입
    await gotoAndSettle(page, `https://hakwonplus.com/admin/storage/matchup?docId=${doc.id}`, { timeout: 30_000 });
    const docRow = page.locator(`[data-testid="matchup-doc-row"][data-doc-id="${doc.id}"]`).first();
    if (await docRow.count() > 0) await docRow.click();

    // 스크린샷: 처리 완료 상태
    await page.screenshot({ path: "e2e/screenshots/matchup-done.png", fullPage: true });

    // 7. 문제 그리드 표시 확인
    const problemCards = page.locator("[data-problem-id]");
    await expect(problemCards.first()).toBeVisible({ timeout: 20_000 });
    const cardCount = await problemCards.count();
    console.log(`Extracted problems: ${cardCount}`);
    expect(cardCount).toBeGreaterThan(0);

    // 스크린샷: 문제 그리드
    await page.screenshot({ path: "e2e/screenshots/matchup-problems.png", fullPage: true });

    // 8. 첫 번째 문제 클릭 → 유사 문제 추천
    await problemCards.first().click();
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    // 스크린샷: 유사 문제 (문제가 1개뿐이면 "유사한 문제를 찾지 못했습니다" 표시)
    await page.screenshot({ path: "e2e/screenshots/matchup-similar.png", fullPage: true });

    // 9. Cleanup — 테스트 문서 삭제
    const deleted = await apiCall(page, "DELETE", `/matchup/documents/${doc.id}/`);
    expect([200, 202, 204]).toContain(deleted.status);
    cleanupTitle = null;

    // 최종 스크린샷
    await page.screenshot({ path: "e2e/screenshots/matchup-final.png", fullPage: true });
  });
});
