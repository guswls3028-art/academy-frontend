/**
 * E2E: 스캔본 PDF OCR 세그멘테이션 검증
 * commit 6f29d311 — 페이지당 4~6개 문항 분할 개선
 *
 * 대상: 2025-1-m 고1 숙명여고 통합과학.pdf (8페이지 스캔본)
 * 기대: 25개 이상 문항 카드 (이전: 7~8개 페이지 단위)
 * Tenant 1 (hakwonplus), 운영 서버
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getApiBaseUrl } from "../helpers/auth";
import path from "path";

const API = getApiBaseUrl();
const TAG = `[E2E-${Date.now()}]`;
const SCAN_PDF = "C:/academy/매치업테스트자료/extracted/2025-1-m 고1 숙명여고 통합과학.pdf";

let uploadedDocId: number | null = null;
let uploadedDocToken: string | null = null;

test.describe("OCR 세그멘테이션 개선 검증 (commit 6f29d311)", () => {
  test("스캔본 PDF 업로드 → 25개 이상 문항 분할 확인", async ({ page }) => {
    test.setTimeout(300_000); // 5분 (OCR 호출 포함)

    // ── 1. 로그인 ──
    await loginViaUI(page, "admin");
    await page.screenshot({
      path: "e2e/screenshots/ocr-seg-01-login.png",
      fullPage: true,
    });

    // ── 2. 스토리지 > 매치업 페이지 이동 (사이드바 클릭) ──
    // 사이드바에서 "스토리지" 메뉴 찾기
    const storageMenu = page.locator("text=스토리지").first();
    if (await storageMenu.isVisible({ timeout: 5000 }).catch(() => false)) {
      await storageMenu.click();
      await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});
    }

    // "매치업" 서브메뉴 클릭
    const matchupMenu = page.locator("text=매치업").first();
    if (await matchupMenu.isVisible({ timeout: 5000 }).catch(() => false)) {
      await matchupMenu.click();
      await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});
    } else {
      // 사이드바에서 못 찾으면 직접 이동 (fallback)
      await page.goto("https://hakwonplus.com/admin/storage/matchup", {
        waitUntil: "load",
        timeout: 20000,
      });
    }

    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await page.screenshot({
      path: "e2e/screenshots/ocr-seg-02-matchup-page.png",
      fullPage: true,
    });
    console.log(`[NAV] Current URL: ${page.url()}`);

    // ── 3. 문서 업로드 버튼 클릭 ──
    // "문서 업로드" 텍스트가 있는 버튼 or Plus 아이콘 버튼
    const uploadBtnByText = page.locator("button").filter({ hasText: "문서 업로드" }).first();
    const uploadBtnByIcon = page.locator('button[title="업로드"]').first();

    if (await uploadBtnByText.isVisible({ timeout: 3000 }).catch(() => false)) {
      await uploadBtnByText.click();
    } else {
      // Plus 아이콘 버튼 (문서 목록 헤더의 + 버튼)
      const plusBtn = page.locator("button svg.lucide-plus").locator("..");
      if (await plusBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await plusBtn.click();
      } else {
        // 빈 상태의 업로드 버튼
        const emptyUploadBtn = page.locator("button").filter({ hasText: /업로드/ }).first();
        await emptyUploadBtn.click();
      }
    }

    await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});
    await page.screenshot({
      path: "e2e/screenshots/ocr-seg-03-upload-modal.png",
      fullPage: true,
    });

    // ── 4. 파일 선택 ──
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached({ timeout: 5000 });
    await fileInput.setInputFiles(SCAN_PDF);
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

    // 제목 자동 채워지는지 확인
    const titleInput = page.locator('input[placeholder="문서 제목"]');
    await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});

    // 제목을 E2E 태그로 변경
    const docTitle = `${TAG} 숙명여고 통합과학 스캔본`;
    await titleInput.fill(docTitle);

    // 과목 입력
    const subjectInput = page.locator('input[placeholder="예: 수학"]');
    if (await subjectInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await subjectInput.fill("통합과학");
    }

    // 학년 입력
    const gradeInput = page.locator('input[placeholder="예: 고1"]');
    if (await gradeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gradeInput.fill("고1");
    }

    await page.screenshot({
      path: "e2e/screenshots/ocr-seg-04-upload-filled.png",
      fullPage: true,
    });

    // ── 5. 업로드 실행 ──
    const submitBtn = page.locator("button").filter({ hasText: /^업로드$/ }).last();
    await submitBtn.click();
    console.log(`[UPLOAD] Clicked upload button at ${new Date().toISOString()}`);

    // 모달 닫힘 확인
    await expect(
      page.locator('input[type="file"]')
    ).not.toBeAttached({ timeout: 10000 });

    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await page.screenshot({
      path: "e2e/screenshots/ocr-seg-05-after-upload.png",
      fullPage: true,
    });

    // ── 6. 문서 목록에 나타났는지 확인 ──
    const docItem = page.locator(`text=${docTitle}`).first();
    await expect(docItem).toBeVisible({ timeout: 15000 });
    console.log(`[LIST] Document visible: ${docTitle}`);

    // API로 문서 ID 확인
    const accessToken = await page.evaluate(() => localStorage.getItem("access"));
    uploadedDocToken = accessToken;

    const docsResp = await page.request.get(`${API}/api/v1/matchup/documents/`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Tenant-Code": "hakwonplus",
      },
    });
    const docs = await docsResp.json() as Array<{ id: number; title: string; status: string; problem_count: number }>;
    const uploadedDoc = docs.find((d) => d.title === docTitle);
    if (uploadedDoc) {
      uploadedDocId = uploadedDoc.id;
      console.log(`[API] Document ID: ${uploadedDocId}, status: ${uploadedDoc.status}`);
    }

    // ── 7. 문서 클릭하여 선택 ──
    await docItem.click();
    await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});

    // ── 8. AI 처리 완료 대기 (최대 4분, 폴링) ──
    console.log(`[POLL] Waiting for AI processing to complete...`);
    let processingDone = false;
    let finalProblemCount = 0;
    const pollStart = Date.now();
    const maxWaitMs = 240_000; // 4분

    while (Date.now() - pollStart < maxWaitMs) {
      // 의도적 폴링 주기 (5초) — OCR/segmentation 진행 상태 확인.
      // eslint-disable-next-line no-restricted-syntax
      await page.waitForTimeout(5000);

      // 진행률 표시 로그
      const progressText = page.locator("text=/segmentation|ocr|embedding|upload_images|done/i").first();
      if (await progressText.isVisible({ timeout: 1000 }).catch(() => false)) {
        const txt = await progressText.textContent().catch(() => "");
        console.log(`[PROGRESS] ${txt} (${Math.round((Date.now() - pollStart) / 1000)}s)`);
      }

      // API 폴링으로 상태 확인
      if (uploadedDocId) {
        const statusResp = await page.request.get(`${API}/api/v1/matchup/documents/`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Tenant-Code": "hakwonplus",
          },
        });
        const statusDocs = await statusResp.json() as Array<{ id: number; status: string; problem_count: number; error_message: string }>;
        const current = statusDocs.find((d) => d.id === uploadedDocId);
        if (current) {
          console.log(`[STATUS] status=${current.status}, problem_count=${current.problem_count} (${Math.round((Date.now() - pollStart) / 1000)}s)`);
          if (current.status === "done") {
            finalProblemCount = current.problem_count;
            processingDone = true;
            break;
          }
          if (current.status === "failed") {
            console.error(`[FAIL] error_message: ${current.error_message}`);
            await page.screenshot({
              path: "e2e/screenshots/ocr-seg-FAIL-processing.png",
              fullPage: true,
            });
            break;
          }
        }
      }

      // DOM 폴링은 참고용만 — API status=done이 확정 조건
      const doneCountText = page.locator("text=/\\d+문제/").first();
      if (await doneCountText.isVisible({ timeout: 1000 }).catch(() => false)) {
        const txt = await doneCountText.textContent().catch(() => "");
        const match = txt?.match(/(\d+)문제/);
        if (match) {
          const domCount = parseInt(match[1], 10);
          console.log(`[DOM-INTERIM] Detected ${domCount}문제 (may be in-progress — waiting for API done)`);
          // DOM만으로는 조기 종료 안 함. API status=done 확인 필요.
        }
      }
    }

    await page.screenshot({
      path: "e2e/screenshots/ocr-seg-06-processing-result.png",
      fullPage: true,
    });

    // ── 9. 완료 상태 검증 ──
    expect(processingDone, "AI 처리가 4분 내에 완료되어야 합니다").toBe(true);

    console.log(`[RESULT] Final problem_count: ${finalProblemCount}`);

    // 핵심 검증: 25개 이상 문항
    expect(
      finalProblemCount,
      `문항 수 ${finalProblemCount}개 — 25개 이상이어야 합니다 (OCR 세그멘테이션 개선 검증)`
    ).toBeGreaterThanOrEqual(25);

    // 페이지 새로고침하여 DOM 갱신 후 "N문제" 텍스트 확인
    await page.reload({ waitUntil: "load", timeout: 15000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

    // 문서 목록에서 해당 문서 다시 클릭
    const docItemAfterReload = page.locator(`text=${docTitle}`).first();
    if (await docItemAfterReload.isVisible({ timeout: 5000 }).catch(() => false)) {
      await docItemAfterReload.click();
      await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});
    }

    // DOM에서 "N문제" 텍스트 확인
    const problemCountDom = page.locator(`text=${finalProblemCount}문제`).first();
    await expect(problemCountDom).toBeVisible({ timeout: 10000 });
    console.log(`[DOM-VERIFY] "${finalProblemCount}문제" text visible`);

    // ── 10. 문제 그리드 확인 ──
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await page.screenshot({
      path: "e2e/screenshots/ocr-seg-07-problem-grid.png",
      fullPage: true,
    });

    // 문제 카드 수 확인 (Q1, Q2, ... 형태)
    const problemCards = page.locator("text=/^Q\\d+$/");
    const cardCount = await problemCards.count();
    console.log(`[GRID] Problem cards visible in DOM: ${cardCount}`);

    if (cardCount > 0) {
      expect(cardCount).toBeGreaterThanOrEqual(25);

      // ── 11. 첫 번째 문제 카드 클릭 → 상세 이미지 확인 ──
      await problemCards.first().click();
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

      await page.screenshot({
        path: "e2e/screenshots/ocr-seg-08-problem-detail.png",
        fullPage: true,
      });

      // 크롭 이미지가 존재하는지 확인 (img 태그)
      const cropImg = page.locator("img").filter({ hasNot: page.locator("svg") }).first();
      if (await cropImg.isVisible({ timeout: 5000 }).catch(() => false)) {
        const imgSrc = await cropImg.getAttribute("src");
        console.log(`[IMAGE] Crop image src: ${imgSrc?.substring(0, 80)}...`);
        expect(imgSrc).toBeTruthy();
      }
    }

    // ── 12. API 검증 — problem_count 필드 ──
    if (uploadedDocId) {
      const problemsResp = await page.request.get(
        `${API}/api/v1/matchup/problems/?document_id=${uploadedDocId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Tenant-Code": "hakwonplus",
          },
        },
      );
      expect(problemsResp.ok()).toBe(true);
      const problems = await problemsResp.json() as Array<{ id: number; number: number; image_key: string }>;
      console.log(`[API] /matchup/problems/ returned ${problems.length} problems`);
      console.log(`[API] Problem numbers: ${problems.map((p) => p.number).join(", ")}`);
      expect(problems.length).toBeGreaterThanOrEqual(25);

      // 이미지 키 확인 (문항 단위 크롭)
      const firstProblem = problems[0];
      expect(firstProblem.image_key).toBeTruthy();
      console.log(`[API] First problem image_key: ${firstProblem.image_key}`);
    }

    await page.screenshot({
      path: "e2e/screenshots/ocr-seg-09-final.png",
      fullPage: true,
    });
    console.log("[PASS] OCR segmentation E2E verification complete");
  });

  test.afterAll(async ({ request }) => {
    // Cleanup — 업로드된 테스트 문서 삭제
    if (!uploadedDocId) return;

    // 토큰 재획득 필요
    const tokenResp = await request.post(`${API}/api/v1/token/`, {
      data: { username: "admin97", password: "koreaseoul97", tenant_code: "hakwonplus" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    });
    if (tokenResp.ok()) {
      const tokens = await tokenResp.json() as { access: string };
      const deleteResp = await request.delete(
        `${API}/api/v1/matchup/documents/${uploadedDocId}/`,
        {
          headers: {
            Authorization: `Bearer ${tokens.access}`,
            "X-Tenant-Code": "hakwonplus",
          },
          timeout: 30000,
        },
      );
      console.log(`[CLEANUP] Deleted document ${uploadedDocId}: ${deleteResp.status()}`);
    }
  });
});
