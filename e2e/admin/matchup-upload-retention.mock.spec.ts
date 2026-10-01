import type { Page, Route } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { installLocalAuthApiStubs } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const document = (id: number) => ({
  id, title: `보존 검증 자료 ${id}`, category: "고1 자료", subject: "수학", grade_level: "고1",
  original_name: `${id}.pdf`, size_bytes: 1024, content_type: "application/pdf",
  status: "done", ai_job_id: "", problem_count: 0, error_message: "", inventory_file_id: id,
  created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z",
  meta: { source_type: "school_exam_pdf", upload_intent: "reference", indexable: true },
});

async function installApi(page: Page, failRefresh: boolean) {
  const documents = failRefresh ? [document(900)] : [];
  const pending = new Map<number, () => void>();
  let uploads = 0;
  let listReads = 0;
  let listFailure = false;
  await page.addInitScript(() => {
    const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, "");
    const token = `${encode({ alg: "none" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
    const generation = "matchup-upload-retention";
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
    localStorage.setItem(`academy:auth-tokens:v1:${generation}`, JSON.stringify({ access: token, refresh: token, generation }));
    localStorage.setItem("academy:auth-active-generation:v1", generation);
  });
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
    if (path === "/matchup/documents/upload/") {
      const ordinal = ++uploads;
      if (ordinal > 1) await new Promise<void>((resolve) => pending.set(ordinal, resolve));
      const saved = document(ordinal);
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
  return {
    uploads: () => uploads,
    listReads: () => listReads,
    recover: () => { listFailure = false; },
    release: (ordinal: number) => pending.get(ordinal)?.(),
    releaseAll: () => pending.forEach((resolve) => resolve()),
  };
}

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
