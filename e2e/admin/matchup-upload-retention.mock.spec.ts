import type { Page, Route } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { installLocalAuthApiStubs } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const document = (id: number) => ({
  id, title: `보존 검증 자료 ${id}`, category: "고1 자료", subject: "수학", grade_level: "고1",
  original_name: `${id}.pdf`, size_bytes: 1024, content_type: "application/pdf",
  status: "done", ai_job_id: "", problem_count: 0, error_message: "", inventory_file_id: id,
  created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z",
  exam_cycle: "", exam_year: 0,
  meta: { source_type: "school_exam_pdf", upload_intent: "reference", indexable: true },
});

async function installApi(page: Page, failRefresh: boolean, options: { holdUploads?: boolean; failUpload?: boolean; legacy?: boolean; tenantCode?: string } = {}) {
  const documents = options.legacy
    ? [{ ...document(900), exam_cycle: "midterm", exam_year: 2026 }, { ...document(901), exam_cycle: "final", exam_year: 2026 }]
    : failRefresh ? [document(900)] : [];
  let rejectUpload = options.failUpload ?? false;
  const pending = new Map<number, () => void>();
  let uploads = 0;
  let listReads = 0;
  let listFailure = false;
  await page.addInitScript((tenantCode) => {
    const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, "");
    const token = `${encode({ alg: "none" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
    const generation = "matchup-upload-retention";
    localStorage.setItem("tenant_code", tenantCode);
    sessionStorage.setItem("tenantCode", tenantCode);
    localStorage.setItem(`academy:auth-tokens:v1:${generation}`, JSON.stringify({ access: token, refresh: token, generation }));
    localStorage.setItem("academy:auth-active-generation:v1", generation);
  }, options.tenantCode || "hakwonplus");
  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const headers = {
      "access-control-allow-origin": BASE,
      "access-control-allow-headers": "authorization,content-type,x-client,x-client-version,x-tenant-code",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    };
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers, json: body });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (path === "/core/landing/public/") return json({
      has_landing: true,
      template_key: "premium_dark",
      config: { brand_name: "검증 학원", primary_color: "#D4A04C", contact: {}, sections: [
        { type: "hit_reports", enabled: true, order: 1, items: documents.map((doc) => ({ report_id: doc.id })) },
      ] },
    });
    if (path === "/matchup/landing/public/") return json({ reports: documents.map((doc) => ({
      id: doc.id, doc_title: doc.title, doc_category: doc.category,
      exam_cycle: doc.exam_cycle, exam_year: doc.exam_year,
      hit_count: 1, total_problems: 2, hit_rate_pct: 50, submitted_at: doc.created_at, created_at: doc.created_at,
    })) });
    if (path === "/matchup/documents/upload/") {
      const ordinal = ++uploads;
      if (rejectUpload) return json({ detail: "시험 회차 저장 실패" }, 500);
      if (ordinal > 1 && options.holdUploads !== false) await new Promise<void>((resolve) => pending.set(ordinal, resolve));
      const saved = document(ordinal);
      const body = request.postData() || "";
      const field = (name: string) => body.split(`name="${name}"`)[1]?.split("\r\n\r\n")[1]?.split("\r\n")[0] || "";
      saved.exam_cycle = field("exam_cycle");
      saved.exam_year = Number(field("exam_year"));
      documents.push(saved);
      listFailure = failRefresh && ordinal === 1;
      return json(saved);
    }
    if (path === "/matchup/documents/") {
      listReads++;
      return listFailure ? json({ detail: "fixture refresh failure" }, 503) : json(documents);
    }
    if (/^\/matchup\/documents\/\d+\/$/.test(path)) {
      return json(documents.find((doc) => doc.id === Number(path.split("/")[3])));
    }
    if (path === "/staffs/me/") return json({ id: 12, is_payroll_manager: true });
    if (path === "/matchup/hit-reports/board-preview/") return json({ reports: [], total_published: 0 });
    return json([]);
  });
  await installLocalAuthApiStubs(page);
  if (options.tenantCode) {
    await page.route("**/api/v1/core/program/", (route) => route.fulfill({ json: {
      tenantCode: options.tenantCode, display_name: "검증 학원", is_active: true,
      ui_config: { login_title: "검증 학원" }, feature_flags: {},
    } }));
  }
  return {
    uploads: () => uploads,
    listReads: () => listReads,
    recover: () => { listFailure = false; },
    recoverUpload: () => { rejectUpload = false; },
    release: (ordinal: number) => pending.get(ordinal)?.(),
    releaseAll: () => pending.forEach((resolve) => resolve()),
  };
}

const semesterCycles = [
  ["semester1_midterm", "1학기 중간고사"], ["semester1_final", "1학기 기말고사"],
  ["semester2_midterm", "2학기 중간고사"], ["semester2_final", "2학기 기말고사"],
] as const;

for (const width of [1366, 390]) {
  test(`${width}px: 학기별 회차 저장·재조회와 학교별 보고서 순서`, async ({ page }) => {
    test.skip(!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE), "로컬 API mock 전용");
    await page.setViewportSize({ width, height: 900 });
    const api = await installApi(page, false, { holdUploads: false, legacy: true, tenantCode: "tchul" });
    await page.goto(`${BASE}/workspace/storage/matchup`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expect(page.getByTestId("matchup-upload-button")).toBeVisible({ timeout: 30_000 });
    for (const [cycle] of [...semesterCycles].reverse()) {
      await page.getByTestId("matchup-upload-button").click();
      const select = page.getByTestId("matchup-upload-exam-cycle");
      await expect(select.locator("option")).toHaveCount(7);
      await expect(select.locator('option[value="midterm"], option[value="final"]')).toHaveCount(0);
      await select.selectOption(cycle);
      await page.getByTestId("matchup-upload-exam-year").fill("2026");
      await page.getByTestId("matchup-file-input").setInputFiles({
        name: `${cycle}.pdf`, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF"),
      });
      await page.getByTestId("matchup-upload-submit").click();
      await expect(page.getByTestId("matchup-upload-modal")).not.toBeVisible();
      const collapse = page.getByRole("button", { name: "접기", exact: true });
      if (await collapse.isVisible()) await collapse.click();
    }
    expect(api.uploads()).toBe(4);
    await page.reload();
    await expect(page.getByText("보존 검증 자료 4", { exact: true }).first()).toBeVisible();
    await page.goto(`${BASE}/landing/reports`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.getByRole("button", { name: "학교별", exact: true }).click();
    const cards = page.getByTestId("school-group-고1 자료").locator('a[href^="/landing/reports/"]');
    await expect(cards).toHaveCount(6);
    for (const [index, [, label]] of semesterCycles.entries()) {
      await expect(cards.nth(index).getByText(`2026 ${label}`, { exact: true })).toBeVisible();
    }
    await expect(cards.nth(4)).toContainText("중간고사 (학기 미지정)");
    await expect(cards.nth(5)).toContainText("기말고사 (학기 미지정)");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/matchup-semester-${width}.png`, fullPage: true });
  });
}

