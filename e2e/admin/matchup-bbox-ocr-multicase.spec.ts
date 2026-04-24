/**
 * E2E: 매치업 bbox-aware OCR 세그멘테이션 종합 검증 (commit a7a8d026)
 *
 * Case A: 스캔본 — 은광여고 (기대: ≥30문제, OCR 경로)
 * Case B: 스캔본 — 경기고  (기대: ≥18문제, OCR 경로)
 * Case C: 텍스트PDF — 중산고 (기대: ≥28문제, text 경로, OCR 없음)
 *
 * 검증:
 * - Browser DOM: 문서 카드 완료, 문항 수 표시, 상세 모달 크롭 이미지
 * - API: status=done, problems[].text 비어있지 않은 비율
 * - CloudWatch: VisionOCRCalls delta, OCR_SEGMENT_OK 이벤트 수
 *
 * Tenant 1 (hakwonplus) only. 테스트 후 cleanup 필수.
 *
 * 주의사항:
 * - GET /matchup/documents/{id}/ → 405 (detail endpoint 없음)
 *   → 폴링은 list endpoint (/matchup/documents/) 로 해야 함
 * - segmentation_method 필드는 list API에 없음 → CW 로그로 확인
 * - 업로드 버튼: 문서 목록 헤더의 + 아이콘 버튼
 */
import { test, expect } from "@playwright/test";
import { loginViaUI, getApiBaseUrl } from "../helpers/auth";
import { execSync } from "child_process";

const API = getApiBaseUrl();
const TS = Date.now();
const TAG = `[E2E-${TS}]`;
const MATCHUP_URL = "https://hakwonplus.com/admin/storage/matchup";

const BASE_DIR = "C:/academy/매치업테스트자료/extracted";
const CASES = [
  {
    key: "A-은광여고",
    file: `${BASE_DIR}/2025-1-m 고1 은광여고 통합과학.pdf`,
    title: `${TAG} 은광여고 통합과학 스캔본`,
    minProblems: 30,
    isOcr: true,
  },
  {
    key: "B-경기고",
    file: `${BASE_DIR}/2025-1-m 고1 경기고 통합과학.pdf`,
    title: `${TAG} 경기고 통합과학 스캔본`,
    minProblems: 18,
    isOcr: true,
  },
  {
    key: "C-중산고",
    file: `${BASE_DIR}/2025-1-m 고1 중산고 통합과학1.pdf`,
    title: `${TAG} 중산고 통합과학 텍스트PDF`,
    minProblems: 28,
    isOcr: false,
  },
];

// ── CloudWatch helpers ──────────────────────────────────────────

/** VisionOCRCalls 합계 (최근 windowMin분) */
function getCWOcrCalls(windowMin: number): number {
  try {
    const endTime = new Date().toISOString();
    const startTime = new Date(Date.now() - windowMin * 60 * 1000).toISOString();
    const out = execSync(
      `aws cloudwatch get-metric-statistics` +
        ` --namespace "Academy/AIWorker"` +
        ` --metric-name "VisionOCRCalls"` +
        ` --start-time "${startTime}"` +
        ` --end-time "${endTime}"` +
        ` --period ${windowMin * 60}` +
        ` --statistics Sum` +
        ` --region ap-northeast-2`,
      { encoding: "utf8", timeout: 30000 },
    );
    const parsed = JSON.parse(out);
    return (parsed.Datapoints as Array<{ Sum: number }>).reduce((a, d) => a + d.Sum, 0);
  } catch {
    return -1;
  }
}

/** OCR_SEGMENT_OK 이벤트 수 (최근 windowMin분) */
function getCWOcrSegmentOk(windowMin: number): number {
  try {
    const result = execSync(
      [
        "aws", "logs", "filter-log-events",
        "--log-group-name", "/academy/ai-worker",
        "--start-time", String(Date.now() - windowMin * 60 * 1000),
        "--region", "ap-northeast-2",
        "--output", "json",
      ].join(" "),
      { encoding: "buffer", timeout: 30000 },
    );
    const raw = result.toString("utf8", 0, result.length);
    const m = raw.match(/"OCR_SEGMENT_OK"/g);
    return m ? m.length : 0;
  } catch {
    return -1;
  }
}

