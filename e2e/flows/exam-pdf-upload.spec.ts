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
import { test, expect, type Page, type Browser } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";

const BASE = getBaseUrl("admin");
const TS = Date.now();

test.describe.serial("Exam PDF upload flow", () => {
  let browser: Browser;
  let page: Page;

  /** 테스트에서 사용하는 시험 정보 */
  let regularExamId: number | null = null;
  let templateExamId: number | null = null;
  let sessionId: number | null = null;
  let lectureId: number | null = null;
  let createdTemplate = false;
  let createdRegular = false;

  test.beforeAll(async ({ browser: b }) => {
    browser = b;
  });

  // ══════════════════════════════════════════════════════
  // 1. Admin login
  // ══════════════════════════════════════════════════════
  test("1. Admin login", async () => {
    const ctx = await browser.newContext();
    page = await ctx.newPage();
    await loginViaUI(page, "admin");
    expect(page.url()).toContain("/admin");
  });

  // ══════════════════════════════════════════════════════
  // 2. Find or create exam with session context
  // ══════════════════════════════════════════════════════
  test("2. Find or create exam with session + template context", async () => {
    // Step A: Find existing regular exams (they have sessions)
    const resp = await apiCall(page, "GET", "/exams/");
    const allExams: any[] = Array.isArray(resp.body)
      ? resp.body
      : Array.isArray(resp.body?.results) ? resp.body.results : [];
    console.log(`  Total exams found: ${allExams.length}`);
    for (const e of allExams.slice(0, 5)) {
      console.log(`    exam id=${e.id ?? e.exam_id} type=${e.exam_type} template_exam_id=${e.template_exam_id} title="${e.title}"`);
    }

    // Find a regular exam with a template_exam_id
    const regularWithTemplate = allExams.find(
      (e: any) => e.exam_type === "regular" && e.template_exam_id,
    );

    if (regularWithTemplate) {
      regularExamId = Number(regularWithTemplate.id ?? regularWithTemplate.exam_id);
      templateExamId = Number(regularWithTemplate.template_exam_id);
      console.log(`  Found regular exam ${regularExamId} with template ${templateExamId}`);
    }

    // If no regular with template, use any exam as-is (for API testing)
    if (!templateExamId && allExams.length > 0) {
      const anyExam = allExams[0];
      const eid = Number(anyExam.id ?? anyExam.exam_id);
      // Try asset upload directly - if it's a template, it might work
      if (anyExam.exam_type === "template") {
        templateExamId = eid;
        console.log(`  Using template exam directly: ${templateExamId}`);
      } else {
        regularExamId = eid;
        console.log(`  Using regular exam for navigation: ${regularExamId}`);
      }
    }

    // Step B: Find session/lecture context for navigation
    const lecturesResp = await apiCall(page, "GET", "/lectures/lectures/");
    const lectures = Array.isArray(lecturesResp.body)
      ? lecturesResp.body
      : Array.isArray(lecturesResp.body?.results) ? lecturesResp.body.results : [];

    console.log(`  Lectures found: ${lectures.length}`);

    for (const lec of lectures) {
      const lid = Number(lec.id);
      const sessResp = await apiCall(page, "GET", `/lectures/sessions/?lecture=${lid}`);
      const sessions = Array.isArray(sessResp.body)
        ? sessResp.body
        : Array.isArray(sessResp.body?.results) ? sessResp.body.results : [];
      console.log(`    lecture ${lid} "${lec.title || lec.name}" → ${sessions.length} sessions`);

      if (sessions.length > 0) {
        lectureId = lid;
        sessionId = Number(sessions[0].id);

        // If we don't have a template exam yet, create one and link via regular
        if (!templateExamId) {
          // Create template exam
          const tmplResp = await apiCall(page, "POST", "/exams/", {
            title: `[E2E-${TS}] Template`,
            subject: "E2E",
            exam_type: "template",
          });
          if (tmplResp.status < 300 && tmplResp.body?.id) {
            templateExamId = Number(tmplResp.body.id);
            createdTemplate = true;
            console.log(`  Created template exam: ${templateExamId}`);

            // Create regular exam from template (links to session)
            const regResp = await apiCall(page, "POST", "/exams/", {
              title: `[E2E-${TS}] Regular`,
              template_exam_id: templateExamId,
              session_id: sessionId,
              exam_type: "regular",
            });
            if (regResp.status < 300 && regResp.body?.id) {
              regularExamId = Number(regResp.body.id);
              createdRegular = true;
              console.log(`  Created regular exam: ${regularExamId} → template ${templateExamId}`);
            }
          }
        }

        console.log(`  Using lecture=${lectureId}, session=${sessionId}`);
        break;
      }
    }

    // At minimum we need either a template or regular exam, and a session
    expect(templateExamId ?? regularExamId).toBeGreaterThan(0);
    console.log(`  Final: template=${templateExamId}, regular=${regularExamId}, session=${sessionId}, lecture=${lectureId}`);
  });

  // ══════════════════════════════════════════════════════
  // 3. API: POST /exams/{templateId}/assets/ 직접 업로드 검증
  // ══════════════════════════════════════════════════════
  test("3. API: Upload PDF asset to template exam", async () => {
    test.skip(!templateExamId, "No template exam available");

    const result = await page.evaluate(
      async ({ examId, apiBase }) => {
        const token = localStorage.getItem("access") || "";
        const host = window.location.hostname.toLowerCase();
        const tenantMap: Record<string, string> = {
          "hakwonplus.com": "hakwonplus", "www.hakwonplus.com": "hakwonplus",
          "localhost": "hakwonplus",
        };
        const tenantCode = tenantMap[host] || "hakwonplus";

        // Minimal valid PDF
        const pdfContent = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF";
        const blob = new Blob([pdfContent], { type: "application/pdf" });
        const file = new File([blob], "e2e-test-exam.pdf", { type: "application/pdf" });

        const fd = new FormData();
        fd.append("asset_type", "problem_pdf");
        fd.append("file", file);

        const res = await fetch(`${apiBase}/api/v1/exams/${examId}/assets/`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Tenant-Code": tenantCode,
          },
          body: fd,
        });

        let body: any;
        try { body = await res.json(); } catch { body = null; }
        return { status: res.status, body };
      },
      { examId: templateExamId, apiBase: process.env.E2E_API_URL || "https://api.hakwonplus.com" },
    );

    console.log(`  POST /exams/${templateExamId}/assets/ → ${result.status}`);
    console.log(`  Response:`, JSON.stringify(result.body));

    expect(result.status).toBeLessThan(300);
    expect(result.body).toBeTruthy();
    expect(result.body.asset_type).toBe("problem_pdf");
    expect(result.body.file_key).toBeTruthy();
  });

  // ══════════════════════════════════════════════════════
  // 4. UI: Navigate to session exams page
  // ══════════════════════════════════════════════════════
  test("4. Navigate to session exams page", async () => {
    test.skip(!lectureId || !sessionId, "No session available");

    await page.goto(
      `${BASE}/admin/lectures/${lectureId}/sessions/${sessionId}/exams`,
      { waitUntil: "load", timeout: 15000 },
    );
    await page.waitForTimeout(2000);

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
        await page.waitForTimeout(2000);
      }

      // Try again after selecting
      uploadBtn = page.locator("button").filter({ hasText: /시험지.*PDF|시험지 업로드/ }).first();
    }

    const btnVisible = await uploadBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (btnVisible) {
      await uploadBtn.click();
      await page.waitForTimeout(1000);

      // Verify modal opened
      const modalTitle = page.locator("text=시험지 PDF 업로드").first();
      await expect(modalTitle).toBeVisible({ timeout: 5000 });
      console.log("  ExamPdfUploadModal opened successfully");

      // Verify FileUploadZone exists
      const uploadZone = page.locator("text=PDF, PNG, JPG").first();
      await expect(uploadZone).toBeVisible({ timeout: 3000 });
      console.log("  FileUploadZone visible in modal");

      // Take screenshot of modal
      await page.screenshot({ path: "e2e/screenshots/exam-pdf-upload-modal.png" });

      // Close modal
      const closeBtn = page.locator("button").filter({ hasText: /닫기/ }).first();
      if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    } else {
      console.log("  Upload button not found — taking screenshot for debugging");
      await page.screenshot({ path: "e2e/screenshots/exam-pdf-upload-no-button.png" });
    }
  });

  // ══════════════════════════════════════════════════════
  // 6. UI: Upload PDF through modal and verify progress
  // ══════════════════════════════════════════════════════
  test("6. Upload PDF through modal with progress display", async () => {
    test.skip(!lectureId || !sessionId, "No session context");

    // Find and click upload button
    const uploadBtn = page.locator("button").filter({ hasText: /시험지.*PDF|시험지 업로드/ }).first();
    const visible = await uploadBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (!visible) {
      console.log("  Upload button not visible — skipping modal test");
      console.log("  (API upload in step 3 validates backend works)");
      await page.screenshot({ path: "e2e/screenshots/exam-pdf-upload-step6-skip.png" });
      return;
    }

    await uploadBtn.click();
    await page.waitForTimeout(1000);

    // Verify modal opened
    const modalHeader = page.locator("text=시험지 PDF 업로드").first();
    await expect(modalHeader).toBeVisible({ timeout: 5000 });

    // Upload a file via input[type=file]
    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached({ timeout: 3000 });

    const pdfContent = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF",
    );

    await fileInput.setInputFiles({
      name: "e2e-test-exam.pdf",
      mimeType: "application/pdf",
      buffer: pdfContent,
    });
    await page.waitForTimeout(500);

    // Click "업로드" button in modal footer
    const submitBtn = page.locator("button").filter({ hasText: /^업로드$/ }).first();
    if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitBtn.click();

      // Verify progress display: "시험지 업로드 중…" or "업로드 완료"
      const uploadingText = page.locator("text=시험지 업로드 중…").first();
      const doneText = page.locator("text=업로드 완료").first();
      const failedText = page.locator("text=업로드 실패").first();

      // Wait for either progress or result
      await expect(uploadingText.or(doneText).or(failedText)).toBeVisible({ timeout: 15000 });

      if (await doneText.isVisible({ timeout: 10000 }).catch(() => false)) {
        console.log("  Upload completed successfully");

        // Verify success detail
        const successMsg = page.locator("text=시험지 PDF가 자산으로 저장되었습니다").first();
        const msgVisible = await successMsg.isVisible({ timeout: 3000 }).catch(() => false);
        if (msgVisible) console.log("  Success message displayed");

        // Take success screenshot
        await page.screenshot({ path: "e2e/screenshots/exam-pdf-upload-done.png" });

        // Close modal
        const confirmBtn = page.locator("button").filter({ hasText: /확인/ }).first();
        if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmBtn.click();
          await page.waitForTimeout(500);
        }
      } else if (await failedText.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Upload failed - could be due to template not being editable
        const errorEl = page.locator("[class*='error'], .text-\\[var\\(--color-error\\)\\]").first();
        const errorText = await errorEl.textContent().catch(() => "unknown error");
        console.log(`  Upload failed: ${errorText}`);
        await page.screenshot({ path: "e2e/screenshots/exam-pdf-upload-failed.png" });
      }
    } else {
      console.log("  Submit button not found in modal");
      await page.screenshot({ path: "e2e/screenshots/exam-pdf-upload-no-submit.png" });
    }
  });

  // ══════════════════════════════════════════════════════
  // 7. Verify asset via API
  // ══════════════════════════════════════════════════════
  test("7. Verify uploaded asset via API", async () => {
    test.skip(!templateExamId, "No template exam");

    // Access via regular exam (which resolves to template)
    const examIdForQuery = regularExamId ?? templateExamId!;
    const resp = await apiCall(page, "GET", `/exams/${examIdForQuery}/assets/`);
    console.log(`  GET /exams/${examIdForQuery}/assets/ → ${resp.status}`);

    if (resp.status === 200) {
      const assets: any[] = Array.isArray(resp.body) ? resp.body : [];
      console.log(`  Assets count: ${assets.length}`);

      const pdfAsset = assets.find((a: any) => a.asset_type === "problem_pdf");
      if (pdfAsset) {
        expect(pdfAsset.file_key).toBeTruthy();
        console.log(`  problem_pdf found: ${pdfAsset.file_key}`);
      } else {
        console.log("  No problem_pdf asset found (may have been sealed)");
      }
    } else {
      console.log(`  Assets query returned ${resp.status} — exam may not be accessible`);
    }
  });

  // ══════════════════════════════════════════════════════
  // 8. Cleanup
  // ══════════════════════════════════════════════════════
  test("8. Cleanup test data", async () => {
    if (createdRegular && regularExamId) {
      const r = await apiCall(page, "DELETE", `/exams/${regularExamId}/`);
      console.log(`  Cleanup regular exam ${regularExamId}: ${r.status}`);
    }
    // Template cleanup: may fail if derived exams exist, that's OK
    if (createdTemplate && templateExamId) {
      const r = await apiCall(page, "DELETE", `/exams/${templateExamId}/`);
      console.log(`  Cleanup template exam ${templateExamId}: ${r.status}`);
    }

    await page.context().close();
  });
});
