/** Manual isolated canary, never part of production read-only or mock suites. */
import { readFile } from "node:fs/promises";
import type { Page, Response } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { getApiBaseUrl, getBaseUrl, loginViaUI } from "../helpers/auth";
import { apiCall } from "../helpers/api";
import { matchupRealUseFixtures } from "../helpers/matchupRealUseFixture.mjs";
import { reserveQaDispatch } from "../../scripts/development-qa-operations.mjs";

type Document = { id: number; title: string; status: string; problem_count: number;
  ai_job_id: string; inventory_file_id: number };
type DocumentJob = Pick<Document, "title" | "status" | "problem_count" | "ai_job_id"> & { document_id: number };

type Report = { report: { id: number; summary: string }; entries: Array<{
  selected_problem_ids: number[];
}> };

function isolatedBinding(fixturesSha256: string) {
  const tenant = process.env.E2E_TENANT_CODE || "";
  const frontendSha = process.env.E2E_CANDIDATE_SHA || "";
  const releaseId = process.env.E2E_BACKEND_RELEASE_ID || "";
  const apiDigest = process.env.E2E_BACKEND_API_DIGEST || "";
  const tenantId = Number(process.env.E2E_OMR_R2_TENANT_ID);
  if (process.env.E2E_RELEASE_API_MODE !== "development" || process.env.E2E_STRICT !== "strict"
    || getBaseUrl("admin") !== "http://localhost:4173" || getApiBaseUrl() !== "http://127.0.0.1:18000"
    || !/^qa-ymath-realuse-[a-z0-9-]+$/.test(tenant) || !/^[a-f0-9]{40}$/.test(frontendSha)
    || !/^sha-[a-f0-9]{40}-run-\d+-\d+$/.test(releaseId) || !/^sha256:[a-f0-9]{64}$/.test(apiDigest)
    || !Number.isSafeInteger(tenantId) || tenantId < 1
    || !process.env.E2E_ADMIN_USER?.trim() || !process.env.E2E_ADMIN_PASS?.trim()
    || !process.env.E2E_MATCHUP_DISPATCH_PLAN) {
    throw new Error("Matchup real-use requires exact isolated candidate, QA tenant and dispatch plan");
  }
  return { tenant, tenantId, frontendSha, releaseId, apiDigest, fixturesSha256 };
}

function responseFor(page: Page, method: string, pathname: string): Promise<Response> {
  return page.waitForResponse((response) => response.request().method() === method
    && new URL(response.url()).pathname === pathname, { timeout: 120_000 });
}

