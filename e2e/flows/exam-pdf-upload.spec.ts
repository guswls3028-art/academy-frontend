/**
 * Exam PDF Upload E2E
 *
 * 시험지 PDF 업로드 통합 플로우 검증:
 *   1. API: 템플릿 시험에 PDF 업로드 (POST /exams/{id}/assets/)
 *   2. UI: ExamPdfUploadModal 진행상황 표시 (업로드 중 → 완료)
 *   3. 진입점 통일: ExamPolicyPanel + ExamAssetsPanel 모두 같은 모달 사용
 *
 * Tenant 1 (hakwonplus) — dev/test tenant only.
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page, Browser } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";

const BASE = getBaseUrl("admin");
const TS = Date.now();
const TODAY = new Date().toISOString().slice(0, 10);

type ExamAsset = {
  asset_type?: string | null;
  file_key?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function numberFrom(value: unknown): number | null {
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function stringFrom(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function listOf<T>(body: unknown, guard: (value: unknown) => value is T): T[] {
  const source = isRecord(body) && Array.isArray(body.results) ? body.results : body;
  return Array.isArray(source) ? source.filter(guard) : [];
}

function isExamAsset(value: unknown): value is ExamAsset {
  if (!isRecord(value)) return false;
  return stringFrom(value.asset_type) !== null || stringFrom(value.file_key) !== null;
}

function pdfUploadModal(page: Page) {
  return page.locator(".admin-modal__inner").filter({ hasText: "시험 자료 올리기" }).last();
}

test.describe.serial("Exam PDF upload flow", () => {
  let browser: Browser;
  let page: Page;

  /** 테스트에서 사용하는 시험 정보 */
  let regularExamId: number | null = null;
  let templateExamId: number | null = null;
  let sessionId: number | null = null;
  let lectureId: number | null = null;
  let createdLecture = false;
  let createdSession = false;
  let createdTemplate = false;
  let createdRegular = false;
  let cleanupDone = false;

  test.beforeAll(async ({ browser: b }) => {
    browser = b;
  });

  async function cleanupTestData(): Promise<void> {
    if (cleanupDone) return;
    cleanupDone = true;

    if (page) {
      if (createdRegular && regularExamId) {
        const r = await apiCall(page, "DELETE", `/exams/${regularExamId}/`);
        console.log(`  Cleanup regular exam ${regularExamId}: ${r.status}`);
      }
      if (createdTemplate && templateExamId) {
        const r = await apiCall(page, "DELETE", `/exams/${templateExamId}/`);
        console.log(`  Cleanup template exam ${templateExamId}: ${r.status}`);
      }
      if (createdSession && sessionId) {
        const r = await apiCall(page, "DELETE", `/lectures/sessions/${sessionId}/`);
        console.log(`  Cleanup session ${sessionId}: ${r.status}`);
      }
      if (createdLecture && lectureId) {
        const r = await apiCall(page, "DELETE", `/lectures/lectures/${lectureId}/`);
        console.log(`  Cleanup lecture ${lectureId}: ${r.status}`);
      }
      await page.context().close().catch(() => undefined);
    }
  }

  test.afterAll(async () => {
    await cleanupTestData();
  });

  // ══════════════════════════════════════════════════════
  // 1. Admin login
  // ══════════════════════════════════════════════════════
  test("1. Admin login", async () => {
    const ctx = await browser.newContext();
    page = await ctx.newPage();
    await loginViaUI(page, "admin");
    expect(page.url()).toContain("/workspace");
  });

  // ══════════════════════════════════════════════════════
  // 2. Create a fresh exam with session context
  // ══════════════════════════════════════════════════════
  test("2. Create exam with session + template context", async () => {
    const lectureResp = await apiCall(page, "POST", "/lectures/lectures/", {
      title: `[E2E-${TS}] 시험 자료 업로드 검증`,
      name: "E2E 시험 자료 업로드",
      subject: "수학",
      description: "격리된 시험 자료 업로드 canary",
      start_date: TODAY,
      lecture_time: "수 08:00 ~ 09:00",
      color: "#2563eb",
      chip_label: "검증",
      is_active: true,
    });
    lectureId = numberFrom(isRecord(lectureResp.body) ? lectureResp.body.id : null);
    if (lectureResp.status >= 300 || !lectureId) {
      throw new Error(`Lecture creation failed: ${lectureResp.status} ${JSON.stringify(lectureResp.body)}`);
    }
    createdLecture = true;

    const sessionResp = await apiCall(page, "POST", "/lectures/sessions/", {
      lecture: lectureId,
      title: `[E2E-${TS}] 업로드 차시`,
      date: TODAY,
      order: 1,
    });
    sessionId = numberFrom(isRecord(sessionResp.body) ? sessionResp.body.id : null);
    if (sessionResp.status >= 300 || !sessionId) {
      throw new Error(`Session creation failed: ${sessionResp.status} ${JSON.stringify(sessionResp.body)}`);
    }
    createdSession = true;

    const tmplResp = await apiCall(page, "POST", "/exams/", {
      title: `[E2E-${TS}] Template`,
      subject: "수학",
      exam_type: "template",
    });
    templateExamId = numberFrom(isRecord(tmplResp.body) ? tmplResp.body.id : null);
    if (tmplResp.status >= 300 || !templateExamId) {
      throw new Error(`Template creation failed: ${tmplResp.status} ${JSON.stringify(tmplResp.body)}`);
    }
    createdTemplate = true;

    const regResp = await apiCall(page, "POST", "/exams/", {
      title: `[E2E-${TS}] Regular`,
      template_exam_id: templateExamId,
      session_id: sessionId,
      exam_type: "regular",
    });
    regularExamId = numberFrom(isRecord(regResp.body) ? regResp.body.id : null);
    if (regResp.status >= 300 || !regularExamId) {
      throw new Error(`Regular exam creation failed: ${regResp.status} ${JSON.stringify(regResp.body)}`);
    }
    createdRegular = true;

    expect(templateExamId).toBeGreaterThan(0);
    expect(regularExamId).toBeGreaterThan(0);
    expect(sessionId).toBeGreaterThan(0);
    console.log(`  Final: template=${templateExamId}, regular=${regularExamId}, session=${sessionId}, lecture=${lectureId}`);
  });

  // ══════════════════════════════════════════════════════
  // 3. API: POST /exams/{templateId}/assets/ 직접 업로드 검증
  // ══════════════════════════════════════════════════════
  test("3. API: Upload PDF asset to template exam", async () => {
    test.skip(!templateExamId, "No template exam available");
    if (!templateExamId) throw new Error("No template exam available");

    const auth = await page.evaluate(() => ({
      access: localStorage.getItem("access") || "",
      tenantCode: sessionStorage.getItem("tenantCode") || "hakwonplus",
    }));
    const pdfContent = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF",
    );
    const apiBase = process.env.E2E_API_URL || "https://api.hakwonplus.com";
    const response = await page.request.post(
      `${apiBase}/api/v1/exams/${templateExamId}/assets/`,
      {
        headers: {
          Authorization: `Bearer ${auth.access}`,
          "X-Tenant-Code": auth.tenantCode,
        },
        multipart: {
          asset_type: "problem_pdf",
          file: {
            name: "e2e-test-exam.pdf",
            mimeType: "application/pdf",
            buffer: pdfContent,
          },
        },
      },
    );
    let body: unknown = null;
    try { body = await response.json(); } catch { body = null; }
    const result = { status: response.status(), body };

    console.log(`  POST /exams/${templateExamId}/assets/ → ${result.status}`);

    expect(result.status).toBeLessThan(300);
    if (!isExamAsset(result.body)) {
      throw new Error(`Unexpected asset response: ${JSON.stringify(result.body)}`);
    }
    expect(result.body.asset_type).toBe("problem_pdf");
    expect(result.body.file_key).toBeTruthy();
  });

  // ══════════════════════════════════════════════════════
  // 4. UI: Navigate to session exams page
  // ══════════════════════════════════════════════════════
  test("4. Navigate to session exams page", async () => {
    test.skip(!lectureId || !sessionId, "No session available");

    await page.goto(
      `${BASE}/workspace/lectures/${lectureId}/sessions/${sessionId}/exams?examId=${regularExamId}`,
      { waitUntil: "load", timeout: 15000 },
    );
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

    expect(page.url()).toContain("/exams");
    const root = page.locator("[data-app], main, #root").first();
    await expect(root).toBeVisible({ timeout: 10000 });
  });

  // ══════════════════════════════════════════════════════
  // 5. UI: Find exam and open upload modal
  // ══════════════════════════════════════════════════════
  test("5. Open ExamPdfUploadModal from exam page", async () => {
    test.skip(!lectureId || !sessionId, "No session available");

    // Try to find "시험지 PDF 업로드" or "시험지 업로드" button
    let uploadBtn = page.locator("button").filter({ hasText: /시험지.*PDF|시험지 업로드/ }).first();

    // If not visible, try to click on an exam in the left panel to load detail
    if (!(await uploadBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log("  Trying to select an exam in left panel...");

      // Look for clickable items in the left panel area
      const examListItems = page.locator("button, [role='listitem'], [class*='item']")
        .filter({ hasText: /시험|test|E2E|Template|Regular/i });

      const count = await examListItems.count();
      console.log(`  Found ${count} potential exam items`);

      if (count > 0) {
        await examListItems.first().click();
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
      }

      // Try again after selecting
      uploadBtn = page.locator("button").filter({ hasText: /시험지.*PDF|시험지 업로드/ }).first();
    }

    await expect(uploadBtn).toBeVisible({ timeout: 10000 });
    await uploadBtn.click();

      // Verify modal opened
      const modal = pdfUploadModal(page);
      const modalTitle = modal.locator(".modal-header").filter({ hasText: "시험 자료 올리기" }).first();
      await expect(modalTitle).toBeVisible({ timeout: 5000 });
      console.log("  ExamPdfUploadModal opened successfully");

      // A single entry accepts combined HWP/HWPX or a problem-only PDF/image.
      await expect(modal.getByText("문제+해설 한 파일")).toBeVisible({ timeout: 3000 });
      await expect(modal.getByText("문제 파일만")).toBeVisible({ timeout: 3000 });
      await expect(modal.getByText("문제·해설 두 파일")).toBeVisible({ timeout: 3000 });
      await expect(modal.getByText("시험 자료", { exact: true })).toBeVisible();
      let fileInputs = modal.locator('input[type="file"]');
      await expect(fileInputs).toHaveCount(1);
      await expect(fileInputs.first()).toHaveAttribute("accept", /\.hwpx/);

      await modal.getByRole("button", { name: "문제지와 해설지가 따로 있어요" }).click();
      await expect(modal.getByText("문제 파일", { exact: true })).toBeVisible();
      await expect(modal.getByText("선생님 해설 파일", { exact: true })).toBeVisible();
      fileInputs = modal.locator('input[type="file"]');
      await expect(fileInputs).toHaveCount(2);
      await expect(fileInputs.nth(1)).toHaveAttribute("accept", ".hwp,.hwpx");

      // A teacher HWP cannot be paired with another HWP as the problem source.
      await fileInputs.nth(0).setInputFiles({
        name: "teacher-marked-problems.hwp",
        mimeType: "application/x-hwp",
        buffer: Buffer.from("HWP problem fixture"),
      });
      await fileInputs.nth(1).setInputFiles({
        name: "teacher-explanations.hwp",
        mimeType: "application/x-hwp",
        buffer: Buffer.from("HWP explanation fixture"),
      });
      await expect(modal.getByText(/해설 파일을 따로 올릴 때/)).toBeVisible();
      await expect(modal.getByRole("button", { name: "업로드 및 문항 분석" })).toBeDisabled();
      console.log("  Single-entry modes and fail-closed paired validation visible");

      // Take screenshot of modal
      await page.screenshot({ path: "e2e/screenshots/exam-pdf-upload-modal.png" });

      // Close modal
      const closeBtn = modal.locator("button").filter({ hasText: /닫기/ }).first();
      if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeBtn.click();
        await expect(modal).toBeHidden({ timeout: 5000 });
    }
  });

  // ══════════════════════════════════════════════════════
  // 6. UI: Upload PDF through modal and verify progress
  // ══════════════════════════════════════════════════════
  test("6. Upload PDF through modal with progress display", async () => {
    test.skip(!lectureId || !sessionId, "No session context");

    // Find and click upload button
    const uploadBtn = page.locator("button").filter({ hasText: /시험지.*PDF|시험지 업로드/ }).first();
    await expect(uploadBtn).toBeVisible({ timeout: 10000 });
    await uploadBtn.click();

    // Verify modal opened
    const modal = pdfUploadModal(page);
    const modalHeader = modal.locator(".modal-header").filter({ hasText: "시험 자료 올리기" }).first();
    await expect(modalHeader).toBeVisible({ timeout: 5000 });

    // Upload a file via input[type=file]
    const fileInput = modal.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached({ timeout: 3000 });

    const pdfContent = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF",
    );

    await fileInput.setInputFiles({
      name: "e2e-test-exam.pdf",
      mimeType: "application/pdf",
      buffer: pdfContent,
    });

    // Click "업로드" button in modal footer
    const submitBtn = modal.locator("button").filter({ hasText: /업로드/ }).first();
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
    await submitBtn.click();

    // Verify progress display: upload, matching, done, or failed.
    const uploadingText = modal.getByText("시험지 업로드 중…").first();
    const processingText = modal.getByText("문항·해설 맞춤 처리 중…").first();
    const doneText = modal.getByText("문항 분할 완료").first();
    const failedText = modal.getByText("처리 실패").first();

    // Wait for either progress or result
    await expect(uploadingText.or(processingText).or(doneText).or(failedText)).toBeVisible({ timeout: 15000 });

    if (await doneText.isVisible({ timeout: 10000 }).catch(() => false)) {
      console.log("  Upload completed successfully");

      // Verify success detail
      const successMsg = modal.getByText(/인식된 문항 수|문항 목록에서 결과/).first();
      const msgVisible = await successMsg.isVisible({ timeout: 3000 }).catch(() => false);
      if (msgVisible) console.log("  Success message displayed");

      // Take success screenshot
      await page.screenshot({ path: "e2e/screenshots/exam-pdf-upload-done.png" });

      // Close modal
      const confirmBtn = modal.locator("button").filter({ hasText: /확인/ }).first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
        await expect(modal).toBeHidden({ timeout: 5000 });
      }
    } else if (await failedText.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Upload failed - could be due to template not being editable
      const errorEl = modal.locator("[class*='error'], .text-\\[var\\(--color-error\\)\\]").first();
      const errorText = await errorEl.textContent().catch(() => "unknown error");
      console.log(`  Upload failed: ${errorText}`);
      await page.screenshot({ path: "e2e/screenshots/exam-pdf-upload-failed.png" });
    }
  });

  // ══════════════════════════════════════════════════════
  // 7. Verify asset via API
  // ══════════════════════════════════════════════════════
  test("7. Verify uploaded asset via API", async () => {
    test.skip(!regularExamId, "No regular exam");

    const resp = await apiCall(page, "GET", `/exams/${regularExamId}/assets/`);
    console.log(`  GET /exams/${regularExamId}/assets/ → ${resp.status}`);

    expect(resp.status).toBe(200);
    const assets = listOf<ExamAsset>(resp.body, isExamAsset);
    console.log(`  Assets count: ${assets.length}`);

    const sourceAsset = assets.find((a) => a.asset_type === "problem_source");
    expect(sourceAsset?.file_key).toBeTruthy();
    console.log(`  problem_source found: ${sourceAsset?.file_key}`);
  });

  // ══════════════════════════════════════════════════════
  // 8. Cleanup
  // ══════════════════════════════════════════════════════
  test("8. Cleanup test data", async () => {
    await cleanupTestData();
  });
});
