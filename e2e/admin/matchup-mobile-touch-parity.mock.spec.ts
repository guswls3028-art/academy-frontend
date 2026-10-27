import fs from "node:fs";
import type { Locator, Page, Route } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { contrast } from "../../src/shared/theme/accent";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");
const DOC_ID = 993_901;

test.afterEach(async ({ page }, testInfo) => {
  const theme = testInfo.project.metadata.appearanceTheme;
  if (typeof theme === "string" && page.url() !== "about:blank") {
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  }
});

async function expectReadableReportControl(control: Locator) {
  const readColors = () => control.evaluate((element) => {
    const style = getComputedStyle(element);
    const hex = (value: string) => "#" + (value.match(/[\d.]+/g) ?? []).slice(0, 3)
      .map((channel) => Math.round(Number(channel) * (value.startsWith("color(srgb") ? 255 : 1)).toString(16).padStart(2, "0")).join("");
    return { text: hex(style.color), background: hex(style.backgroundColor) };
  });
  await expect.poll(async () => {
    const colors = await readColors();
    return contrast(colors.text, colors.background);
  }, "Report control text contrast").toBeGreaterThanOrEqual(4.5);
}

function isLocalBase(url: string): boolean {
  const hostname = new URL(url).hostname;
  return hostname === "127.0.0.1" || hostname === "localhost";
}

function fakeJwt(): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 * 60 }),
  ).toString("base64url");
  return `e30.${payload}.sig`;
}

const documentPayload = {
  id: DOC_ID,
  title: "[E2E] 모바일 직접 자르기",
  category: "[E2E]",
  subject: "수학",
  grade_level: "고1",
  original_name: "mobile-crop.pdf",
  size_bytes: 1_024,
  content_type: "application/pdf",
  status: "done",
  ai_job_id: "",
  problem_count: 0,
  error_message: "",
  inventory_file_id: 1,
  created_at: "2026-08-25T00:00:00Z",
  updated_at: "2026-08-25T00:00:00Z",
  meta: {
    source_type: "school_exam_pdf",
    upload_intent: "school_exam_pdf",
    indexable: true,
    paper_type_summary: {
      primary: "clean_pdf_single",
      distribution: { clean_pdf_single: 1 },
      low_confidence_ratio: 0,
      warnings: [],
    },
  },
};