async function selectDocument(page: Page, id: number) {
  await page.goto(`${getBaseUrl("admin")}/workspace/storage/matchup?docId=${id}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("matchup-doc-manual-crop-btn")).toBeVisible({ timeout: 30_000 });
}

async function noHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth
    - document.documentElement.clientWidth)).toBe(0);
}

test("격리 매치업 업로드·분석·수동 자르기·보고서 저장·다운로드·새로고침", async ({ page }, testInfo) => {
  test.setTimeout(900_000);
  const { files, fixturesSha256 } = await matchupRealUseFixtures();
  const binding = isolatedBinding(fixturesSha256);
  const documents: Document[] = [];
  const timings: Record<string, number> = {};
  let reportId: number | null = null;
  const reserve = (operation: string) => reserveQaDispatch(process.env.E2E_MATCHUP_DISPATCH_PLAN!, operation, binding);
  const persist = async () => {
    await testInfo.attach("matchup-owned-resources", { contentType: "application/json", body: Buffer.from(JSON.stringify({
      binding, documents: documents.map(({ id, ai_job_id, inventory_file_id }) => ({ id, ai_job_id, inventory_file_id })),
      reportId, timings,
    }, null, 2)) });
  };
  try {
    await page.setViewportSize({ width: 1366, height: 850 });
    await loginViaUI(page, "admin", { landingPath: "/workspace/storage/matchup" });
    for (const file of files) {
      const title = `${binding.tenant}-${file.kind}`;
      const uploadButton = page.getByTestId(file.kind === "reference" ? "matchup-reference-upload-button" : "matchup-upload-button")
        .or(page.getByRole("button", { name: file.kind === "reference" ? /^참고 자료 업로드/ : /^학생 시험지 업로드/ }));
      await expect(uploadButton).toHaveCount(1);
      await uploadButton.click();
      const modal = page.getByTestId("matchup-upload-modal");
      await expect(modal).toBeVisible();
      await modal.getByTestId("matchup-file-input").setInputFiles({
        name: file.name, mimeType: "application/pdf", buffer: file.buffer,
      });
      await modal.getByPlaceholder("문서 제목", { exact: true }).fill(title);
      await modal.getByPlaceholder("예: 수학", { exact: true }).fill("수학");
      reserve(`upload-${file.kind}`);
      const started = Date.now();
      const submitted = responseFor(page, "POST", "/api/v1/matchup/documents/upload/");
      await modal.getByTestId("matchup-upload-submit").click();
      const response = await submitted;
      expect(response.ok(), `upload ${file.kind}: HTTP ${response.status()}`).toBe(true);
      const doc = await response.json() as Document;
      expect(Number.isSafeInteger(doc.id) && doc.id > 0).toBe(true);
      documents.push(doc);
      await persist();
      await expect(modal).toBeHidden();
      await expect.poll(async () => {
        const current = await apiCall<DocumentJob>(page, "GET", `/matchup/documents/${doc.id}/job/`);
        expect(current.status).toBe(200);
        expect(current.body.document_id).toBe(doc.id);
        expect(current.body.status, "worker must finish successfully, not silently fail").not.toBe("failed");
        Object.assign(doc, current.body);
        return current.body.status;
      }, { timeout: 360_000, intervals: [3000, 5000] }).toBe("done");
      expect(doc.problem_count, "synthetic two-question input must produce usable problems").toBeGreaterThanOrEqual(2);
      timings[`${file.kind}AnalysisMs`] = Date.now() - started;
    }
    const exam = documents[1];
    await selectDocument(page, exam.id);
    await page.getByTestId("matchup-doc-manual-crop-btn").click();
    const crop = page.getByTestId("matchup-manual-crop-modal");
    const canvas = crop.getByTestId("matchup-crop-canvas");
    await expect(canvas).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => canvas.locator("img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width * 0.06, box!.y + box!.height * 0.17);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.9, box!.y + box!.height * 0.4);
    await page.mouse.up();
    await expect(crop.getByTestId("matchup-crop-draft")).toBeVisible();
    const manualRow = crop.getByTestId("matchup-crop-problem-row").filter({ hasText: /99번/ });
    await expect(manualRow).toHaveCount(0);
    await crop.getByTestId("matchup-crop-number-input").fill("99");
    reserve("manual-crop");
    const saved = responseFor(page, "POST", `/api/v1/matchup/documents/${exam.id}/manual-crop/`);
    const saveStarted = Date.now();
    await crop.getByTestId("matchup-crop-save-btn").click();
    expect((await saved).ok()).toBe(true);
    await expect(manualRow).toContainText("직접 자른 영역");
    timings.manualSaveMs = Date.now() - saveStarted;
    await crop.getByRole("button", { name: "직접 자르기 닫기", exact: true }).click();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId("matchup-doc-manual-crop-btn").click();
    await expect(manualRow).toContainText("직접 자른 영역");
    await noHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("matchup-manual-390.png") });
    await crop.getByRole("button", { name: "직접 자르기 닫기", exact: true }).click();
    await page.setViewportSize({ width: 1366, height: 850 });

    const reportStarted = Date.now();
    await page.getByTestId("matchup-doc-hit-report-curate-btn").click();
    const report = page.getByRole("dialog", { name: "적중 보고서 작성", exact: true });
    await expect(report).toBeVisible();
    const referenceRow = report.getByRole("button").filter({ has: page.getByRole("button", { name: "PDF에 포함", exact: true }) })
      .filter({ hasText: documents[0].title }).first();
    await expect(referenceRow).toBeVisible({ timeout: 120_000 });
    timings.candidatesMs = Date.now() - reportStarted;
    await referenceRow.getByRole("button", { name: "PDF에 포함", exact: true }).click();
    const summary = `${binding.tenant}: synthetic manual selection survives reload`;
    await report.getByPlaceholder("예: 1학기 중간고사 대비 반영률 종합 분석").fill(summary);
    await expect(report.getByTestId("matchup-hit-report-save-state")).toHaveText("저장됨 ✓", { timeout: 65_000 });
    const state = await apiCall<Report>(page, "GET", `/matchup/documents/${exam.id}/hit-report-draft/?mode=pins`);
    expect(state.status).toBe(200);
    reportId = state.body.report.id;
    await persist();
    expect(state.body.report.summary).toBe(summary);
    expect(state.body.entries.some((entry) => entry.selected_problem_ids.length > 0)).toBe(true);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("matchup-doc-hit-report-curate-btn").click();
    await expect(report.getByPlaceholder("예: 1학기 중간고사 대비 반영률 종합 분석")).toHaveValue(summary);
    await expect(report.getByLabel("PDF에 포함됨").first()).toBeVisible({ timeout: 120_000 });
    await page.screenshot({ path: testInfo.outputPath("matchup-report-1366.png") });
    const download = page.waitForEvent("download", { timeout: 120_000 });
    const pdfStarted = Date.now();
    await report.getByRole("button", { name: "PDF 다운로드", exact: true }).click();
    const pdfPath = await (await download).path();
    expect(pdfPath).toBeTruthy();
    const pdf = await readFile(pdfPath!);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
    await testInfo.attach("matchup-generated-report", { path: pdfPath!, contentType: "application/pdf" });
    timings.reportPdfMs = Date.now() - pdfStarted;
    await page.setViewportSize({ width: 390, height: 844 });
    await noHorizontalOverflow(page);
    await expect(report.getByRole("button", { name: "PDF 다운로드", exact: true })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath("matchup-report-390.png") });
  } finally {
    await persist();
    console.log(`MATCHUP_REALUSE_CLEANUP ${JSON.stringify({ tenantCode: binding.tenant,
      documentIds: documents.map((doc) => doc.id), jobIds: documents.map((doc) => doc.ai_job_id), reportId, timings })}`);
  }
});
