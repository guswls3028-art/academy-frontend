import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/strictTest";

const BASE = (process.env.E2E_LANDING_BASE_URL || process.env.E2E_LOCAL_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");
const LONG_TITLE = "한글 자료 제목과 아주 긴 설명 ".repeat(8).trim();
const resource = {
  id: 901, category: "matchup", title: LONG_TITLE, content: "학생과 학부모님께 공개하는 학습 자료입니다.\n줄바꿈도 그대로 표시합니다.",
  author_display_name: "신민", created_at: "2026-10-02T01:00:00Z", updated_at: "2026-10-02T01:00:00Z",
  files: [{ id: "f-pdf", filename: "교정한 매치업 보고서.PDF", extension: "pdf", size: 2048 }, { id: "f-hwp", filename: "분석 자료.HWP", extension: "hwp", size: 4096 }, { id: "f-hwpx", filename: "가공한 분석자료.HWPX", extension: "hwpx", size: 4096 }],
};

function pdfBytes() {
  const stream = "BT /F1 18 Tf 50 750 Td (QA PUBLIC RESOURCE) Tj ET\n";
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>", `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  let text = "%PDF-1.4\n"; const offsets = [0];
  for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(text)); text += `${index + 1} 0 obj\n${object}\nendobj\n`; }
  const xref = Buffer.byteLength(text);
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(text);
}

// Native browser downloads do not reliably use Page.route interception.
// Serve the generated fixture over real loopback HTTP and verify its bytes.
let documentUrl = "";
let resourceScenario: { empty?: boolean; paged?: boolean; unavailable: boolean } = { unavailable: false };
const documentServer = createServer((request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  const cors = { "Access-Control-Allow-Origin": request.headers.origin || "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": request.headers["access-control-request-headers"] || "content-type, x-tenant-code, authorization" };
  if (request.method === "OPTIONS") { response.writeHead(204, cors); response.end(); return; }
  if (url.pathname.startsWith("/api/v1/landing-public/")) {
    let body: unknown = { detail: "Closed resource fixture: unmatched API" }; let status = 404;
    if (url.pathname.endsWith("/resources/capabilities/")) { body = { can_publish: false }; status = 200; }
    else if (url.pathname.endsWith("/resources/901/")) { body = resource; status = 200; }
    else if (url.pathname.includes("/resource-files/")) { body = { url: documentUrl, expires_in: 300 }; status = 200; }
    else if (url.pathname.endsWith("/resources/")) {
      if (resourceScenario.unavailable && url.searchParams.get("category") === "matchup") { body = { detail: "qa transient failure" }; status = 503; }
      else if (resourceScenario.paged && url.searchParams.get("category") === "matchup") {
        const secondPage = url.searchParams.get("page") === "2";
        const ids = secondPage ? [920, 921] : Array.from({ length: 20 }, (_, index) => 901 + index);
        body = { count: 21, next: secondPage ? null : "?page=2", previous: null, results: ids.map((id) => ({ ...resource, id, title: `QA 자료 ${id}` })) }; status = 200;
      } else {
        const results = resourceScenario.empty ? [] : [{ ...resource, category: url.searchParams.get("category"), id: url.searchParams.get("category") === "analysis" ? 902 : 901 }];
        body = { count: results.length, next: null, previous: null, results }; status = 200;
      }
    }
    response.writeHead(status, { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" }); response.end(JSON.stringify(body)); return;
  }
  if (url.pathname !== "/qa-resource.pdf") { response.writeHead(404); response.end(); return; }
  const bytes = pdfBytes();
  response.writeHead(200, {
    "Content-Type": "application/pdf", "Content-Length": bytes.length,
    "Content-Disposition": `attachment; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(resource.files[0].filename)}`,
    "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store",
  });
  response.end(bytes);
});
test.beforeAll(async () => {
  await new Promise<void>((resolve) => documentServer.listen(0, "127.0.0.1", resolve));
  const address = documentServer.address();
  if (!address || typeof address === "string") throw new Error("QA document server failed");
  documentUrl = `http://127.0.0.1:${address.port}/qa-resource.pdf`;
});
test.afterAll(async () => { await new Promise<void>((resolve, reject) => documentServer.close((error) => error ? reject(error) : resolve())); });

async function prepare(page: Page, options: { empty?: boolean; failOnce?: boolean; paged?: boolean } = {}) {
  await page.addInitScript(() => { localStorage.setItem("tenant_code", "godmin"); sessionStorage.setItem("tenantCode", "godmin"); });
  resourceScenario = { ...options, unavailable: Boolean(options.failOnce) };
  // Use physical loopback HTTP for resource XHRs on both engines. WebKit's
  // interception does not cover these requests in the Linux browser runtime.
  await page.addInitScript(({ origin }) => {
    const nativeOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, value, ...rest) {
      const url = new URL(String(value), location.href);
      const target = url.pathname.startsWith("/api/v1/landing-public/") ? `${origin}${url.pathname}${url.search}` : value;
      return Reflect.apply(nativeOpen, this, [method, target, ...rest]);
    };
  }, { origin: new URL(documentUrl).origin });
  await page.context().route(/\/api\/v1\//, async (route) => {
    const url = new URL(route.request().url()); const path = url.pathname;
    if (url.origin === new URL(documentUrl).origin) return route.continue();
    const headers = { "Access-Control-Allow-Origin": new URL(BASE).origin, "Access-Control-Allow-Credentials": "true" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: {
      ...headers, "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": route.request().headers()["access-control-request-headers"] || "content-type, x-tenant-code, authorization",
    } });
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(body) });
    if (path.includes("/core/program/")) return json({ tenantCode: "godmin", display_name: "신과함께", ui_config: { login_title: "신과함께" }, feature_flags: {}, is_active: true });
    if (path.includes("/core/landing/has-published/")) return json({ has_published: false });
    return json({ detail: "Closed resource-board mock: unmatched API" }, 404);
  });
  return () => { resourceScenario.unavailable = false; };
}