const pageImage = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1120"><rect width="800" height="1120" fill="white"/><text x="60" y="120" font-size="42">1. mobile crop fixture</text><rect x="55" y="160" width="690" height="260" fill="none" stroke="black" stroke-width="3"/></svg>',
)}`;

async function installMocks(page: Page, options: { failFirstPages?: boolean; failPageReads?: boolean; delayFirstRead?: boolean; failedAnalysis?: boolean; multiplePages?: boolean; report?: boolean; firstSimilarity?: number; missingActiveCandidate?: boolean } = {}) {
  const apiRequests: Array<{ method: string; path: string }> = [];
  let pageReads = 0;
  let pagePreparations = 0;
  let pageReadsAllowed = !options.failFirstPages;
  let pageReadFailures = options.failPageReads === true;
  let releaseRead = () => {};
  const firstRead = new Promise<void>((resolve) => { releaseRead = resolve; });
  const prepared = new Set<number>();
  const requestedPages: number[] = [];
  const savedProblems: Record<string, unknown>[] = [];
  const report = { id: 501, document_id: DOC_ID, document_title: documentPayload.title,
    document_category: "수학", author_id: 41, author_name: "QA 강사", title: "합성 적중 보고서",
    summary: "", status: "draft", entries: [] as Array<Record<string, unknown>> };
  const candidate = { id: 801, document_id: 401, document_title: "QA 참고자료", document_category: "수학",
    source_type: "academy_workbook", number: 1, text_preview: "Synthetic reference question",
    similarity: 0.95, image_key: "qa/reference.png", image_url: pageImage, page_index: 0 };
  const reportProblems = [1, 2].map((number) => ({ id: 700 + number, document_id: DOC_ID, number,
    text: `Synthetic question ${number}`, text_preview: `Synthetic question ${number}`,
    image_key: `qa/exam-${number}.png`, image_url: pageImage,
    candidates: number === 1 && options.missingActiveCandidate ? []
      : [{ ...candidate, similarity: number === 1 ? options.firstSimilarity ?? 0.95 : 0.35 }] }));
  if (options.missingActiveCandidate) {
    report.entries = [{ exam_problem_id: 701, selected_problem_ids: [801], comment: "", order: 0, excluded: false }];
  }

  await page.addInitScript(({ access, refresh }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    localStorage.setItem("tenant_code", "hakwonplus");
    localStorage.setItem("matchup:tree-width:hakwonplus:user:41", "520");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, { access: fakeJwt(), refresh: fakeJwt() });

  const json = (route: Route, body: unknown, status = 200) => route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    apiRequests.push({ method: request.method(), path });

    if (path === "/core/program/") {
      return json(route, {
        tenantCode: "hakwonplus",
        display_name: "모바일 패리티 학원",
        ui_config: {},
        feature_flags: {},
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      return json(route, {
        id: 41,
        username: "e2e-owner",
        name: "E2E 원장",
        phone: null,
        is_staff: true,
        is_superuser: false,
        tenantRole: "owner",
        must_change_password: false,
      });
    }
    if (path === "/staffs/me/") {
      return json(route, {
        is_authenticated: true,
        is_superuser: false,
        is_staff: true,
        is_owner: true,
        is_payroll_manager: false,
        staff_id: 41,
        assigned_work_types: [],
      });
    }
    if (path === "/matchup/documents/" && request.method() === "GET") {
      return json(route, [{ ...documentPayload, status: options.failedAnalysis ? "failed" : "done", problem_count: options.report ? 2 : savedProblems.length }]);
    }
    if (path === "/matchup/problems/" && request.method() === "GET") {
      return json(route, options.report ? reportProblems : savedProblems);
    }
    if (path === `/matchup/documents/${DOC_ID}/pages/` && request.method() === "POST") {
      pagePreparations += 1;
      if (!pageReadsAllowed) {
        return json(route, { detail: "temporary fixture error" }, 503);
      }
      const index = Number(request.postDataJSON().page_index ?? 0);
      prepared.add(index);
      requestedPages.push(index);
      return json(route, { prepared: true });
    }
    if (path === `/matchup/documents/${DOC_ID}/pages/` && request.method() === "GET") {
      pageReads += 1;
      if (options.delayFirstRead && pageReads === 1) await firstRead;
      if (pageReadFailures) {
        return json(route, { detail: "temporary read error" }, 503);
      }
      const selected = Number(new URL(request.url()).searchParams.get("page_index") || 0);
      if (!prepared.has(selected)) return json(route, { code: "pages_not_prepared" }, 409);
      const count = options.multiplePages ? 3 : 1;
      return json(route, {
        doc_id: DOC_ID,
        is_pdf: true,
        page_count: count,
        pages: Array.from({ length: count }, (_, index) => ({ index, url: prepared.has(index) ? pageImage : "", width: 800, height: 1_120 })),
      });
    }
    if (path === `/matchup/documents/${DOC_ID}/manual-crop/` && request.method() === "POST") {
      const payload = request.postDataJSON();
      const saved = {
        id: 993_902,
        document_id: DOC_ID,
        number: 1,
        text: "",
        image_key: "e2e/manual-crop.png",
        meta: { manual: true, page_index: payload.page_index, bbox_norm: [payload.bbox.x, payload.bbox.y, payload.bbox.w, payload.bbox.h] },
        created_at: "2026-08-25T00:00:00Z",
      };
      savedProblems.push(saved);
      return json(route, saved);
    }
    if (path === "/matchup/categories/") return json(route, []);
    if (path === "/matchup/hit-reports/board-preview/") {
      return json(route, { reports: [], total_published: 0 });
    }
    if (path === "/results/admin/clinic-targets/") return json(route, []);
    if (path === `/matchup/documents/${DOC_ID}/hit-report-draft/`) {
      if (options.report) return json(route, {
        report, entries: report.entries,
        exam_problems: reportProblems.map((problem) => ({ ...problem,
          entry: report.entries.find((entry) => entry.exam_problem_id === problem.id) || null })),
        // Persisted metadata has no question-specific similarity in the real API.
        selected_problem_meta: [{ ...candidate, similarity: undefined }],
      });
      return json(route, { report: null, entries: [] });
    }
    if (options.report && path === "/matchup/hit-reports/501/" && request.method() === "PATCH") {
      Object.assign(report, request.postDataJSON());
      return json(route, report);
    }
    if (options.report && path === "/matchup/hit-reports/501/entries/" && request.method() === "POST") {
      report.entries = request.postDataJSON().entries;
      return json(route, { upserted: report.entries.length, deleted: 0 });
    }
    if (options.report && path === "/matchup/hit-reports/501/curated.pdf") {
      return route.fulfill({ status: 200, contentType: "application/pdf", body: "%PDF-1.4\nmock report\n%%EOF" });
    }
    return json(route, { count: 0, results: [] });
  });

  return {
    report,
    apiRequests,
    getPageReads: () => pageReads,
    getPagePreparations: () => pagePreparations,
    allowPageReads: () => { pageReadsAllowed = true; pageReadFailures = false; },
    releaseRead,
    requestedPages,
  };
}

for (const width of [1366, 390]) {
  test(`${width}px: AI 문항 0개에서도 선택 페이지 준비·자르기·재조회`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const { requestedPages } = await installMocks(page, { multiplePages: true, failedAnalysis: true });
    await openCropModal(page);
    await expect(page.getByTestId("matchup-crop-canvas")).toBeVisible();
    await expect(page.getByTestId("matchup-crop-page-thumb")).toHaveCount(3);
    expect(requestedPages).toEqual([0]);
    await page.getByTestId("matchup-crop-page-thumb").nth(2).click();
    const canvas = page.getByTestId("matchup-crop-canvas");
    await expect(canvas).toBeVisible();
    expect(requestedPages).toEqual([0, 2]);
    await drawTouchBox(canvas);
    await page.getByTestId("matchup-crop-number-input").fill("1");
    await page.getByTestId("matchup-crop-save-btn").click();
    await expect(page.getByTestId("matchup-crop-problem-row")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await page.reload();
    await page.getByTestId("matchup-doc-manual-crop-btn").click();
    await page.getByTestId("matchup-crop-page-thumb").nth(2).click();
    await expect(page.getByTestId("matchup-crop-problem-row")).toHaveCount(1);
    await expectNoDocumentOverflow(page);
    await page.screenshot({ path: `test-results/matchup-manual-pages-${width}.png`, fullPage: true });
  });
}

async function openCropModal(page: Page) {
  await page.goto(`${BASE}/workspace/storage/matchup?docId=${DOC_ID}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await expect(page.getByTestId("matchup-doc-manual-crop-btn")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("matchup-doc-manual-crop-btn").click();
  await expect(page.getByTestId("matchup-manual-crop-modal")).toBeVisible();
}

