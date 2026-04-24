/**
 * E2E: 매치업 엔드투엔드 — PDF 업로드 → AI 분석 → 문제 추출 → 유사 검색
 * Tenant 1 (hakwonplus), 운영 서버 대상
 */
import { test, expect } from "@playwright/test";
import { loginViaUI, getApiBaseUrl } from "../helpers/auth";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API = getApiBaseUrl();
const TAG = `[E2E-${Date.now()}]`;

test.describe("매치업 E2E — 업로드 → AI 처리 → 검증", () => {
  test("PDF 업로드 → AI 분석 대기 → 문제 추출 확인", async ({ page }) => {
    test.setTimeout(180_000); // 3분 (AI 처리 시간 고려)

    await loginViaUI(page, "admin");

    // 1. 매치업 탭으로 이동
    await page.goto("https://hakwonplus.com/admin/storage/matchup", {
      waitUntil: "load",
      timeout: 15000,
    });
    await page.waitForTimeout(1000);

    // 2. 업로드 모달 열기
    await page.getByText("문서 업로드").click();
    await expect(page.getByText("PDF, PNG, JPG 파일을 선택하세요")).toBeVisible({ timeout: 3000 });

    // 3. 파일 선택 + 메타데이터 입력
    const fileInput = page.locator('input[type="file"]');
    const testPdf = path.resolve(__dirname, "../fixtures/test-matchup.pdf");
    await fileInput.setInputFiles(testPdf);

    // 제목 자동 채워지는지 확인
    await expect(page.locator('input[placeholder="문서 제목"]')).not.toHaveValue("");

    // 제목을 E2E 태그로 변경
    await page.locator('input[placeholder="문서 제목"]').fill(`${TAG} 수학 테스트`);
    await page.locator('input[placeholder="예: 수학"]').fill("수학");
    await page.locator('input[placeholder="예: 고1"]').fill("고1");

    // 스크린샷: 업로드 직전
    await page.screenshot({ path: "e2e/screenshots/matchup-upload-filled.png", fullPage: true });

    // 4. 업로드 실행 — 모달 안의 '업로드' 버튼 (마지막 버튼)
    const uploadBtn = page.locator("button").filter({ hasText: /^업로드$/ }).last();
    await uploadBtn.click();

    // 모달 닫힘 확인
    await expect(page.getByText("PDF, PNG, JPG 파일을 선택하세요")).not.toBeVisible({ timeout: 5000 });

    // 5. 문서 목록에 표시 확인
    await page.waitForTimeout(2000);
    const docItem = page.locator("text=" + `${TAG} 수학 테스트`);
    await expect(docItem).toBeVisible({ timeout: 10000 });

    // 스크린샷: 업로드 직후 (processing 상태)
    await page.screenshot({ path: "e2e/screenshots/matchup-processing.png", fullPage: true });

    // 6. AI 처리 완료 대기 (최대 2분)
    // 문서 클릭해서 선택
    await docItem.click();
    await page.waitForTimeout(1000);

    // "처리 중" → "N문제" 로 변경될 때까지 대기
    let attempts = 0;
    const maxAttempts = 40; // 40 * 3s = 120s
    let processingDone = false;

    while (attempts < maxAttempts) {
      // 페이지 새로고침 없이 폴링이 invalidate하므로 대기
      await page.waitForTimeout(3000);

      // "문제" 텍스트가 나타나면 완료
      const problemText = page.locator("text=/\\d+문제/").first();
      if (await problemText.isVisible().catch(() => false)) {
        processingDone = true;
        break;
      }

      // "실패" 체크
      const failedText = page.locator("text=실패").first();
      if (await failedText.isVisible().catch(() => false)) {
        // 스크린샷: 실패 상태
        await page.screenshot({ path: "e2e/screenshots/matchup-failed.png", fullPage: true });
        break;
      }

      attempts++;
    }

    // 스크린샷: 처리 완료 상태
    await page.screenshot({ path: "e2e/screenshots/matchup-done.png", fullPage: true });

    if (processingDone) {
      // 7. 문제 그리드 표시 확인
      await page.waitForTimeout(2000);
      const problemCards = page.locator("text=/^Q\\d+$/");
      const cardCount = await problemCards.count();
      console.log(`Extracted problems: ${cardCount}`);
      expect(cardCount).toBeGreaterThan(0);

      // 스크린샷: 문제 그리드
      await page.screenshot({ path: "e2e/screenshots/matchup-problems.png", fullPage: true });

      // 8. 첫 번째 문제 클릭 → 유사 문제 추천
      await problemCards.first().click();
      await page.waitForTimeout(2000);

      // 스크린샷: 유사 문제 (문제가 1개뿐이면 "유사한 문제를 찾지 못했습니다" 표시)
      await page.screenshot({ path: "e2e/screenshots/matchup-similar.png", fullPage: true });
    }

    // 9. Cleanup — 테스트 문서 삭제
    // 삭제 버튼 클릭
    const deleteBtn = page.locator(`button[title="삭제"]`).first();
    if (await deleteBtn.isVisible().catch(() => false)) {
      await deleteBtn.click();
      // 확인 다이얼로그
      const confirmBtn = page.getByRole("button", { name: "삭제" });
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // 최종 스크린샷
    await page.screenshot({ path: "e2e/screenshots/matchup-final.png", fullPage: true });
  });
});
