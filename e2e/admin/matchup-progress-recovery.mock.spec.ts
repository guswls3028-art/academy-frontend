import { expect, test } from "../fixtures/strictTest";
import { getBaseUrl } from "../helpers/auth";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const base = getBaseUrl("admin");
const jobId = "matchup-unavailable-fixture";
const image = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="white"/><text x="20" y="60">1. Preserved manual question</text></svg>')}`;

for (const { width, status, partial } of [
  { width: 1366, status: 403, partial: false },
  { width: 390, status: 404, partial: false },
  { width: 390, status: "UNKNOWN", partial: true },
]) {
  test(`${width}px: 매치업 ${status} 자동 조회 중단·상태 재확인·원본 유지`, async ({ page }, testInfo) => {
    test.skip(!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base), "Local mocked API only");
    let recovered = false;
    let progressReads = 0;
    let documentReads = 0;
    let mutations = 0;
    const mutationPaths: string[] = [];
    const problem = { id: 941, document_id: 91, number: 1, page_index: 0,
      text: "Preserved manual question", image_key: "fixture/question.png", image_url: image,
      bbox: [0, 0, 400, 240], meta: { manual: true, manual_owner_pinned: true }, tags: [],
      subject: "수학", topic: "", difficulty: "", embedding_status: "done" };
    const document = () => ({ id: 91, title: "상태 확인 검증 문서", category: "검증",
      subject: "수학", grade_level: "고1", original_name: "fixture.pdf", size_bytes: 1024,
      content_type: "application/pdf", status: recovered ? "done" : "processing", ai_job_id: jobId,
      problem_count: partial || recovered ? 1 : 0, error_message: "", inventory_file_id: 91,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      meta: { source_type: "academy_workbook", upload_intent: "reference", indexable: true } });
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
      if (path === "/matchup/problems/941/similar/" && request.method() === "POST") {
        return route.fulfill({ json: { results: [] } });
      }
      if (request.method() !== "GET") {
        mutations++;
        mutationPaths.push(`${request.method()} ${path}`);
        return route.fulfill({ status: 409, json: { detail: "Unexpected fixture mutation" } });
      }
      if (path === `/jobs/${jobId}/progress/`) {
        progressReads++;
        return recovered
          ? route.fulfill({ json: { job_id: jobId, job_type: "matchup_analysis", status: "DONE", progress: null } })
          : route.fulfill({ status: typeof status === "number" ? status : 200,
            json: typeof status === "number" ? { detail: "Unavailable fixture job" } : { status, progress: null } });
      }
      if (path === "/matchup/documents/") { documentReads++; return route.fulfill({ json: [document()] }); }
      if (path === "/matchup/documents/91/") return route.fulfill({ json: document() });
      if (path === "/matchup/problems/") return route.fulfill({ json: partial || recovered ? [problem] : [] });
      if (path === "/staffs/me/") return route.fulfill({ json: { is_authenticated: true, is_staff: true, is_superuser: true } });
      if (path === "/core/landing/admin/consult/") return route.fulfill({ json: { items: [], summary: { total: 0, unread: 0 } } });
      if (path === "/matchup/hit-reports/board-preview/") return route.fulfill({ json: { reports: [], total_published: 0 } });
      return route.fulfill({ json: [] });
    });
    await installLocalAuthApiStubs(page);
    await installTenantOneInitScript(page);
    await page.addInitScript(() => {
      const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, "");
      const token = `${encode({ alg: "none" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "hakwonplus", user_id: 12 })}.sig`;
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", token);
    });
    await page.clock.install();
    await page.goto(`${base}/workspace/storage/matchup`, { waitUntil: "domcontentloaded" });
    const notice = page.getByTestId("matchup-progress-unavailable");
    await expect(notice).toBeVisible();
    // Both the foreground and workbox may observe the unavailable job once.
    await expect.poll(() => progressReads).toBe(2);
    const closeWorkbox = page.getByRole("button", { name: "작업박스 닫기", exact: true });
    if (await closeWorkbox.isVisible()) await closeWorkbox.click();
    await expect(notice.getByRole("button", { name: "상태 다시 확인" })).toBeVisible();
    await expect(page.getByTestId("matchup-progress-bar")).toHaveCount(0);
    if (partial) await expect(page.getByTestId("matchup-problem-card-protected")).toHaveCount(1);
    const readsBeforeIdle = documentReads;
    await page.clock.runFor(6_500);
    expect(progressReads).toBe(2);
    expect(documentReads).toBe(readsBeforeIdle);
    expect(mutations, mutationPaths.join("\n")).toBe(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    await page.screenshot({ path: testInfo.outputPath("unavailable.png"), fullPage: true });
    recovered = true;
    await notice.getByRole("button", { name: "상태 다시 확인" }).click();
    await expect(notice).toHaveCount(0);
    await expect(page.getByTestId("matchup-problem-card-protected")).toHaveCount(1);
    expect(documentReads).toBeGreaterThan(readsBeforeIdle);
    expect(mutations, mutationPaths.join("\n")).toBe(0);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("matchup-problem-card-protected")).toHaveCount(1);
    await expect(notice).toHaveCount(0);
    expect(mutations, mutationPaths.join("\n")).toBe(0);
  });
}