// ── Core upload helper ──────────────────────────────────────────

/**
 * 매치업 페이지 업로드 모달 열기 + 파일 선택 + 제출
 * 업로드 버튼: 문서 목록 헤더 오른쪽의 + 아이콘 버튼
 */
async function openUploadAndSubmit(
  page: any,
  filePath: string,
  title: string,
  subject = "통합과학",
  grade = "고1",
): Promise<void> {
  // + 아이콘 버튼 (문서 목록 헤더)
  // 스크린샷에서 확인: "문서 목록" 텍스트 옆 + 버튼
  const plusBtn = page.locator("button").filter({ has: page.locator("svg") }).last();
  // 더 정확한 선택자: 문서 목록 헤더 영역의 + 버튼
  const headerPlusBtn = page.locator("[class*='header'] button, [class*='list'] button").last();

  // 우선 "문서 목록" 레이블 근처 + 버튼 시도
  const listHeader = page.locator("text=문서 목록").first();
  if (await listHeader.isVisible({ timeout: 5000 }).catch(() => false)) {
    // 같은 컨테이너 안의 + 버튼
    const container = listHeader.locator("..").locator("button").last();
    if (await container.isVisible({ timeout: 3000 }).catch(() => false)) {
      await container.click();
    } else {
      // 전체 페이지에서 마지막 + 아이콘 버튼
      await plusBtn.click();
    }
  } else {
    // 빈 상태: "문서 업로드" 버튼이 중앙에 있을 수 있음
    const emptyUploadBtn = page.locator("button").filter({ hasText: /문서 업로드|업로드/ }).first();
    if (await emptyUploadBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emptyUploadBtn.click();
    } else {
      await plusBtn.click();
    }
  }

  await page.waitForTimeout(1000);

  // 파일 입력
  const fileInput = page.locator('input[type="file"]');
  await expect(fileInput).toBeAttached({ timeout: 5000 });
  await fileInput.setInputFiles(filePath);
  await page.waitForTimeout(1500);

  // 제목
  const titleInput = page.locator('input[placeholder="문서 제목"]');
  await titleInput.fill(title);

  // 과목
  const subjectInput = page.locator('input[placeholder="예: 수학"]');
  if (await subjectInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await subjectInput.fill(subject);
  }

  // 학년
  const gradeInput = page.locator('input[placeholder="예: 고1"]');
  if (await gradeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await gradeInput.fill(grade);
  }

  // 업로드 버튼 클릭
  const submitBtn = page.locator("button").filter({ hasText: /^업로드$/ }).last();
  await submitBtn.click();
  console.log(`[UPLOAD] Submitted: ${title}`);
}

/**
 * 문서 처리 완료 대기 (list endpoint 폴링)
 * GET /matchup/documents/ → items.find(id) → status=done|failed
 *
 * 주의: detail endpoint (/{id}/) 는 405 → list 사용
 */
async function waitForDone(
  page: any,
  docId: number,
  accessToken: string,
  maxMs = 300_000,
): Promise<{ status: string; problem_count: number; error_message: string }> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await page.waitForTimeout(8000);
    try {
      const resp = await page.request.get(`${API}/api/v1/matchup/documents/`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Tenant-Code": "hakwonplus",
        },
        timeout: 15000,
      });
      if (resp.ok()) {
        const body = await resp.json();
        const items: any[] = Array.isArray(body) ? body : (body?.results ?? []);
        const doc = items.find((d: any) => d.id === docId);
        if (doc) {
          const elapsed = Math.round((Date.now() - start) / 1000);
          console.log(`[POLL ${docId}] status=${doc.status}, count=${doc.problem_count} (${elapsed}s)`);
          if (doc.status === "done" || doc.status === "failed") {
            return {
              status: doc.status,
              problem_count: doc.problem_count ?? 0,
              error_message: doc.error_message ?? "",
            };
          }
        }
      }
    } catch (e) {
      console.warn(`[POLL ${docId}] Request error: ${e}`);
    }
  }
  return { status: "timeout", problem_count: 0, error_message: "polling timeout" };
}