async function expectNoDocumentOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    body: document.body.scrollWidth <= window.innerWidth,
    root: document.documentElement.scrollWidth <= window.innerWidth,
  }))).toEqual({ body: true, root: true });
}

async function drawTouchBox(canvas: Locator) {
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(300);
  if (!box) throw new Error("crop canvas has no bounding box");
  await canvas.evaluate((element, rect) => {
    element.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      pointerType: "touch",
      pointerId: 7,
      isPrimary: true,
      clientX: rect.x + rect.width * 0.12,
      clientY: rect.y + rect.height * 0.12,
    }));
    window.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true,
      pointerType: "touch",
      pointerId: 7,
      isPrimary: true,
      clientX: rect.x + rect.width * 0.68,
      clientY: rect.y + rect.height * 0.38,
    }));
    window.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      pointerType: "touch",
      pointerId: 7,
      isPrimary: true,
      clientX: rect.x + rect.width * 0.68,
      clientY: rect.y + rect.height * 0.38,
    }));
  }, box);
  await expect(canvas.page().getByTestId("matchup-crop-draft")).toBeVisible();
}

test.use({ serviceWorkers: "block" });
test.skip(!isLocalBase(BASE), "Local route-mock spec. Set E2E_BASE_URL to localhost to run.");

test("390px: persisted desktop tree width cannot crop the canonical matchup workflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installMocks(page);
  await page.goto(`${BASE}/workspace/storage/matchup?docId=${DOC_ID}`, { waitUntil: "domcontentloaded" });

  const tree = page.getByTestId("matchup-doc-tree");
  await expect(tree).toBeVisible();
  await expect.poll(() => page.evaluate(() =>
    localStorage.getItem("matchup:tree-width:hakwonplus:user:41"),
  )).toBe("520");
  await expect.poll(() => tree.evaluate((element) => element.style.width)).toBe("100%");
  await expect.poll(async () => (await tree.boundingBox())?.width ?? 0).toBeLessThanOrEqual(366);
  await expectNoDocumentOverflow(page);
});

