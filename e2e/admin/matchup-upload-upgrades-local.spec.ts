/**
 * LOCAL E2E: 매치업 업로드 UX 개선 검증
 *
 * 검증 대상:
 *  - 여러 PDF + 이미지 혼합 업로드
 *  - 이미지 썸네일 미리보기
 *  - 세그멘테이션 방식 뱃지 (done 상태)
 *  - 진행률 % 표시 (processing 상태)
 *
 * 전제:
 *   - Local frontend: http://localhost:5174
 *   - Local backend:  http://localhost:8000
 *   - Tenant 1 admin: admin97 / koreaseoul97
 */
import { test, expect, Page } from "@playwright/test";

const FRONT = "http://localhost:5174";
const API = "http://localhost:8000";

// 최소 유효 PDF 바이트 (1 페이지, 텍스트 없음).
// pdf-lib 설치 없이도 업로드 가능한 고정 픽스처.
const MINIMAL_PDF = Buffer.from(
  "%PDF-1.4\n" +
  "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
  "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
  "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]>>endobj\n" +
  "xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\n" +
  "trailer<</Size 4/Root 1 0 R>>\nstartxref\n152\n%%EOF",
  "utf-8",
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

function makeTinyPdf(_label: string): Buffer {
  // label은 현재 미사용 (최소 PDF 고정 바이트) — 추후 확장 여지 남김
  return MINIMAL_PDF;
}

// 1x1 흰 PNG
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGD4DwABBAEAXvSu4AAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("매치업 업로드 개편 (로컬)", () => {
  test("업로드 모달: 혼합 파일 + 썸네일 + 여러 개 합쳐서 업로드 버튼", async ({ page }) => {
    await login(page);

    // 업로드 버튼
    const uploadBtn = page.getByTestId("matchup-upload-button").or(
      page.getByRole("button", { name: "문서 업로드" }),
    );
    await expect(uploadBtn.first()).toBeVisible({ timeout: 10000 });
    await uploadBtn.first().click();

    const modal = page.getByTestId("matchup-upload-modal");
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.getByText(/PDF \+ 이미지 여러 개/)).toBeVisible();

    // 드래그앤드롭 존 — 안내 문구
    await expect(modal.getByText(/PDF 여러 개도 OK/)).toBeVisible();

    // 혼합 파일 세팅: PDF 2개 + 이미지 1개
    const pdfA = makeTinyPdf("페이지 A");
    const pdfB = makeTinyPdf("페이지 B");

    const fileInput = modal.getByTestId("matchup-file-input");
    await fileInput.setInputFiles([
      { name: "a.pdf", mimeType: "application/pdf", buffer: pdfA },
      { name: "b.pdf", mimeType: "application/pdf", buffer: pdfB },
      { name: "c.png", mimeType: "image/png", buffer: TINY_PNG },
    ]);

    // 3개 엔트리가 생성됨
    const entries = modal.getByTestId("matchup-upload-entry");
    await expect(entries).toHaveCount(3);

    // 이미지 썸네일이 img 태그로 보여야 함 (png만)
    const thumbImg = entries.nth(2).locator("img");
    await expect(thumbImg).toBeVisible();
    expect(await thumbImg.getAttribute("src")).toContain("blob:");

    // PDF는 FileText 아이콘이어야 함 (img 없음)
    await expect(entries.nth(0).locator("img")).toHaveCount(0);

    // 요약 문구: PDF 2 · 이미지 1
    await expect(modal.getByText(/PDF 2.*이미지 1/)).toBeVisible();

    // 제출 버튼 문구
    const submit = modal.getByTestId("matchup-upload-submit");
    await expect(submit).toHaveText(/3개 합쳐서 업로드/);

    // 스크린샷
    await page.screenshot({
      path: "e2e/screenshots/matchup-upload-mixed.png",
      fullPage: true,
    });

    // 닫기
    await modal.getByRole("button", { name: "취소" }).click();
  });

  test("단일 PDF는 그대로 업로드 (병합 없음) 버튼 문구 검증", async ({ page }) => {
    await login(page);

    await page.getByTestId("matchup-upload-button").or(
      page.getByRole("button", { name: "문서 업로드" }),
    ).first().click();

    const modal = page.getByTestId("matchup-upload-modal");
    await expect(modal).toBeVisible();

    const pdf = makeTinyPdf("solo");
    await modal.getByTestId("matchup-file-input").setInputFiles([
      { name: "solo.pdf", mimeType: "application/pdf", buffer: pdf },
    ]);

    await expect(modal.getByTestId("matchup-upload-entry")).toHaveCount(1);
    // 단일 PDF → 병합 안내 문구 안 보임
    await expect(modal.getByText(/1개 PDF로 합쳐서/)).toHaveCount(0);
    // 버튼 문구: "업로드" (합쳐서 아님)
    await expect(modal.getByTestId("matchup-upload-submit")).toHaveText(/^업로드$/);
  });

  test("단일 PDF 업로드 → 문서 row + 상태 표시 (병합 없음)", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page);

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    await page.getByTestId("matchup-upload-button").or(
      page.getByRole("button", { name: "문서 업로드" }),
    ).first().click();

    const modal = page.getByTestId("matchup-upload-modal");
    const title = `[E2E-${Date.now()}] 업로드 개편 검증`;
    await modal.locator('input[placeholder="문서 제목"]').fill(title);

    const pdf = makeTinyPdf("단일");
    await modal.getByTestId("matchup-file-input").setInputFiles([
      { name: "solo.pdf", mimeType: "application/pdf", buffer: pdf },
    ]);
    await expect(modal.getByTestId("matchup-upload-entry")).toHaveCount(1);
    await expect(modal.getByTestId("matchup-upload-submit")).toHaveText(/^업로드$/);

    await modal.getByTestId("matchup-upload-submit").click();
    await expect(modal).not.toBeVisible({ timeout: 20_000 });

    const row = page.locator('[data-testid="matchup-doc-row"]').filter({ hasText: title }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    // 진행률 바 또는 상태 표시 중 하나가 나타남
    const progressBar = row.locator('[data-testid="matchup-progress-bar"]');
    const statusText = row.getByText(/\d+문제|텍스트|OCR|혼합|이미지|미검출|처리 중|대기|실패/);

    await expect(async () => {
      const pv = await progressBar.isVisible().catch(() => false);
      const sv = await statusText.first().isVisible().catch(() => false);
      expect(pv || sv).toBeTruthy();
    }).toPass({ timeout: 50_000 });

    await page.screenshot({
      path: "e2e/screenshots/matchup-single-pdf-uploaded.png",
      fullPage: true,
    });

    expect(errors, "no browser errors during single PDF upload").toEqual([]);

    // cleanup
    page.on("dialog", (d) => d.accept());
    const deleteBtn = row.locator('button[title="삭제"]');
    if (await deleteBtn.isVisible().catch(() => false)) {
      await deleteBtn.click();
      const confirmBtn = page.getByRole("button", { name: "삭제" }).last();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
      }
    }
  });

  test("병합 경로: 2개 PDF 업로드 → pdf-lib로 합쳐지고 업로드됨", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    await page.getByTestId("matchup-upload-button").or(
      page.getByRole("button", { name: "문서 업로드" }),
    ).first().click();

    const modal = page.getByTestId("matchup-upload-modal");
    const title = `[E2E-${Date.now()}] 병합 업로드 검증`;
    await modal.locator('input[placeholder="문서 제목"]').fill(title);

    const pdfA = makeTinyPdf("A");
    const pdfB = makeTinyPdf("B");
    await modal.getByTestId("matchup-file-input").setInputFiles([
      { name: "a.pdf", mimeType: "application/pdf", buffer: pdfA },
      { name: "b.pdf", mimeType: "application/pdf", buffer: pdfB },
    ]);
    await expect(modal.getByTestId("matchup-upload-entry")).toHaveCount(2);
    await modal.getByTestId("matchup-upload-submit").click();

    // pdf-lib CDN 로드 + 병합 포함 최대 60초
    await expect(modal).not.toBeVisible({ timeout: 60_000 });

    const row = page.locator('[data-testid="matchup-doc-row"]').filter({ hasText: title }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    await page.screenshot({
      path: "e2e/screenshots/matchup-merged-upload.png",
      fullPage: true,
    });

    expect(errors, "no browser errors during merge upload").toEqual([]);

    // cleanup
    page.on("dialog", (d) => d.accept());
    const deleteBtn = row.locator('button[title="삭제"]');
    if (await deleteBtn.isVisible().catch(() => false)) {
      await deleteBtn.click();
      const confirmBtn = page.getByRole("button", { name: "삭제" }).last();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
      }
    }
  });
});