test.describe("시험 회차 저장 실패 복구", () => {
  test.use({ strictBrowserAutoAssert: false });
  for (const width of [1366, 390]) {
    test(`${width}px: 실패한 업로드의 선택·파일 유지와 재시도`, async ({ page }) => {
      test.skip(!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE), "로컬 API mock 전용");
      await page.setViewportSize({ width, height: 900 });
      const api = await installApi(page, false, { holdUploads: false, failUpload: true });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${BASE}/workspace/storage/matchup`);
      await page.getByTestId("matchup-empty-reference-btn").click();
      await page.getByTestId("matchup-upload-exam-cycle").selectOption("semester2_midterm");
      await page.getByTestId("matchup-file-input").setInputFiles({
        name: "retry.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF"),
      });
      await page.getByTestId("matchup-upload-submit").click();
      await expect(page.getByText("시험 회차 저장 실패", { exact: true })).toBeVisible();
      await expect(page.getByTestId("matchup-upload-exam-cycle")).toHaveValue("semester2_midterm");
      await expect(page.getByTestId("matchup-upload-entry")).toHaveCount(1);
      api.recoverUpload();
      await page.getByTestId("matchup-upload-submit").click();
      await expect(page.getByTestId("matchup-upload-modal")).not.toBeVisible();
      await page.reload();
      await expect(page.getByText("보존 검증 자료 2", { exact: true }).first()).toBeVisible();
      expect(api.uploads()).toBe(2);
      expect(errors).toEqual([]);
    });
  }
});

for (const failRefresh of [false, true]) {
  test.describe(failRefresh ? "목록 갱신 실패 중 업로드 보존" : "빈 목록의 연속 업로드 보존", () => {
    // The failure scenario checks only its intentional 503 console errors below.
    test.use({ strictBrowserAutoAssert: !failRefresh });
    for (const width of [1366, 390]) {
      test(`${width}px: 파일·입력·진행 상태 유지 후 완료와 재조회`, async ({ page }) => {
        test.skip(!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE), "로컬 API mock 전용");
        await page.setViewportSize({ width, height: 900 });
        const errors: string[] = [];
        const consoleErrors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
        const api = await installApi(page, failRefresh);
        await page.goto(`${BASE}/workspace/storage/matchup`, { waitUntil: "domcontentloaded", timeout: 30_000 });
        const uploadButton = page.getByTestId(failRefresh ? "matchup-upload-button" : "matchup-empty-reference-btn");
        await expect(uploadButton).toBeVisible({ timeout: 30_000 });
        await uploadButton.click();
        const modal = page.getByTestId("matchup-upload-modal");
        await expect(modal).toBeVisible();
        await modal.evaluate((node) => node.setAttribute("data-retention-probe", "original"));
        await page.getByPlaceholder("문서 제목", { exact: true }).fill("연속 업로드 제목");
        await page.getByTestId("matchup-upload-category-input").fill("고1 자료");
        await page.getByTestId("matchup-file-input").setInputFiles([1, 2, 3].map((id) => ({
          name: `자료-${id}.pdf`, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF"),
        })));
        await page.getByTestId("matchup-split-mode-toggle").click();
        await page.getByTestId("matchup-upload-submit").click();
        try {
          for (const ordinal of [2, 3]) {
            await expect.poll(api.uploads).toBe(ordinal);
            await expect.poll(api.listReads).toBeGreaterThan(ordinal - 1);
            if (failRefresh && ordinal === 2) {
              await expect(page.getByRole("alert").filter({ hasText: "문서 목록을 갱신하지 못했습니다" })).toBeVisible();
            }
            await expect(modal).toHaveAttribute("data-retention-probe", "original");
            await expect(page.getByPlaceholder("문서 제목", { exact: true })).toHaveValue("연속 업로드 제목");
            await expect(page.getByTestId("matchup-upload-category-input")).toHaveValue("고1 자료");
            await expect(page.getByTestId("matchup-upload-entry")).toHaveCount(3);
            await expect(page.getByTestId("matchup-upload-entry").nth(ordinal - 2)).toHaveAttribute("data-entry-status", "done");
            const bounds = await modal.boundingBox();
            expect(bounds).not.toBeNull();
            expect(bounds!.x).toBeGreaterThanOrEqual(0);
            expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
            await page.screenshot({ path: `test-results/matchup-retention-${width}-${failRefresh}-${ordinal}.png` });
            api.recover();
            api.release(ordinal);
          }
          await expect(modal).not.toBeVisible();
          await page.reload();
          await expect(page.getByText("보존 검증 자료 3", { exact: true }).first()).toBeVisible();
          expect(api.uploads()).toBe(3);
          expect(errors).toEqual([]);
          expect(consoleErrors.filter((error) => !failRefresh || !/503 \(Service Unavailable\)/.test(error))).toEqual([]);
        } finally {
          api.releaseAll();
        }
      });
    }
  });
}