test("390px: page, touch crop, number, save stack in order and preserve unsaved work", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { apiRequests } = await installMocks(page);
  await openCropModal(page);

  const modal = page.getByTestId("matchup-manual-crop-modal");
  await expect(modal).toHaveAttribute("data-layout", "mobile-stacked");
  const closeButton = page.getByRole("button", { name: "직접 자르기 닫기" });
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(await modal.evaluate((element) => element.contains(document.activeElement))).toBe(true);

  const pageRail = page.getByTestId("matchup-crop-page-rail");
  const canvas = page.getByTestId("matchup-crop-canvas");
  const inspector = page.getByTestId("matchup-crop-inspector");
  const order = await page.evaluate(() => {
    const rail = document.querySelector('[data-testid="matchup-crop-page-rail"]');
    const crop = document.querySelector('[data-testid="matchup-crop-canvas"]');
    const panel = document.querySelector('[data-testid="matchup-crop-inspector"]');
    return [rail, crop, panel].map((node) => node?.getBoundingClientRect().top ?? -1);
  });
  expect(order[0]).toBeLessThan(order[1]);
  expect(order[1]).toBeLessThan(order[2]);
  await expect(pageRail).toBeVisible();
  await expect(canvas).toBeVisible();
  await expect(inspector).toBeVisible();

  await drawTouchBox(canvas);

  await closeButton.click();
  await expect(page.getByRole("alertdialog", { name: "작업을 닫을까요?" })).toBeVisible();
  await page.getByRole("button", { name: "계속 작업" }).click();
  await expect(page.getByTestId("matchup-crop-draft")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("matchup-crop-draft")).toHaveCount(0);
  await expect(modal).toBeVisible();

  await drawTouchBox(canvas);

  await page.getByTestId("matchup-crop-number-input").fill("1");
  await page.getByTestId("matchup-crop-save-btn").click();
  await expect(page.getByTestId("matchup-crop-problem-row")).toHaveCount(1);
  const productMutations = apiRequests.filter(({ method, path }) => (
    method !== "GET"
    && path !== "/matchup/problems/presign/"
    && !/^\/matchup\/problems\/\d+\/similar\/$/.test(path)
  ));
  expect(productMutations).toEqual([
    { method: "POST", path: `/matchup/documents/${DOC_ID}/pages/` },
    { method: "POST", path: `/matchup/documents/${DOC_ID}/manual-crop/` },
  ]);
  await expectNoDocumentOverflow(page);
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(page.getByTestId("matchup-doc-manual-crop-btn")).toBeFocused();
});

test("390px: preparation failure retries without saving a problem", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { apiRequests, getPagePreparations, allowPageReads } = await installMocks(page, { failFirstPages: true });
  await openCropModal(page);

  await expect(page.getByText("페이지 로드 실패")).toBeVisible();
  allowPageReads();
  await page.getByRole("button", { name: "페이지 다시 불러오기" }).click();
  await expect(page.getByTestId("matchup-crop-canvas")).toBeVisible();
  expect(getPagePreparations()).toBe(2);
  expect(apiRequests.filter(({ method }) => method !== "GET")).toEqual([
    { method: "POST", path: `/matchup/documents/${DOC_ID}/pages/` },
    { method: "POST", path: `/matchup/documents/${DOC_ID}/pages/` },
  ]);
});

