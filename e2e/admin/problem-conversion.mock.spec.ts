import { test, expect } from "../fixtures/strictTest";
import { getBaseUrl } from "../helpers/auth";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import type { Conversion } from "../../src/app_admin/domains/tools/problem-studio/api/conversions.api";

const baseUrl = getBaseUrl("admin");
const id = "11111111-1111-4111-8111-111111111111";
const sourceImage = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="white"/><text x="50" y="80" font-size="24">1. 2 + 3 = ?</text></svg>');
function fixture(): Conversion {
  return {
    id, title: "중산고 수학 시험지", status: "REVIEW", stage: "finish", version: 1, artifact_version: 1,
    options: { level: "explanations", grouping: "separate", redraw: false, require_review: false, external_ai_confirmed: true, subject: "수학" },
    error: "", created_at: "2026-10-14T05:00:00Z", updated_at: "2026-10-14T05:10:00Z", question_count: 1, review_count: 1,
    source_files: [{ name: "중산고_수학.pdf", size: 2048 }],
    source_archive: { url: "https://download.example/source.zip", filename: "원본.zip", mime: "application/zip" },
    document: { questions: [{ id: "q1", number: 1, source_number: 1, source_name: "중산고_수학.pdf", page_index: 0, prompt: "2와 3의 합을 구하시오.", choices: ["① 4", "② 5"], answer: "②", explanation: "2 + 3 = 5입니다.", reviewed: false, review_flags: ["정답 원본 확인"], crop: null }], pages: [{ url: sourceImage, filename: "page.png", mime: "image/svg+xml", source_name: "중산고_수학.pdf", page_number: 1 }], warnings: [] },
    artifacts: Object.fromEntries(["manuscript", "arranged", "a3"].map(kind => [kind, { url: `https://download.example/${kind}.hwpx`, filename: `${kind}.hwpx`, mime: "application/hwp+zip" }])),
  };
}

for (const width of [1366, 390]) {
  test(`시험지 변환은 검수 저장·재생성·재진입을 완료한다 (${width}px)`, async ({ page }, testInfo) => {
    test.skip(!/^http:\/\/(127\.0\.0\.1|localhost)/.test(baseUrl), "격리된 로컬 route mock 검증");
    await page.setViewportSize({ width, height: 900 });
    await installLocalAuthApiStubs(page);
    await installTenantOneInitScript(page);
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const jwt = `${encode({ alg: "none" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "hakwonplus" })}.sig`;
    await page.addInitScript(token => { localStorage.setItem("access", token); localStorage.setItem("refresh", `${token}-refresh`); }, jwt);
    let row = fixture();
    let created = false;
    let saveCount = 0;
    let resumeCount = 0;
    await page.route("**/api/v1/**", async route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
      if (path.endsWith("/staffs/me/")) return route.fulfill({ json: { is_authenticated: true, is_staff: true, is_superuser: true, is_owner: true } });
      if (path.endsWith("/staffs/currently-working/")) return route.fulfill({ json: [] });
      if (path.endsWith("/tools/problem-studio/conversions/")) {
        if (request.method() === "POST") { created = true; return route.fulfill({ status: 202, json: { ...row, status: "PENDING", stage: "source" } }); }
        return route.fulfill({ json: { conversions: created ? [row] : [] } });
      }
      if (path.endsWith(`/conversions/${id}/actions/`)) {
        const body = request.postDataJSON();
        if (body.action === "rebuild") row.artifact_version = row.version;
        if (body.action === "resume") { row.status = "REVIEW"; row.error = ""; resumeCount++; }
        return route.fulfill({ status: 202, json: row });
      }
      if (path.endsWith(`/conversions/${id}/`)) {
        if (request.method() === "PATCH") {
          const body = request.postDataJSON();
          expect(body.version).toBe(row.version);
          if (body.question) { Object.assign(row.document!.questions[0], body.question); saveCount++; }
          if (body.action === "accept" || body.action === "accept_all") { row.document!.questions[0].reviewed = true; row.review_count = 0; }
          row.version++;
        }
        return route.fulfill({ json: row });
      }
      return route.fallback();
    });
    await page.route("https://download.example/**", route => route.fulfill({ status: 200, headers: { "Content-Disposition": 'attachment; filename="review.hwpx"' }, contentType: "application/hwp+zip", body: "synthetic download; real HWPX is tested by backend" }));
    await page.goto(`${baseUrl}/workspace/tools/problem-studio`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "시험지를 올리고, 바로 편집하는 한글 문서로." })).toBeVisible();
    await expect(page.getByRole("button", { name: "변환 시작", exact: true })).toBeDisabled();
    await page.getByLabel("시험지 파일 선택").setInputFiles({ name: "중산고_수학.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 synthetic") });
    await page.getByLabel("원본을 외부 AI로 처리하는 데 동의합니다.").check();
    await page.screenshot({ path: testInfo.outputPath(`new-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: "변환 시작", exact: true }).click();
    await expect(page.getByRole("heading", { name: "확인할 문항 1개" })).toBeVisible();
    await page.getByRole("button", { name: /1번.*2와 3/ }).click();
    await expect(page.getByRole("img", { name: /원본 1쪽/ })).toBeVisible();
    await page.getByRole("textbox", { name: "문항", exact: true }).fill("2와 3을 더한 값을 구하시오. 교사 수정본");
    const refreshed = page.waitForResponse(response => response.request().method() === "GET" && new URL(response.url()).pathname.endsWith(`/conversions/${id}/`));
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await refreshed;
    await expect(page.getByRole("textbox", { name: "문항", exact: true })).toHaveValue("2와 3을 더한 값을 구하시오. 교사 수정본");
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect.poll(() => saveCount).toBe(1);
    await expect(page.getByRole("status").filter({ hasText: /^저장됨$/ })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`editor-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: "목록으로" }).click();
    await expect(page.getByRole("button", { name: /^원고본/ })).toBeDisabled();
    await page.getByRole("button", { name: "한글 문서 다시작성" }).click();
    await expect(page.getByRole("button", { name: /^원고본/ })).toBeEnabled();
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: /^원고본/ }).click();
    expect((await downloaded).suggestedFilename()).toMatch(/\.hwpx$/);
    await page.reload();
    await expect(page.getByRole("button", { name: /교사 수정본/ })).toBeVisible();
    row = { ...row, status: "FAILED", error: "AI 연결이 중단됐습니다. 원본과 수정 내용은 보관되어 있습니다." };
    await page.reload();
    await expect(page.getByRole("heading", { name: "잠시 멈췄습니다" })).toBeVisible();
    await page.getByRole("button", { name: "이어서 하기" }).click();
    await expect.poll(() => resumeCount).toBe(1);
    await expect(page.getByRole("button", { name: /교사 수정본/ })).toBeVisible();
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", await page.locator("body").evaluate(element => element.clientWidth));
    await page.screenshot({ path: testInfo.outputPath(`result-${width}.png`), fullPage: true });
  });
}