for (const width of [1366, 390]) {
  test(`anonymous home → two categories → detail → PDF canvas and download at ${width}px`, async ({ page }, testInfo) => {
    await prepare(page); await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/landing`);
    await page.getByRole("link", { name: "매치업 · 분석자료", exact: true }).click();
    await expect(page.getByRole("heading", { name: "매치업 · 분석자료", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "매치업", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "분석자료", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "자료 올리기", exact: true })).toHaveCount(0);
    const matchup = await page.getByRole("heading", { name: "매치업", exact: true }).boundingBox();
    const analysis = await page.getByRole("heading", { name: "분석자료", exact: true }).boundingBox();
    expect(matchup).not.toBeNull(); expect(analysis).not.toBeNull();
    if (width === 1366) expect(Math.abs((matchup?.y ?? 0) - (analysis?.y ?? 0))).toBeLessThan(2);
    else expect(analysis?.y ?? 0).toBeGreaterThan(matchup?.y ?? 0);
    await page.screenshot({ path: testInfo.outputPath(`resources-${width}.png`), fullPage: true });
    await page.getByRole("link", { name: LONG_TITLE }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: LONG_TITLE })).toBeVisible();
    await expect(page.getByText("HWP·HWPX는 내려받은 뒤 한글 또는 호환 프로그램에서 열어주세요.")).toBeVisible();
    await page.reload(); await expect(page.getByRole("heading", { level: 1, name: LONG_TITLE })).toBeVisible();
    await page.getByRole("button", { name: "PDF 미리보기", exact: true }).click();
    await expect(page.locator('[data-testid="matchup-pdf-page"][data-render-status="ready"]')).toHaveCount(1, { timeout: 90_000 });
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "원본 다운로드", exact: true }).first().click();
    const download = await downloadPromise; expect(await download.failure()).toBeNull();
    expect(download.suggestedFilename()).toBe(resource.files[0].filename);
    const downloadPath = await download.path(); expect(downloadPath).not.toBeNull();
    await download.saveAs(testInfo.outputPath("downloaded-qa-resource.pdf"));
    const downloadedBytes = await readFile(downloadPath!);
    expect(downloadedBytes.subarray(0, 8).toString()).toBe("%PDF-1.4");
    expect(downloadedBytes.equals(pdfBytes())).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`resource-pdf-${width}.png`), fullPage: true });
  });

  test(`login homepage entry stays left of find-ID when generic landing is unpublished at ${width}px`, async ({ page }) => {
    await prepare(page); await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/login/godmin`);
    const home = page.getByRole("link", { name: "홈페이지", exact: true });
    const findId = page.getByRole("button", { name: "아이디 찾기", exact: true });
    await expect(home).toBeVisible(); await expect(findId).toBeVisible();
    const homeBox = await home.boundingBox(); const idBox = await findId.boundingBox();
    expect(homeBox?.x ?? 0).toBeLessThan(idBox?.x ?? 0);
    await home.click(); await expect(page.getByRole("heading", { name: "복잡한 과학을, 이해되는 구조로." })).toBeVisible();
  });
}

test("empty categories and anonymous direct write have clear recovery", async ({ page }) => {
  await prepare(page, { empty: true }); await page.goto(`${BASE}/landing/resources`);
  await expect(page.getByText("아직 등록된 자료가 없습니다", { exact: true })).toHaveCount(2);
  await page.goto(`${BASE}/landing/resources/write`);
  await expect(page.getByText("지정된 두 게시자만 자료를 올릴 수 있습니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "게시하기", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "자료게시판 보기", exact: true }).click();
  await expect(page).toHaveURL(/\/landing\/resources$/);
});

test("a failed public list keeps the other category usable and retries successfully", async ({ page }) => {
  const recover = await prepare(page, { failOnce: true }); await page.goto(`${BASE}/landing/resources`);
  await expect(page.getByRole("alert")).toContainText("자료를 불러오지 못했습니다.");
  await expect(page.getByRole("heading", { name: LONG_TITLE })).toHaveCount(1);
  recover();
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.getByRole("heading", { name: LONG_TITLE })).toHaveCount(2);
  await expect(page.getByRole("alert")).toHaveCount(0);
});


test("paging keeps a concurrently shifted post unique", async ({ page }) => {
  await prepare(page, { paged: true }); await page.goto(`${BASE}/landing/resources`);
  const matchup = page.getByRole("region", { name: "매치업", exact: true });
  await expect(matchup.getByRole("heading", { level: 3 })).toHaveCount(20);
  await matchup.getByRole("button", { name: "자료 더 보기", exact: true }).click();
  await expect(matchup.getByRole("heading", { level: 3 })).toHaveCount(21);
  await expect(matchup.getByRole("heading", { name: "QA 자료 920", exact: true })).toHaveCount(1);
  await expect(matchup.getByRole("button", { name: "자료 더 보기", exact: true })).toHaveCount(0);
});