test("390px: read failure after preparation can retry and display the saved cache", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { getPageReads, getPagePreparations, allowPageReads, requestedPages } = await installMocks(page, { failPageReads: true });
  await openCropModal(page);
  await expect(page.getByText("페이지 로드 실패")).toBeVisible();
  expect(getPageReads()).toBe(3);
  allowPageReads();
  await page.getByRole("button", { name: "페이지 다시 불러오기" }).click();
  await expect(page.getByTestId("matchup-crop-canvas")).toBeVisible();
  expect(getPageReads()).toBe(4);
  expect(getPagePreparations()).toBe(2);
  expect(requestedPages).toEqual([0, 0]);
  await expectNoDocumentOverflow(page);
});

for (const width of [1366, 390]) {
  test(`${width}px: closing cancels a prepared page read and reopening ignores its late response`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const { releaseRead, requestedPages, getPageReads } = await installMocks(page, { delayFirstRead: true, multiplePages: true });
    await openCropModal(page);
    await expect.poll(getPageReads).toBe(1);
    const aborted = page.waitForEvent("requestfailed", {
      predicate: (request) => request.method() === "GET" && new URL(request.url()).pathname.endsWith(`/documents/${DOC_ID}/pages/`),
    });
    await page.getByRole("button", { name: "직접 자르기 닫기" }).click();
    await aborted;
    releaseRead();
    await expect(page.getByTestId("matchup-manual-crop-modal")).toHaveCount(0);
    await page.getByTestId("matchup-doc-manual-crop-btn").click();
    await expect(page.getByTestId("matchup-crop-canvas")).toBeVisible();
    await page.getByTestId("matchup-crop-page-thumb").nth(2).click();
    await expect(page.getByTestId("matchup-crop-canvas")).toBeVisible();
    expect(requestedPages).toEqual([0, 0, 2]);
    await expect(page.getByTestId("matchup-crop-problem-row")).toHaveCount(0);
    await expectNoDocumentOverflow(page);
  });
}

test("1366px: existing three-column crop contract remains intact", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await installMocks(page);
  await openCropModal(page);

  const modal = page.getByTestId("matchup-manual-crop-modal");
  await expect(modal).toHaveAttribute("data-layout", "desktop-3-column");
  const widths = await page.evaluate(() => ({
    rail: document.querySelector('[data-testid="matchup-crop-page-rail"]')?.getBoundingClientRect().width ?? 0,
    inspector: document.querySelector('[data-testid="matchup-crop-inspector"]')?.getBoundingClientRect().width ?? 0,
  }));
  expect(widths.rail).toBe(110);
  expect(widths.inspector).toBe(280);
  await expectNoDocumentOverflow(page);
});

