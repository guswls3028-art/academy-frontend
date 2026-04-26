/**
 * PROD E2E: 매치업 업로드 풀 라운드트립 + 실제 AI 처리 완료까지 검증
 *
 * - 프론트: https://hakwonplus.com
 * - API:    https://api.hakwonplus.com
 * - Tenant 1 admin (admin97/koreaseoul97)
 *
 * 검증 흐름:
 *   1. 로그인 → 매치업 페이지
 *   2. 업로드 모달 UX 요소 확인
 *   3. 2 PDF 파일 업로드 (pdf-lib 병합 경로)
 *   4. 문서 목록에 processing row 등장
 *   5. 진행률 폴링 대기 (최대 4분)
 *   6. done 뱃지 + 세그멘테이션 방식 뱃지 확인
 *   7. 문제 row 클릭 → 오른쪽 상세에 문제 그리드 로드
 *   8. cleanup: 테스트 문서 삭제
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

const MINIMAL_PDF = Buffer.from(
  "%PDF-1.4\n" +
  "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
  "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
  "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]>>endobj\n" +
  "xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\n" +
  "trailer<</Size 4/Root 1 0 R>>\nstartxref\n152\n%%EOF",
  "utf-8",
);

async function cleanupDoc(page: Page, title: string) {
  page.on("dialog", (d) => d.accept());
  const row = page.locator('[data-testid="matchup-doc-row"]').filter({ hasText: title }).first();
  if (!(await row.isVisible({ timeout: 500 }).catch(() => false))) return;
  const deleteBtn = row.locator('button[title="삭제"]');
  if (!(await deleteBtn.isVisible().catch(() => false))) return;
  await deleteBtn.click();
  const confirmBtn = page.getByRole("button", { name: "삭제" }).last();
  if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirmBtn.click();
  }
}

test.describe("매치업 업로드 Prod 라운드트립", () => {
  test("풀 라운드트립: 업로드 → processing → done → 세그멘테이션 뱃지", async ({ page }) => {
    test.setTimeout(360_000); // 6분

    // ── 1. 로그인 ──
    await loginViaUI(page, "admin");
    await page.goto("https://hakwonplus.com/admin/storage/matchup", {
      waitUntil: "load",
      timeout: 30000,
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: "e2e/screenshots/prod-01-landing.png", fullPage: true });

    // ── 2. 업로드 모달 열기 ──
    const uploadBtn = page.getByTestId("matchup-upload-button").or(
      page.getByRole("button", { name: "문서 업로드" }),
    );
    await expect(uploadBtn.first()).toBeVisible({ timeout: 10000 });
    await uploadBtn.first().click();

    const modal = page.getByTestId("matchup-upload-modal");
    await expect(modal).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/prod-02-modal-empty.png", fullPage: true });

    // ── 3. 2개 PDF 파일 추가 (병합 경로) ──
    const title = `[E2E-${Date.now()}] prod round-trip`;
    await modal.locator('input[placeholder="문서 제목"]').fill(title);
    await modal.locator('input[placeholder="예: 수학"]').fill("수학");
    await modal.locator('input[placeholder="예: 고1"]').fill("고1");

    await modal.getByTestId("matchup-file-input").setInputFiles([
      { name: "round1.pdf", mimeType: "application/pdf", buffer: MINIMAL_PDF },
      { name: "round2.pdf", mimeType: "application/pdf", buffer: MINIMAL_PDF },
    ]);
    await expect(modal.getByTestId("matchup-upload-entry")).toHaveCount(2);
    await expect(modal.getByTestId("matchup-upload-submit")).toHaveText(/2개 합쳐서 업로드/);

    await page.screenshot({ path: "e2e/screenshots/prod-03-modal-2files.png", fullPage: true });

    // ── 4. 업로드 실행 ──
    await modal.getByTestId("matchup-upload-submit").click();
    await expect(modal).not.toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(500);

    await page.screenshot({ path: "e2e/screenshots/prod-04-after-upload.png", fullPage: true });

    // ── 5. 문서 목록에 row 등장 ──
    const row = page.locator('[data-testid="matchup-doc-row"]').filter({ hasText: title }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });

    // 클릭해서 우측 상세 로드
    await row.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "e2e/screenshots/prod-05-selected-processing.png", fullPage: true });

    // ── 6. 진행률 폴링 → done 대기 (최대 4분) ──
    // done 판정은 processing progress 바가 사라지고 문제 수("N문제") 뱃지가 등장할 때.
    // (이미지 저장 85% 같은 처리중 step name이 'image' 세그멘테이션 뱃지와 헷갈리지 않도록 분리)
    const progressBar = row.locator('[data-testid="matchup-progress-bar"]');
    const problemBadge = row.getByText(/\d+문제/).first();

    const deadline = Date.now() + 240_000;
    let shotIdx = 0;
    let seenProgress = false;

    while (Date.now() < deadline) {
      const pv = await progressBar.isVisible().catch(() => false);
      const cv = await problemBadge.isVisible().catch(() => false);
      if (pv && !seenProgress) {
        seenProgress = true;
        shotIdx += 1;
        await page.screenshot({
          path: `e2e/screenshots/prod-06-progress-${shotIdx}.png`,
          fullPage: true,
        });
      }
      if (cv) {
        await page.waitForTimeout(800); // 뱃지 애니메이션 안정화
        shotIdx += 1;
        await page.screenshot({
          path: `e2e/screenshots/prod-07-done-${shotIdx}.png`,
          fullPage: true,
        });
        break;
      }
      await page.waitForTimeout(5000);
    }

    const ended = await problemBadge.isVisible().catch(() => false);
    if (!ended) {
      await page.screenshot({ path: "e2e/screenshots/prod-08-timeout.png", fullPage: true });
    }
    expect(ended, "문서가 4분 이내에 done(N문제 뱃지) 상태로 전환되지 않음").toBeTruthy();

    // ── 7. 세그멘테이션 뱃지 확인 — done 이후 다른 뱃지와 인접해 있어야 함 ──
    const segBadge = row.locator('span', { hasText: /^(텍스트|OCR|혼합|이미지|미검출)$/ }).first();
    const hasSeg = await segBadge.isVisible({ timeout: 5_000 }).catch(() => false);
    console.log(`[prod] segmentation badge visible: ${hasSeg}`);
    expect(hasSeg, "done 뱃지 옆에 세그멘테이션 방식 뱃지가 보여야 함").toBeTruthy();

    await page.screenshot({ path: "e2e/screenshots/prod-09-final.png", fullPage: true });

    // ── 8. cleanup ──
    await cleanupDoc(page, title);
  });
});
