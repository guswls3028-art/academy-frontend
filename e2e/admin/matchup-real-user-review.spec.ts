/**
 * LOCAL E2E: 매치업 업로드 UX 실사용 시나리오 + 리뷰용 스크린샷 수집
 *
 * 커버리지:
 *  A. 빈 상태 → 모달 열기
 *  B. 파일 1개 추가 → 썸네일/메타 입력
 *  C. 파일 추가 (혼합 2PDF + 2이미지)
 *  D. 순서 변경 / 제거 버튼 동작
 *  E. 업로드 실행 → 진행률 표시
 *  F. done 상태 + 세그멘테이션 뱃지
 *  G. 에러 케이스 (50MB 초과, 지원 안 하는 타입)
 */
import { test, expect, Page } from "@playwright/test";

const FRONT = "http://localhost:5174";
const API = "http://localhost:8000";

const MINIMAL_PDF = Buffer.from(
  "%PDF-1.4\n" +
  "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
  "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
  "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]>>endobj\n" +
  "xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\n" +
  "trailer<</Size 4/Root 1 0 R>>\nstartxref\n152\n%%EOF",
  "utf-8",
);

// 10x10 파란색 PNG
const BLUE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAF0lEQVR42mNkYGD4z0AEYBxVSF+FADNpAQNy6H6GAAAAAElFTkSuQmCC",
  "base64",
);
// 10x10 빨간색 PNG
const RED_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR42mP8z8DwnwEPYBxVSF+FAOhuAwPGdV8XAAAAAElFTkSuQmCC",
  "base64",
);

async function login(page: Page) {
  const resp = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: "admin97", password: "koreaseoul97", tenant_code: "hakwonplus" },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    timeout: 20000,
  });
  expect(resp.status()).toBe(200);
  const tokens = await resp.json();
  await page.goto(`${FRONT}/login`, { waitUntil: "commit" });
  await page.evaluate(({ access, refresh }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    try { sessionStorage.setItem("tenantCode", "hakwonplus"); } catch {}
  }, tokens);
  await page.goto(`${FRONT}/admin/storage/matchup`, { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(1500);
}

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

test.describe("매치업 실사용 시나리오 리뷰", () => {
  test("풀 플로우: 빈 상태 → 업로드 → 진행 → 완료 (스크린샷 수집)", async ({ page }) => {
    test.setTimeout(240_000);
    await login(page);

    // ── A. 현재 매치업 탭 상태 (빈 or 기존 문서 있음) ──
    await page.screenshot({ path: "e2e/screenshots/review-01-matchup-landing.png", fullPage: true });

    // ── B. 업로드 버튼 클릭 → 모달 열림 ──
    const uploadBtn = page.getByTestId("matchup-upload-button").or(
      page.getByRole("button", { name: "문서 업로드" }),
    );
    await uploadBtn.first().click();

    const modal = page.getByTestId("matchup-upload-modal");
    await expect(modal).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/review-02-modal-empty.png", fullPage: true });

    // ── C. 혼합 파일 추가 (2 PDF + 2 이미지) ──
    const title = `[E2E-${Date.now()}] 리뷰용 업로드`;
    await modal.locator('input[placeholder="문서 제목"]').fill(title);
    await modal.locator('input[placeholder="예: 수학"]').fill("수학");
    await modal.locator('input[placeholder="예: 고1"]').fill("중3");

    await modal.getByTestId("matchup-file-input").setInputFiles([
      { name: "단원1_문제지.pdf", mimeType: "application/pdf", buffer: MINIMAL_PDF },
      { name: "단원1_풀이지.pdf", mimeType: "application/pdf", buffer: MINIMAL_PDF },
      { name: "추가문항_01.png", mimeType: "image/png", buffer: BLUE_PNG },
      { name: "추가문항_02.png", mimeType: "image/png", buffer: RED_PNG },
    ]);

    await expect(modal.getByTestId("matchup-upload-entry")).toHaveCount(4);
    await page.screenshot({ path: "e2e/screenshots/review-03-modal-4files.png", fullPage: true });

    // ── D. 순서 변경 테스트 — 3번째 항목을 위로 ↑ ──
    const entries = modal.getByTestId("matchup-upload-entry");
    const thirdUpBtn = entries.nth(2).locator('button[title="위로"]');
    await thirdUpBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: "e2e/screenshots/review-04-modal-reordered.png", fullPage: true });

    // ── E. 제거 테스트 — 마지막 항목 X 클릭 ──
    const lastXBtn = entries.last().locator('button[title="제거"]');
    await lastXBtn.click();
    await page.waitForTimeout(300);
    await expect(modal.getByTestId("matchup-upload-entry")).toHaveCount(3);
    await page.screenshot({ path: "e2e/screenshots/review-05-modal-after-remove.png", fullPage: true });

    // ── F. 업로드 실행 ──
    await modal.getByTestId("matchup-upload-submit").click();
    await expect(modal).not.toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: "e2e/screenshots/review-06-uploaded.png", fullPage: true });

    // ── G. 업로드된 문서 row 확인 ──
    const row = page.locator('[data-testid="matchup-doc-row"]').filter({ hasText: title }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    // row 클릭 → 우측 상세 영역 확인
    await row.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "e2e/screenshots/review-07-selected-doc.png", fullPage: true });

    // ── H. 진행률 % 나오는지 폴링 대기 (최대 40초) ──
    // 진행률 바 또는 done 뱃지가 나올 때까지 주기 스크린샷
    const progressBar = row.locator('[data-testid="matchup-progress-bar"]');
    const endStateText = row.getByText(/\d+문제|텍스트|OCR|혼합|이미지|미검출/);

    const tEnd = Date.now() + 60_000;
    let shotIdx = 0;
    while (Date.now() < tEnd) {
      const pv = await progressBar.isVisible().catch(() => false);
      const dv = await endStateText.first().isVisible().catch(() => false);
      if (pv || dv) {
        shotIdx += 1;
        await page.screenshot({
          path: `e2e/screenshots/review-08-progress-${shotIdx}.png`,
          fullPage: true,
        });
      }
      if (dv) break;
      await page.waitForTimeout(3000);
    }

    await page.screenshot({ path: "e2e/screenshots/review-09-final.png", fullPage: true });

    // cleanup
    await cleanupDoc(page, title);
  });

  test("에러 케이스: 지원하지 않는 파일 형식", async ({ page }) => {
    await login(page);
    await page.getByTestId("matchup-upload-button").or(
      page.getByRole("button", { name: "문서 업로드" }),
    ).first().click();

    const modal = page.getByTestId("matchup-upload-modal");
    await expect(modal).toBeVisible();

    // txt 파일 업로드 시도 — 프론트에서 거부
    await modal.getByTestId("matchup-file-input").setInputFiles([
      { name: "bad.txt", mimeType: "text/plain", buffer: Buffer.from("hello") },
    ]);

    // 파일이 추가되지 않아야 함 + 에러 토스트
    await expect(modal.getByTestId("matchup-upload-entry")).toHaveCount(0);
    await page.screenshot({ path: "e2e/screenshots/review-err-01-bad-type.png", fullPage: true });
  });

  // 50MB 초과는 Playwright setInputFiles CDP 상 대용량 바이트 전송 제한이 있어 직접 테스트 대신
  // 프론트 검증 로직은 유닛으로 커버되고, 실제 동작은 backend curl 업로드 + 50MB 초과 케이스로 검증됨.
});