for (const width of [390, 1366]) {
  test(`${width}px: report candidate selection, save, reload and download remain reachable`, async ({ page }, testInfo) => {
    expect(isLocalBase(BASE)).toBe(true);
    await page.setViewportSize({ width, height: 844 });
    const { report: savedReport } = await installMocks(page, { report: true });
    const theme = testInfo.project.metadata.appearanceTheme ?? "focus-dark";
    await page.addInitScript((style) => localStorage.setItem("hakwonplus:appearance", JSON.stringify({ version: 1, theme: style, accent: "#ffedaa" })), theme);
    await page.goto(`${BASE}/workspace/storage/matchup?docId=${DOC_ID}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.getByTestId("matchup-doc-hit-report-curate-btn")).toBeVisible({ timeout: 45_000 });
    await page.getByTestId("matchup-doc-hit-report-curate-btn").click();
    const report = page.getByRole("dialog", { name: "적중 보고서 작성" });
    const previewHeader = report.getByRole("button", { name: "다음 문항", exact: true }).locator("..");
    await expect(previewHeader).toContainText(/직접 적중\s+·\s+95\.0%/);
    const downloadButton = report.getByRole("button", { name: "PDF 다운로드", exact: true });
    await expect(downloadButton).toBeInViewport({ ratio: 1 });
    const comment = report.getByPlaceholder("이 문항을 어떻게 다뤘는지, 학생이 알아둘 점은 무엇인지 작성하세요");
    await expect(comment).toBeVisible();
    await expect.poll(async () => (await comment.boundingBox())?.width || 0).toBeGreaterThanOrEqual(280);
    await comment.fill(`QA comment ${width}`);
    await page.screenshot({ path: testInfo.outputPath(`report-preview-${width}.png`) });
    const add = report.getByRole("button", { name: "PDF에 포함", exact: true }).first();
    await add.scrollIntoViewIfNeeded();
    await expect(add).toBeInViewport({ ratio: 1 });
    await expectReadableReportControl(add);
    await add.click();
    await expect(report.getByLabel("PDF에 포함됨")).toBeVisible();
    await expect(previewHeader).toContainText(/직접 적중\s+·\s+95\.0%/);
    await expectReadableReportControl(report.getByLabel("PDF에 포함됨"));
    await expectReadableReportControl(report.getByText("1 선택", { exact: true }));
    await expectReadableReportControl(report.getByRole("button", { name: "PDF에서 제외", exact: true }).filter({ hasText: "✕ PDF에서 제외" }));
    const summary = report.getByPlaceholder("예: 1학기 중간고사 대비 반영률 종합 분석");
    await summary.fill(`QA report ${width}`);
    await expect(report.getByTestId("matchup-hit-report-save-state")).toHaveText("저장됨 ✓");
    expect(savedReport.summary).toBe(`QA report ${width}`);
    expect(savedReport.entries.some((entry) => (entry.selected_problem_ids as number[]).includes(801))).toBe(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("matchup-doc-hit-report-curate-btn").click();
    await expect(summary).toHaveValue(`QA report ${width}`);
    await expect(comment).toHaveValue(`QA comment ${width}`);
    await expect(report.getByLabel("PDF에 포함됨")).toBeVisible();
    await expect(previewHeader).toContainText(/직접 적중\s+·\s+95\.0%/);
    await report.getByRole("button", { name: "다음 문항", exact: true }).click();
    await expect(previewHeader).toContainText("유사도 35.0%");
    await report.getByRole("button", { name: "이전 문항", exact: true }).click();
    await expect(previewHeader).toContainText(/직접 적중\s+·\s+95\.0%/);
    const download = page.waitForEvent("download");
    await downloadButton.click();
    expect(await (await download).failure()).toBeNull();
    await expectNoDocumentOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`report-${width}.png`) });
    await report.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(report).toBeHidden();
  });
}

for (const scenario of [
  { name: "real zero", firstSimilarity: 0, missingActiveCandidate: false, label: "유사도 0.0%" },
  { name: "missing score", firstSimilarity: undefined, missingActiveCandidate: true, label: "유사도 정보 없음" },
]) {
  test(`report preview distinguishes ${scenario.name} from another question's score`, async ({ page }) => {
    expect(isLocalBase(BASE)).toBe(true);
    await installMocks(page, { report: true, ...scenario });
    await page.goto(`${BASE}/workspace/storage/matchup?docId=${DOC_ID}`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("matchup-doc-hit-report-curate-btn").click();
    const report = page.getByRole("dialog", { name: "적중 보고서 작성" });
    const header = report.getByRole("button", { name: "다음 문항", exact: true }).locator("..");
    await expect(header).toContainText(scenario.label);
    await expect(header.locator("..")).toContainText("QA 참고자료");
    const referenceImage = report.getByRole("img", { name: "내 수업 자료", exact: true });
    await expect(referenceImage).toBeVisible();
    await expect.poll(() => referenceImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await report.getByRole("button", { name: "다음 문항", exact: true }).click();
    await expect(header).toContainText("유사도 35.0%");
    await report.getByRole("button", { name: "이전 문항", exact: true }).click();
    await expect(header).toContainText(scenario.label);
  });
}

test("mobile storage copy no longer presents matchup as PC-only", () => {
  const source = fs.readFileSync(
    "src/app_teacher/domains/storage/pages/MyStoragePage.tsx",
    "utf8",
  );
  expect(source).not.toContain("매치업은 PC 전용");
  expect(source).not.toContain("PC에서 진행합니다");
  expect(source).not.toContain("PC에서 매치업 열기");
});