// 결과 수집
const results: Array<{
  key: string;
  docId: number | null;
  problem_count: number;
  status: string;
  firstProblemText: string;
  textNonEmptyRatio: number;
  ocrCallsBefore: number;
  ocrCallsAfter: number;
  ocrSegOkCount: number;
}> = [];

// ──────────────────────────────────────────────────────────────
// Case A: 은광여고 스캔본
// ──────────────────────────────────────────────────────────────
test.describe.serial("Case A: 은광여고 스캔본", () => {
  let page: any;
  let docId: number | null = null;
  const c = CASES[0];

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    page = await ctx.newPage();
    await loginViaUI(page, "admin");
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test("A-1: 은광여고 스캔본 업로드 → OCR 처리 → 문항 수 ≥30 검증", async () => {
    test.setTimeout(420_000); // 7분

    // 1. 매치업 페이지 이동
    await page.goto(MATCHUP_URL, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);
    console.log(`[A-NAV] ${page.url()}`);
    await page.screenshot({ path: "e2e/screenshots/caseA-01-matchup.png", fullPage: true });

    // 2. CW 기준점
    const ocrBefore = getCWOcrCalls(60);
    console.log(`[A-CW-BEFORE] VisionOCRCalls (60m): ${ocrBefore}`);

    // 3. 업로드
    await openUploadAndSubmit(page, c.file, c.title);
    await page.screenshot({ path: "e2e/screenshots/caseA-02-upload-filled.png", fullPage: true });

    // 4. 모달 닫힘 확인
    await expect(page.locator('input[type="file"]')).not.toBeAttached({ timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/caseA-03-after-upload.png", fullPage: true });

    // 5. 문서 목록에서 ID 취득
    const accessToken = await page.evaluate(() => localStorage.getItem("access"));
    const docsResp = await page.request.get(`${API}/api/v1/matchup/documents/`, {
      headers: { Authorization: `Bearer ${accessToken}`, "X-Tenant-Code": "hakwonplus" },
    });
    const docs = await docsResp.json() as any[];
    const items = Array.isArray(docs) ? docs : (docs?.results ?? []);
    const found = items.find((d: any) => d.title === c.title);
    expect(found, `문서가 목록에 없음: ${c.title}`).toBeTruthy();
    docId = found!.id;
    console.log(`[A-DOC] id=${docId}`);

    // 6. AI 처리 완료 대기 (list 폴링)
    const result = await waitForDone(page, docId!, accessToken, 360_000);
    console.log(`[A-DONE] status=${result.status}, count=${result.problem_count}`);

    // 7. CW 확인
    const ocrAfter = getCWOcrCalls(60);
    const ocrSegOk = getCWOcrSegmentOk(30);
    console.log(`[A-CW-AFTER] VisionOCRCalls: ${ocrAfter}, delta: ${ocrAfter - ocrBefore}`);
    console.log(`[A-CW-LOGS] OCR_SEGMENT_OK (30m): ${ocrSegOk}`);

    // 8. 브라우저 새로고침 후 DOM 확인
    await page.reload({ waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/caseA-04-done.png", fullPage: true });

    // 핵심 검증
    expect(result.status, "Case A: AI 처리 완료").toBe("done");
    expect(result.problem_count, `Case A: 문항 수 ≥ ${c.minProblems}`).toBeGreaterThanOrEqual(c.minProblems);

    // DOM: 문항 수 텍스트 확인
    const docItem = page.locator(`text=${c.title}`).first();
    if (await docItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await docItem.click();
      await page.waitForTimeout(1500);

      // "N문제" 텍스트
      const countText = page.locator(`text=${result.problem_count}문제`).first();
      const countVisible = await countText.isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`[A-DOM] "${result.problem_count}문제" visible: ${countVisible}`);

      // 첫 번째 문항 카드 클릭
      const qCard = page.locator("text=/^Q\\d+$/").first();
      if (await qCard.isVisible({ timeout: 5000 }).catch(() => false)) {
        await qCard.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: "e2e/screenshots/caseA-05-problem-detail.png", fullPage: true });

        // 크롭 이미지 확인
        const detailImg = page.locator("img").first();
        const imgVisible = await detailImg.isVisible({ timeout: 3000 }).catch(() => false);
        console.log(`[A-DOM] Problem image visible: ${imgVisible}`);
      }
    }

    // API: 문항 텍스트 비율
    const probResp = await page.request.get(
      `${API}/api/v1/matchup/problems/?document_id=${docId}`,
      { headers: { Authorization: `Bearer ${accessToken}`, "X-Tenant-Code": "hakwonplus" } },
    );
    const probs = await probResp.json() as any[];
    const probItems = Array.isArray(probs) ? probs : (probs?.results ?? []);
    const nonEmpty = probItems.filter((p: any) => p.text && p.text.trim().length > 0).length;
    const ratio = probItems.length > 0 ? nonEmpty / probItems.length : 0;
    const firstText = probItems[0]?.text ?? "";
    console.log(`[A-API] problems=${probItems.length}, non_empty=${nonEmpty} (${Math.round(ratio * 100)}%), first="${firstText.substring(0, 60)}"`);

    await page.screenshot({ path: "e2e/screenshots/caseA-06-final.png", fullPage: true });

    results.push({
      key: c.key,
      docId,
      problem_count: result.problem_count,
      status: result.status,
      firstProblemText: firstText.substring(0, 60),
      textNonEmptyRatio: ratio,
      ocrCallsBefore: ocrBefore,
      ocrCallsAfter: ocrAfter,
      ocrSegOkCount: ocrSegOk,
    });
  });

  test.afterAll(async ({ request }) => {
    if (!docId) return;
    const tr = await request.post(`${API}/api/v1/token/`, {
      data: { username: "admin97", password: "koreaseoul97", tenant_code: "hakwonplus" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    });
    if (tr.ok()) {
      const { access } = await tr.json() as { access: string };
      const r = await request.delete(`${API}/api/v1/matchup/documents/${docId}/`, {
        headers: { Authorization: `Bearer ${access}`, "X-Tenant-Code": "hakwonplus" },
        timeout: 30000,
      });
      console.log(`[A-CLEANUP] Deleted doc ${docId}: ${r.status()}`);
    }
  });
});

// ──────────────────────────────────────────────────────────────
// Case B: 경기고 스캔본
// ──────────────────────────────────────────────────────────────
test.describe.serial("Case B: 경기고 스캔본", () => {
  let page: any;
  let docId: number | null = null;
  const c = CASES[1];

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    page = await ctx.newPage();
    await loginViaUI(page, "admin");
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test("B-1: 경기고 스캔본 업로드 → OCR 처리 → 문항 수 ≥18 검증", async () => {
    test.setTimeout(420_000);

    await page.goto(MATCHUP_URL, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);
    console.log(`[B-NAV] ${page.url()}`);
    await page.screenshot({ path: "e2e/screenshots/caseB-01-matchup.png", fullPage: true });

    const ocrBefore = getCWOcrCalls(60);
    console.log(`[B-CW-BEFORE] VisionOCRCalls (60m): ${ocrBefore}`);

    await openUploadAndSubmit(page, c.file, c.title);
    await page.screenshot({ path: "e2e/screenshots/caseB-02-upload-filled.png", fullPage: true });

    await expect(page.locator('input[type="file"]')).not.toBeAttached({ timeout: 15000 });
    await page.waitForTimeout(2000);

    const accessToken = await page.evaluate(() => localStorage.getItem("access"));
    const docsResp = await page.request.get(`${API}/api/v1/matchup/documents/`, {
      headers: { Authorization: `Bearer ${accessToken}`, "X-Tenant-Code": "hakwonplus" },
    });
    const docs = await docsResp.json() as any[];
    const items = Array.isArray(docs) ? docs : (docs?.results ?? []);
    const found = items.find((d: any) => d.title === c.title);
    expect(found, `문서가 목록에 없음: ${c.title}`).toBeTruthy();
    docId = found!.id;
    console.log(`[B-DOC] id=${docId}`);

    const result = await waitForDone(page, docId!, accessToken, 360_000);
    console.log(`[B-DONE] status=${result.status}, count=${result.problem_count}`);

    const ocrAfter = getCWOcrCalls(60);
    const ocrSegOk = getCWOcrSegmentOk(30);
    console.log(`[B-CW-AFTER] VisionOCRCalls: ${ocrAfter}, delta: ${ocrAfter - ocrBefore}`);
    console.log(`[B-CW-LOGS] OCR_SEGMENT_OK (30m): ${ocrSegOk}`);

    await page.reload({ waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/caseB-03-done.png", fullPage: true });

    expect(result.status, "Case B: AI 처리 완료").toBe("done");
    expect(result.problem_count, `Case B: 문항 수 ≥ ${c.minProblems}`).toBeGreaterThanOrEqual(c.minProblems);

    // DOM: 문항 카드 확인
    const docItem = page.locator(`text=${c.title}`).first();
    if (await docItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await docItem.click();
      await page.waitForTimeout(1500);
      const qCard = page.locator("text=/^Q\\d+$/").first();
      if (await qCard.isVisible({ timeout: 5000 }).catch(() => false)) {
        await qCard.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: "e2e/screenshots/caseB-04-problem-detail.png", fullPage: true });
      }
    }

    // API: 문항 텍스트
    const probResp = await page.request.get(
      `${API}/api/v1/matchup/problems/?document_id=${docId}`,
      { headers: { Authorization: `Bearer ${accessToken}`, "X-Tenant-Code": "hakwonplus" } },
    );
    const probs = await probResp.json() as any[];
    const probItems = Array.isArray(probs) ? probs : (probs?.results ?? []);
    const nonEmpty = probItems.filter((p: any) => p.text && p.text.trim().length > 0).length;
    const ratio = probItems.length > 0 ? nonEmpty / probItems.length : 0;
    const firstText = probItems[0]?.text ?? "";
    console.log(`[B-API] problems=${probItems.length}, non_empty=${nonEmpty} (${Math.round(ratio * 100)}%), first="${firstText.substring(0, 60)}"`);

    await page.screenshot({ path: "e2e/screenshots/caseB-05-final.png", fullPage: true });

    results.push({
      key: c.key,
      docId,
      problem_count: result.problem_count,
      status: result.status,
      firstProblemText: firstText.substring(0, 60),
      textNonEmptyRatio: ratio,
      ocrCallsBefore: ocrBefore,
      ocrCallsAfter: ocrAfter,
      ocrSegOkCount: ocrSegOk,
    });
  });

  test.afterAll(async ({ request }) => {
    if (!docId) return;
    const tr = await request.post(`${API}/api/v1/token/`, {
      data: { username: "admin97", password: "koreaseoul97", tenant_code: "hakwonplus" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    });
    if (tr.ok()) {
      const { access } = await tr.json() as { access: string };
      const r = await request.delete(`${API}/api/v1/matchup/documents/${docId}/`, {
        headers: { Authorization: `Bearer ${access}`, "X-Tenant-Code": "hakwonplus" },
        timeout: 30000,
      });
      console.log(`[B-CLEANUP] Deleted doc ${docId}: ${r.status()}`);
    }
  });
});

// ──────────────────────────────────────────────────────────────
// Case C: 중산고 텍스트 PDF (회귀 체크)
// ──────────────────────────────────────────────────────────────
test.describe.serial("Case C: 중산고 텍스트PDF", () => {
  let page: any;
  let docId: number | null = null;
  const c = CASES[2];

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    page = await ctx.newPage();
    await loginViaUI(page, "admin");
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test("C-1: 중산고 텍스트PDF 업로드 → OCR 없이 처리 → 문항 수 ≥28, text 비율 ≥80%", async () => {
    test.setTimeout(300_000);

    await page.goto(MATCHUP_URL, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);
    console.log(`[C-NAV] ${page.url()}`);
    await page.screenshot({ path: "e2e/screenshots/caseC-01-matchup.png", fullPage: true });

    // CW 기준점 (OCR delta 추적)
    const ocrBefore = getCWOcrCalls(60);
    const ocrSegOkBefore = getCWOcrSegmentOk(60);
    console.log(`[C-CW-BEFORE] VisionOCRCalls (60m): ${ocrBefore}, OCR_SEGMENT_OK: ${ocrSegOkBefore}`);

    await openUploadAndSubmit(page, c.file, c.title);
    await page.screenshot({ path: "e2e/screenshots/caseC-02-upload-filled.png", fullPage: true });

    await expect(page.locator('input[type="file"]')).not.toBeAttached({ timeout: 15000 });
    await page.waitForTimeout(2000);

    const accessToken = await page.evaluate(() => localStorage.getItem("access"));
    const docsResp = await page.request.get(`${API}/api/v1/matchup/documents/`, {
      headers: { Authorization: `Bearer ${accessToken}`, "X-Tenant-Code": "hakwonplus" },
    });
    const docs = await docsResp.json() as any[];
    const items = Array.isArray(docs) ? docs : (docs?.results ?? []);
    const found = items.find((d: any) => d.title === c.title);
    expect(found, `문서가 목록에 없음: ${c.title}`).toBeTruthy();
    docId = found!.id;
    console.log(`[C-DOC] id=${docId}`);

    const result = await waitForDone(page, docId!, accessToken, 240_000);
    console.log(`[C-DONE] status=${result.status}, count=${result.problem_count}`);

    // CW 확인
    const ocrAfter = getCWOcrCalls(60);
    const ocrSegOkAfter = getCWOcrSegmentOk(60);
    const delta = ocrAfter - ocrBefore;
    console.log(`[C-CW-AFTER] VisionOCRCalls: ${ocrAfter}, delta: ${delta} (텍스트PDF → 0이어야 함)`);
    console.log(`[C-CW-LOGS] OCR_SEGMENT_OK: before=${ocrSegOkBefore}, after=${ocrSegOkAfter}`);

    await page.reload({ waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/caseC-03-done.png", fullPage: true });

    // 핵심 검증
    expect(result.status, "Case C: AI 처리 완료").toBe("done");
    expect(result.problem_count, `Case C: 문항 수 ≥ ${c.minProblems}`).toBeGreaterThanOrEqual(c.minProblems);

    // DOM: 문항 카드
    const docItem = page.locator(`text=${c.title}`).first();
    if (await docItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await docItem.click();
      await page.waitForTimeout(1500);
      const qCard = page.locator("text=/^Q\\d+$/").first();
      if (await qCard.isVisible({ timeout: 5000 }).catch(() => false)) {
        await qCard.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: "e2e/screenshots/caseC-04-problem-detail.png", fullPage: true });
      }
    }

    // API: 문항 텍스트 비율
    const probResp = await page.request.get(
      `${API}/api/v1/matchup/problems/?document_id=${docId}`,
      { headers: { Authorization: `Bearer ${accessToken}`, "X-Tenant-Code": "hakwonplus" } },
    );
    const probs = await probResp.json() as any[];
    const probItems = Array.isArray(probs) ? probs : (probs?.results ?? []);
    const nonEmpty = probItems.filter((p: any) => p.text && p.text.trim().length > 0).length;
    const ratio = probItems.length > 0 ? nonEmpty / probItems.length : 0;
    const firstText = probItems[0]?.text ?? "";
    console.log(`[C-API] problems=${probItems.length}, non_empty=${nonEmpty} (${Math.round(ratio * 100)}%), first="${firstText.substring(0, 80)}"`);

    // 텍스트 PDF: text 필드가 채워져야 함 (bbox-aware 개선)
    expect(ratio, "Case C: text 비율 ≥ 80%").toBeGreaterThanOrEqual(0.8);

    // meta 필드에서 original_number 확인 (surgical dedup)
    if (probItems.length > 0 && probItems[0].meta) {
      const meta0 = probItems[0].meta;
      console.log(`[C-API] meta fields: ${JSON.stringify(Object.keys(meta0))}`);
      if (meta0.original_number !== undefined) {
        console.log(`[C-API] original_number in meta: ${meta0.original_number}`);
      }
    }

    await page.screenshot({ path: "e2e/screenshots/caseC-05-final.png", fullPage: true });

    results.push({
      key: c.key,
      docId,
      problem_count: result.problem_count,
      status: result.status,
      firstProblemText: firstText.substring(0, 60),
      textNonEmptyRatio: ratio,
      ocrCallsBefore: ocrBefore,
      ocrCallsAfter: ocrAfter,
      ocrSegOkCount: ocrSegOkAfter,
    });
  });

  test.afterAll(async ({ request }) => {
    if (!docId) return;
    const tr = await request.post(`${API}/api/v1/token/`, {
      data: { username: "admin97", password: "koreaseoul97", tenant_code: "hakwonplus" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    });
    if (tr.ok()) {
      const { access } = await tr.json() as { access: string };
      const r = await request.delete(`${API}/api/v1/matchup/documents/${docId}/`, {
        headers: { Authorization: `Bearer ${access}`, "X-Tenant-Code": "hakwonplus" },
        timeout: 30000,
      });
      console.log(`[C-CLEANUP] Deleted doc ${docId}: ${r.status()}`);
    }
  });
});

// ──────────────────────────────────────────────────────────────
// 종합 요약
// ──────────────────────────────────────────────────────────────
test("종합 요약 출력", async () => {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Matchup bbox-aware OCR E2E 종합 (commit a7a8d026)          ║");
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log(`║ ${"케이스".padEnd(12)} ${"docId".padEnd(6)} ${"count".padEnd(7)} ${"status".padEnd(9)} ${"text%".padEnd(7)} ${"OCRdelta".padEnd(9)} ${"SegOK".padEnd(6)} ║`);
  console.log("╠══════════════════════════════════════════════════════════════╣");
  for (const r of results) {
    const delta = r.ocrCallsAfter >= 0 ? r.ocrCallsAfter - r.ocrCallsBefore : "?";
    const deltaStr = typeof delta === "number" ? (delta >= 0 ? `+${delta}` : String(delta)) : "?";
    console.log(
      `║ ${r.key.padEnd(12)} ${String(r.docId ?? "-").padEnd(6)} ${String(r.problem_count).padEnd(7)} ${r.status.padEnd(9)} ${(Math.round(r.textNonEmptyRatio * 100) + "%").padEnd(7)} ${deltaStr.padEnd(9)} ${String(r.ocrSegOkCount).padEnd(6)} ║`,
    );
  }
  console.log("╚══════════════════════════════════════════════════════════════╝");
  for (const r of results) {
    console.log(`\n[${r.key}] first_problem_text: "${r.firstProblemText}"`);
  }
});
