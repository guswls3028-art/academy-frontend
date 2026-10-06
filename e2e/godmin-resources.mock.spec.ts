import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/strictTest";

const BASE = (process.env.E2E_LANDING_BASE_URL || process.env.E2E_LOCAL_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");
const LONG_TITLE = "한글 자료 제목과 아주 긴 설명 ".repeat(8).trim();
const resource = {
  id: 901, category: "matchup", title: LONG_TITLE, content: "학생과 학부모님께 공개하는 학습 자료입니다.\n줄바꿈도 그대로 표시합니다.",
  author_display_name: "신민", created_at: "2026-10-02T01:00:00Z", updated_at: "2026-10-02T01:00:00Z",
  files: [{ id: "f-pdf", filename: "교정한 매치업 보고서.PDF", extension: "pdf", size: 2048, reader_status: "ready" }, { id: "f-hwp", filename: "분석 자료.HWP", extension: "hwp", size: 4096, reader_status: "ready" }, { id: "f-hwpx", filename: "가공한 분석자료.HWPX", extension: "hwpx", size: 4096, reader_status: "ready" }],
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
type ResourceScenario = { readerFailure?: boolean; readerPending?: boolean; empty?: boolean; paged?: boolean; unavailable: boolean; publisher?: boolean; actorId?: number; post?: typeof resource; cleanupFailure?: boolean; conflict?: boolean; lostDeleteResponse?: boolean; deleted?: boolean; lostPublishResponse?: boolean; publishedRequest?: string; tenant?: string };
let resourceScenario: ResourceScenario = { unavailable: false };
const uploaded = new Map<string, { file: typeof resource.files[number]; bytes: Buffer }>();
let uploadCount = 0; let deleteCount = 0;
const cleaned: string[] = [];
const patchPayloads: Array<{ expected_updated_at?: string; title: string }> = [];
let uploadBody = Buffer.alloc(0); const createPayloads: Array<{ request_id: string; title: string; category: string; content: string; file_ids: string[] }> = [];
const documentServer = createServer((request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  const cors = { "Access-Control-Allow-Origin": new URL(BASE).origin, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS", "Access-Control-Allow-Headers": request.headers["access-control-request-headers"] || "content-type, x-tenant-code, authorization" };
  if (request.method === "OPTIONS") { response.writeHead(204, cors); response.end(); return; }
  if (url.pathname === "/api/v1/core/program/" && request.method === "GET") {
    response.writeHead(200, { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ tenantCode: resourceScenario.tenant || "godmin", display_name: resourceScenario.tenant === "tchul" ? "천안학원" : "신과함께", ui_config: {}, feature_flags: {}, is_active: true })); return;
  }
  if (url.pathname === "/api/v1/core/landing/has-published/" && request.method === "GET") {
    response.writeHead(200, { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ has_published: false })); return;
  }
  if (url.pathname === "/api/v1/core/me/") {
    response.writeHead(200, { ...cors, "Content-Type": "application/json" });
    response.end(JSON.stringify({ id: resourceScenario.actorId || 501, username: "qa-resource-publisher", name: "QA 게시자", is_staff: true, is_superuser: false, tenantRole: "owner", must_change_password: false, first_login_guide_required: false })); return;
  }
  if (url.pathname === "/api/v1/landing-public/uploads/resource/" && request.method === "POST") {
    const chunks: Buffer[] = []; request.on("data", (chunk: Buffer) => chunks.push(chunk)); request.on("end", () => {
      uploadBody = Buffer.concat(chunks); response.writeHead(201, { ...cors, "Content-Type": "application/json" });
      const filename = /filename="([^"]+)"/.exec(uploadBody.toString())?.[1] || "unknown";
      const start = uploadBody.indexOf("\r\n\r\n") + 4;
      const bytes = uploadBody.subarray(start, uploadBody.lastIndexOf("\r\n--"));
      const file = { id: `07b9f486-cbef-427a-a5fd-5f5ae269b${143 + uploadCount++}`, filename, extension: filename.includes(".") ? filename.split(".").at(-1)!.toLowerCase() : "", size: bytes.length, reader_status: /\.(pdf|hwp|hwpx|txt|md|png|jpe?g|webp)$/i.test(filename) ? "ready" : "unsupported" };
      uploaded.set(file.id, { file, bytes });
      response.end(JSON.stringify(file));
    }); return;
  }
  if (url.pathname.endsWith("/resources/") && request.method === "POST") {
    const chunks: Buffer[] = []; request.on("data", (chunk: Buffer) => chunks.push(chunk)); request.on("end", () => {
      const input = JSON.parse(Buffer.concat(chunks).toString()) as typeof createPayloads[number]; createPayloads.push(input);
      if (resourceScenario.publishedRequest === input.request_id && resourceScenario.post) {
        response.writeHead(409, { ...cors, "Content-Type": "application/json" });
        response.end(JSON.stringify({ detail: "앞선 요청으로 이미 게시된 자료입니다. 입력한 변경 내용은 유지됩니다.", post_id: resourceScenario.post.id, updated_at: resourceScenario.post.updated_at, file_ids: resourceScenario.post.files.map((file) => file.id), published_title: resourceScenario.post.title, published_content: resourceScenario.post.content, published_filenames: resourceScenario.post.files.map((file) => file.filename) })); return;
      }
      resourceScenario.post = { ...resource, title: input.title, content: input.content, files: input.file_ids.map((id) => uploaded.get(id)?.file || resource.files.find((file) => file.id === id)!) };
      if (resourceScenario.lostPublishResponse) {
        resourceScenario.lostPublishResponse = false; resourceScenario.publishedRequest = input.request_id;
        response.writeHead(503, { ...cors, "Content-Type": "application/json" }); response.end(JSON.stringify({ detail: "QA 게시 응답 확인 실패" })); return;
      }
      response.writeHead(201, { ...cors, "Content-Type": "application/json" }); response.end(JSON.stringify(resourceScenario.post));
    }); return;
  }
  if (url.pathname.endsWith("/resources/901/") && request.method === "DELETE") {
    deleteCount++;
    if (resourceScenario.deleted) {
      response.writeHead(404, { ...cors, "Content-Type": "application/json" }); response.end(JSON.stringify({ detail: "Not found" })); return;
    }
    resourceScenario.deleted = true; resourceScenario.empty = true;
    if (resourceScenario.lostDeleteResponse) {
      response.writeHead(503, { ...cors, "Content-Type": "application/json" }); response.end(JSON.stringify({ detail: "QA 삭제 응답 확인 실패" })); return;
    }
    response.writeHead(204, cors); response.end(); return;
  }
  if (url.pathname.endsWith("/resources/901/") && request.method === "GET" && resourceScenario.deleted) {
    response.writeHead(404, { ...cors, "Content-Type": "application/json" }); response.end(JSON.stringify({ detail: "Not found" })); return;
  }
  if (url.pathname.endsWith("/resources/901/") && request.method === "PATCH") {
    const chunks: Buffer[] = []; request.on("data", (chunk: Buffer) => chunks.push(chunk)); request.on("end", () => {
      const input = JSON.parse(Buffer.concat(chunks).toString()); patchPayloads.push(input);
      if (resourceScenario.conflict) {
        resourceScenario.conflict = false;
        resourceScenario.post = { ...resource, title: "다른 게시자의 최신 내용", updated_at: "2026-10-06T01:00:00Z" };
        response.writeHead(409, { ...cors, "Content-Type": "application/json" });
        response.end(JSON.stringify({ detail: "다른 게시자가 이 자료를 수정했습니다. 입력한 내용은 유지됩니다." })); return;
      }
      resourceScenario.post = { ...resource, ...input, files: input.file_ids.map((id: string) => uploaded.get(id)?.file || resource.files.find((file) => file.id === id)!), updated_at: "2026-10-06T02:00:00Z" };
      response.writeHead(200, { ...cors, "Content-Type": "application/json" }); response.end(JSON.stringify(resourceScenario.post));
    }); return;
  }
  if (url.pathname.includes("/resource-files/") && request.method === "DELETE") {
    const id = url.pathname.split("/").filter(Boolean).at(-1)!;
    if (!uploaded.has(id) || resourceScenario.post?.files.some((file) => file.id === id)) {
      response.writeHead(404, { ...cors, "Content-Type": "application/json" }); response.end(JSON.stringify({ detail: "No pending upload" })); return;
    }
    if (resourceScenario.cleanupFailure && cleaned.length === 1) {
      resourceScenario.cleanupFailure = false;
      response.writeHead(503, { ...cors, "Content-Type": "application/json" }); response.end(JSON.stringify({ detail: "QA 첨부 정리 일시 실패" })); return;
    }
    cleaned.push(id); uploaded.delete(id); response.writeHead(204, cors); response.end(); return;
  }
  if (url.pathname.startsWith("/api/v1/landing-public/")) {
    let body: unknown = { detail: "Closed resource fixture: unmatched API" }; let status = 404;
    if (url.pathname.endsWith("/resources/capabilities/")) { body = { can_publish: Boolean(resourceScenario.publisher) }; status = 200; }
    else if (url.pathname.endsWith("/resources/901/")) { body = resourceScenario.post || resource; status = 200; }
    else if (/\/resource-files\/[^/]+\/reader\/$/.test(url.pathname)) {
      const id = url.pathname.split("/").filter(Boolean).at(-2)!;
      const file = uploaded.get(id)?.file || resource.files.find((item) => item.id === id);
      if (request.method === "POST" && resourceScenario.readerFailure) {
        resourceScenario.readerFailure = false; resourceScenario.readerPending = true;
        body = { status: "pending" };
      } else if (resourceScenario.readerPending) {
        resourceScenario.readerPending = false;
        body = { status: "ready", mode: "pages", blocks: [], pdf_url: documentUrl };
      } else if (resourceScenario.readerFailure) body = { status: "failed", message: "본문을 준비하지 못했습니다. 원본은 보존됩니다." };
      else body = file?.reader_status === "unsupported" ? { status: "unsupported" }
        : { status: "ready", mode: "pages", blocks: [], pdf_url: `${documentUrl}?reader=${id}` }; status = 200;
    }
    else if (url.pathname.includes("/resource-files/")) { body = { url: `${documentUrl}?file=${url.pathname.split("/").filter(Boolean).at(-1)}`, expires_in: 300 }; status = 200; }
    else if (url.pathname.endsWith("/resources/")) {
      if (resourceScenario.unavailable && url.searchParams.get("category") !== "analysis") { body = { detail: "qa transient failure" }; status = 503; }
      else if (resourceScenario.paged && url.searchParams.get("category") !== "analysis") {
        const secondPage = url.searchParams.get("page") === "2";
        const ids = secondPage ? [920, 921] : Array.from({ length: 20 }, (_, index) => 901 + index);
        body = { count: 21, next: secondPage ? null : "?page=2", previous: null, results: ids.map((id) => ({ ...resource, id, title: `QA 자료 ${id}` })) }; status = 200;
      } else {
        const results = resourceScenario.empty ? [] : [{ ...resource, category: url.searchParams.get("category") || "matchup", id: url.searchParams.get("category") === "analysis" ? 902 : 901 }];
        body = { count: results.length, next: null, previous: null, results }; status = 200;
      }
    }
    response.writeHead(status, { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" }); response.end(JSON.stringify(body)); return;
  }
  if (url.pathname !== "/qa-resource.pdf") { response.writeHead(404); response.end(); return; }
  // Reader PDFs are derived output; only original-download URLs return uploaded source bytes.
  const original = uploaded.get(url.searchParams.get("file") || "");
  const bytes = original?.bytes || pdfBytes();
  response.writeHead(200, {
    "Content-Type": original ? "application/octet-stream" : "application/pdf", "Content-Length": bytes.length,
    "Content-Disposition": `attachment; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(original?.file.filename || resource.files[0].filename)}`,
    "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store",
  });
  response.end(bytes);
});
test.beforeAll(async () => {
  if (!["localhost", "127.0.0.1"].includes(new URL(BASE).hostname)) throw new Error("Resource fixture requires a loopback checkout origin");
  await new Promise<void>((resolve) => documentServer.listen(0, "127.0.0.1", resolve));
  const address = documentServer.address();
  if (!address || typeof address === "string") throw new Error("QA document server failed");
  documentUrl = `http://127.0.0.1:${address.port}/qa-resource.pdf`;
});
test.afterAll(async () => { await new Promise<void>((resolve, reject) => documentServer.close((error) => error ? reject(error) : resolve())); });

async function prepare(page: Page, options: { readerFailure?: boolean; readerPending?: boolean; empty?: boolean; failOnce?: boolean; paged?: boolean; publisher?: boolean; actorId?: number; cleanupFailure?: boolean; conflict?: boolean; lostDeleteResponse?: boolean; deleted?: boolean; lostPublishResponse?: boolean; publishedRequest?: string; tenant?: string } = {}) {
  await page.addInitScript((tenant) => { localStorage.setItem("tenant_code", tenant); sessionStorage.setItem("tenantCode", tenant); }, options.tenant || "godmin");
  resourceScenario = { ...options, unavailable: Boolean(options.failOnce) }; uploadBody = Buffer.alloc(0); createPayloads.length = 0; uploaded.clear(); uploadCount = 0; deleteCount = 0; cleaned.length = 0; patchPayloads.length = 0;
  if (options.publisher) {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const jwt = `${encode({ alg: "none" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "godmin", user_id: options.actorId || 501 })}.sig`;
    await page.addInitScript((token) => { localStorage.setItem("access", token); localStorage.setItem("refresh", `${token}-refresh`); }, jwt);
  }
  // Use physical loopback HTTP for bootstrap and resource XHRs on both engines. WebKit's
  // interception does not cover these requests in the Linux browser runtime.
  await page.addInitScript(({ origin }) => {
    const nativeOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, value, ...rest) {
      const url = new URL(String(value), location.href);
      const target = (url.pathname.startsWith("/api/v1/landing-public/") || ["/api/v1/core/me/", "/api/v1/core/program/", "/api/v1/core/landing/has-published/"].includes(url.pathname)) ? `${origin}${url.pathname}${url.search}` : value;
      return Reflect.apply(nativeOpen, this, [method, target, ...rest]);
    };
  }, { origin: new URL(documentUrl).origin });
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(documentUrl).origin) return route.continue();
    const headers = { "Access-Control-Allow-Origin": new URL(BASE).origin, "Access-Control-Allow-Credentials": "true" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: {
      ...headers, "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": route.request().headers()["access-control-request-headers"] || "content-type, x-tenant-code, authorization",
    } });
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(body) });
    return json({ detail: "Closed resource-board mock: unmatched API" }, 404);
  });
  return () => { resourceScenario.unavailable = false; };
}

for (const width of [1366, 390]) {
  test(`anonymous home → two categories → detail → PDF canvas and download at ${width}px`, async ({ page }, testInfo) => {
    await prepare(page); await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/landing`);
    await page.getByRole("link", { name: "매치업 · 분석자료", exact: true }).click();
    await expect(page.getByRole("heading", { name: "게시판", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "매치업", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "분석자료", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "글 올리기", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "분석자료", exact: true }).click();
    await expect(page.getByRole("button", { name: "분석자료", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "매치업", exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath(`resources-${width}.png`), fullPage: true });
    await page.getByRole("link", { name: LONG_TITLE }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: LONG_TITLE })).toBeVisible();
    await page.reload(); await expect(page.getByRole("heading", { level: 1, name: LONG_TITLE })).toBeVisible();
    await expect(page).toHaveTitle(`${LONG_TITLE} | 신과함께`);
    await expect(page.getByRole("button", { name: "PDF 미리보기", exact: true })).toHaveCount(0);
    await page.getByRole("region", { name: `${resource.files[0].filename} 본문`, exact: true }).scrollIntoViewIfNeeded();
    for (const file of resource.files) {
      const document = page.getByRole("region", { name: `${file.filename} 본문`, exact: true });
      await document.scrollIntoViewIfNeeded();
      await expect(document.locator('[data-testid="matchup-pdf-page"][data-render-status="ready"]')).toHaveCount(1, { timeout: 90_000 });
    }
    const reader = page.getByRole("region", { name: `${resource.files[0].filename} 본문`, exact: true });
    await reader.scrollIntoViewIfNeeded();
    for (let zoom = 100; zoom < 300; zoom += 25) await reader.getByRole("button", { name: "문서 확대", exact: true }).click();
    await expect(reader.getByRole("button", { name: "문서 확대", exact: true })).toBeDisabled();
    await expect(reader.locator('[data-render-status="ready"]')).toHaveCount(1);
    const pixels = await reader.locator("canvas").evaluate((canvas) => (canvas as HTMLCanvasElement).width * (canvas as HTMLCanvasElement).height);
    expect(pixels).toBeGreaterThan(1); expect(pixels).toBeLessThanOrEqual(16_000_000);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    for (let zoom = 300; zoom > 100; zoom -= 25) await reader.getByRole("button", { name: "문서 축소", exact: true }).click();
    await page.getByText("원본 파일 · 3개", { exact: true }).click();
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
  await page.addInitScript(() => { Object.defineProperty(crypto, "randomUUID", { configurable: true, value: undefined }); });
  await prepare(page, { empty: true }); await page.goto(`${BASE}/landing/resources`);
  await expect(page.getByText("아직 등록된 글이 없습니다", { exact: true })).toHaveCount(1);
  await page.goto(`${BASE}/landing/resources/write`);
  await expect(page.getByText("지정된 두 게시자만 자료를 올릴 수 있습니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "게시하기", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "자료게시판 보기", exact: true }).click();
  await expect(page).toHaveURL(/\/landing\/resources$/);
});

test("a failed public list can switch categories and retry successfully", async ({ page }) => {
  const recover = await prepare(page, { failOnce: true }); await page.goto(`${BASE}/landing/resources`);
  await expect(page.getByRole("alert")).toContainText("글을 불러오지 못했습니다.");
  await page.getByRole("button", { name: "분석자료", exact: true }).click();
  await expect(page.getByRole("heading", { name: LONG_TITLE })).toHaveCount(1);
  await page.getByRole("button", { name: "전체", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible(); recover();
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.getByRole("heading", { name: LONG_TITLE })).toHaveCount(1);
  await expect(page.getByRole("alert")).toHaveCount(0);
});


test("paging keeps a concurrently shifted post unique", async ({ page }) => {
  await prepare(page, { paged: true }); await page.goto(`${BASE}/landing/resources`);
  const matchup = page.getByRole("region", { name: "게시글 목록", exact: true });
  await expect(matchup.getByRole("heading", { level: 2 })).toHaveCount(20);
  await matchup.getByRole("button", { name: "글 더 보기", exact: true }).click();
  await expect(matchup.getByRole("heading", { level: 2 })).toHaveCount(21);
  await expect(matchup.getByRole("heading", { name: "QA 자료 920", exact: true })).toHaveCount(1);
  await expect(matchup.getByRole("button", { name: "글 더 보기", exact: true })).toHaveCount(0);
});

for (const [width, actorId] of [[1366, 501], [390, 502]] as const) {
  test(`publisher ${actorId} uploads actual multipart PDF and publishes then reloads at ${width}px`, async ({ page }, testInfo) => {
    await prepare(page, { publisher: true, actorId }); await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/landing/resources`);
    await page.getByRole("link", { name: "글 올리기", exact: true }).click();
    await page.getByLabel("제목", { exact: true }).fill("QA 교정 보고서");
    await expect(page.getByRole("textbox", { name: "본문", exact: true })).toHaveValue("");
    const input = page.getByLabel("첨부 자료", { exact: true });
    await input.setInputFiles({ name: "empty.xlsx", mimeType: "application/octet-stream", buffer: Buffer.alloc(0) });
    await expect(page.getByText("비어 있지 않은 30MB 이하의 파일을 선택해주세요.", { exact: true })).toBeVisible();
    expect(uploadBody.length).toBe(0);
    await input.setInputFiles({ name: resource.files[0].filename, mimeType: "application/pdf", buffer: pdfBytes() });
    await expect(page.getByText(resource.files[0].filename, { exact: true })).toBeVisible();
    expect(uploadBody.includes(pdfBytes())).toBe(true);
    await expect(page.getByRole("button", { name: "게시하기", exact: true })).toBeEnabled();
    await page.getByRole("heading", { name: "글 올리기", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`file-only-writer-${width}.png`) });
    await page.getByRole("button", { name: "게시하기", exact: true }).click();
    await expect(page.getByRole("heading", { name: "QA 교정 보고서", exact: true })).toBeVisible();
    expect(createPayloads).toHaveLength(1);
    expect(createPayloads[0].content).toBe("");
    expect(createPayloads[0].request_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(createPayloads[0].file_ids).toEqual(["07b9f486-cbef-427a-a5fd-5f5ae269b143"]);
    const publishedDocument = page.getByRole("region", { name: `${resource.files[0].filename} 본문`, exact: true });
    await publishedDocument.scrollIntoViewIfNeeded();
    await expect(publishedDocument.locator('[data-testid="matchup-pdf-page"][data-render-status="ready"]')).toHaveCount(1, { timeout: 60_000 });
    await expect(page.getByRole("link", { name: "수정", exact: true })).toBeVisible();
    await page.reload(); await expect(page.getByRole("heading", { name: "QA 교정 보고서", exact: true })).toBeVisible();
    await publishedDocument.scrollIntoViewIfNeeded();
    await expect(publishedDocument.locator('[data-testid="matchup-pdf-page"][data-render-status="ready"]')).toHaveCount(1, { timeout: 60_000 });
    await expect(page.getByRole("link", { name: "수정", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}
for (const width of [1366, 390]) {
  test(`arbitrary originals publish and download byte-for-byte at ${width}px`, async ({ page }, testInfo) => {
    await prepare(page, { publisher: true }); await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/landing/resources/write`);
    const category = width === 390 ? "analysis" : "matchup";
    await page.getByLabel("분류", { exact: true }).selectOption(category);
    await page.getByLabel("제목", { exact: true }).fill("모든 형식의 원본 자료");
    await page.getByRole("textbox", { name: "본문", exact: true }).fill("방문자가 바로 읽는 분석 내용입니다.");
    const originals = ["분석.xlsx", "발표.pptx", "원본.zip", "README", "자료.아주긴확장자"].map((name) => ({ name, mimeType: "application/octet-stream", buffer: Buffer.from(`QA original ${name}`) }));
    await page.getByLabel("첨부 자료", { exact: true }).setInputFiles(originals);
    await expect(page.getByRole("button", { name: "게시하기", exact: true })).toBeEnabled();
    await expect(page.getByText(originals[4].name, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "게시하기", exact: true }).click();
    await expect(page.getByRole("heading", { name: "모든 형식의 원본 자료", exact: true })).toBeVisible();
    expect(createPayloads[0].category).toBe(category);
    await page.reload();
    await page.getByText("원본 파일 · 5개", { exact: true }).click();
    for (const [index, original] of originals.entries()) {
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "원본 다운로드", exact: true }).nth(index).click();
      const download = await downloadPromise; expect(await download.failure()).toBeNull();
      expect(download.suggestedFilename()).toBe(original.name);
      expect(await readFile((await download.path())!)).toEqual(original.buffer);
    }
    await expect(page.getByRole("button", { name: "PDF 미리보기", exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`all-formats-${width}.png`), fullPage: true });
  });
}

test("partial cancel removes only cleaned files and allows retry without missing attachments", async ({ page }) => {
  await prepare(page, { publisher: true, cleanupFailure: true });
  await page.goto(`${BASE}/landing/resources/write`);
  await page.getByLabel("제목", { exact: true }).fill("정리 실패 중에도 보존할 내용");
    await page.getByRole("textbox", { name: "본문", exact: true }).fill("방문자가 바로 읽는 분석 내용입니다.");
  await page.getByLabel("첨부 자료", { exact: true }).setInputFiles(["first.xlsx", "second.pptx"].map((name) => ({ name, mimeType: "application/octet-stream", buffer: Buffer.from("QA original") })));
  await expect(page.getByText("second.pptx", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "← 돌아가기", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("QA 첨부 정리 일시 실패");
  await expect(page.getByText("first.xlsx", { exact: true })).toHaveCount(0);
  await expect(page.getByText("second.pptx", { exact: true })).toBeVisible();
  await expect(page.getByLabel("제목", { exact: true })).toHaveValue("정리 실패 중에도 보존할 내용");
  await expect(page.getByRole("button", { name: "게시하기", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "second.pptx 첨부 취소", exact: true }).click();
  await expect(page.getByText("second.pptx", { exact: true })).toHaveCount(0);
  await page.getByLabel("첨부 자료", { exact: true }).setInputFiles({ name: "replacement.zip", mimeType: "application/octet-stream", buffer: Buffer.from("replacement") });
  await expect(page.getByText("replacement.zip", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "게시하기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "정리 실패 중에도 보존할 내용", exact: true })).toBeVisible();
  expect(createPayloads[0].file_ids).toHaveLength(1); expect(cleaned).toHaveLength(2);
});

test("conflicting edit retains draft, reloads latest explicitly, and saves with current version", async ({ page }) => {
  await prepare(page, { publisher: true, conflict: true });
  await page.goto(`${BASE}/landing/resources/901/edit`);
  await page.getByLabel("제목", { exact: true }).fill("보존할 수정 초안");
  await page.getByRole("button", { name: "수정 내용 게시", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("다른 게시자가");
  await expect(page.getByLabel("제목", { exact: true })).toHaveValue("보존할 수정 초안");
  expect(patchPayloads[0].expected_updated_at).toBe(resource.updated_at);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "최신 내용으로 다시 편집", exact: true }).click();
  await expect(page.getByLabel("제목", { exact: true })).toHaveValue("다른 게시자의 최신 내용");
  await page.getByLabel("제목", { exact: true }).fill("최신 내용을 반영한 수정");
  await page.getByRole("button", { name: "수정 내용 게시", exact: true }).click();
  await expect(page.getByRole("heading", { name: "최신 내용을 반영한 수정", exact: true })).toBeVisible();
  expect(patchPayloads[1].expected_updated_at).toBe("2026-10-06T01:00:00Z");
  await page.reload(); await expect(page.getByRole("heading", { name: "최신 내용을 반영한 수정", exact: true })).toBeVisible();
});

test("tchul uses the current tenant brand on the shared public board", async ({ page }) => {
  await prepare(page, { tenant: "tchul" }); await page.goto(`${BASE}/landing/resources`);
  await expect(page.getByRole("link", { name: "천안학원 게시판" })).toBeVisible();
  await expect(page.getByText("신과함께", { exact: true })).toHaveCount(0);
});

test("lost publish acknowledgement recovers as an edit without duplicate posts or deleted originals", async ({ page }) => {
  await prepare(page, { publisher: true, lostPublishResponse: true });
  await page.goto(`${BASE}/landing/resources/write`);
  await page.getByLabel("제목", { exact: true }).fill("최초 게시 내용");
    await page.getByRole("textbox", { name: "본문", exact: true }).fill("방문자가 바로 읽는 분석 내용입니다.");
  await page.getByLabel("첨부 자료", { exact: true }).setInputFiles({ name: "original.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from("original") });
  await expect(page.getByText("original.xlsx", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "게시하기", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("QA 게시 응답 확인 실패");
  await page.getByLabel("제목", { exact: true }).fill("응답 유실 뒤 수정할 내용");
  await page.getByRole("button", { name: "게시하기", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("앞선 요청으로 이미 게시된");
  await expect(page.getByRole("alert")).not.toContainText("2026-");
  await expect(page.locator("details").filter({ hasText: "이미 게시된 내용과 비교" })).toContainText("최초 게시 내용");
  await expect(page.getByLabel("제목", { exact: true })).toHaveValue("응답 유실 뒤 수정할 내용");
  await page.getByRole("button", { name: "수정 내용 게시", exact: true }).click();
  await expect(page.getByRole("heading", { name: "응답 유실 뒤 수정할 내용", exact: true })).toBeVisible();
  await page.reload(); await page.getByText("원본 파일 · 1개", { exact: true }).click(); await expect(page.getByText("original.xlsx", { exact: true })).toBeVisible();
  expect(createPayloads).toHaveLength(2); expect(createPayloads[0].request_id).toBe(createPayloads[1].request_id);
  expect(patchPayloads).toHaveLength(1); expect(cleaned).toHaveLength(0);
});

test("cancel after a lost publish response preserves published originals and returns to the board", async ({ page }) => {
  await prepare(page, { publisher: true, lostPublishResponse: true });
  await page.goto(`${BASE}/landing/resources/write`);
  await page.getByLabel("제목", { exact: true }).fill("이미 게시된 원본 보존");
    await page.getByRole("textbox", { name: "본문", exact: true }).fill("방문자가 바로 읽는 분석 내용입니다.");
  await page.getByLabel("첨부 자료", { exact: true }).setInputFiles({ name: "published.zip", mimeType: "application/octet-stream", buffer: Buffer.from("original") });
  await expect(page.getByText("published.zip", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "게시하기", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("QA 게시 응답 확인 실패");
  await page.getByRole("button", { name: "← 돌아가기", exact: true }).click();
  await expect(page).toHaveURL(/\/landing\/resources$/);
  expect(cleaned).toHaveLength(0);
  await page.getByRole("link", { name: LONG_TITLE }).first().click();
  await expect(page.getByRole("heading", { name: "이미 게시된 원본 보존", exact: true })).toBeVisible();
  await page.getByText("원본 파일 · 1개", { exact: true }).click();
  await expect(page.getByText("published.zip", { exact: true })).toBeVisible();
});

test("delete retry after a lost acknowledgement returns to the persisted empty board", async ({ page }) => {
  await prepare(page, { publisher: true, lostDeleteResponse: true });
  await page.goto(`${BASE}/landing/resources/901`);
  await expect(page.getByRole("heading", { name: LONG_TITLE, exact: true })).toBeVisible();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("QA 삭제 응답 확인 실패");
  await expect(page.getByRole("heading", { name: LONG_TITLE, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page).toHaveURL(/\/landing\/resources$/);
  await expect(page.getByText("아직 등록된 글이 없습니다", { exact: true })).toHaveCount(1);
  expect(deleteCount).toBe(2);
  await page.reload();
  await expect(page.getByText("아직 등록된 글이 없습니다", { exact: true })).toHaveCount(1);
});

for (const width of [1366, 390]) {
  test(`saved descriptions remain addressable through edit and reload at ${width}px`, async ({ page }, testInfo) => {
    await prepare(page, { publisher: true, actorId: 502 });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/landing/resources/901/edit`);
    await expect(page.getByLabel("제목", { exact: true })).toHaveValue(LONG_TITLE);
    await expect(page.getByRole("textbox", { name: "본문", exact: true })).toHaveValue(resource.content);
    await page.getByLabel("분류", { exact: true }).selectOption("analysis");
    const description = "다른 게시자가 기존 원본을 보존하며 설명을 수정했습니다.";
    await page.getByRole("textbox", { name: "본문", exact: true }).fill(description);
    await expect(page.getByRole("textbox", { name: "본문", exact: true })).toHaveValue(description);
    await expect(page.getByLabel("첨부 자료", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "수정 내용 게시", exact: true }).click();
    // The textarea also matches getByText; wait for the saved detail before reload.
    await expect(page).toHaveURL(`${BASE}/landing/resources/901`);
    await expect(page.getByRole("article").getByText(description, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "수정", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(description, { exact: true })).toBeVisible();
    await page.getByText("원본 파일 · 3개", { exact: true }).click();
    for (const file of resource.files) await expect(page.getByText(file.filename, { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "수정", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "본문", exact: true })).toHaveValue(description);
    await expect(page.getByLabel("분류", { exact: true })).toHaveValue("analysis");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`saved-description-${width}.png`), fullPage: true });
  });
}


test("failed reader retries through pending and publishes the recovered body", async ({ page }) => {
  await prepare(page, { publisher: true, readerFailure: true });
  await page.goto(`${BASE}/landing/resources/write`);
  await page.getByLabel("제목", { exact: true }).fill("재시도한 한글 분석");
  await page.getByLabel("첨부 자료", { exact: true }).setInputFiles({ name: "qa.hwpx", mimeType: "application/octet-stream", buffer: Buffer.from("QA report") });
  const preview = page.getByRole("region", { name: "방문자 읽기 화면", exact: true });
  await expect(preview.getByText("본문을 준비하지 못했습니다. 원본은 보존됩니다.", { exact: true })).toBeVisible();
  const publish = page.getByRole("button", { name: "게시하기", exact: true });
  await expect(publish).toBeDisabled();
  await preview.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(preview.getByText("첨부 파일을 준비하고 있습니다. 완료되면 자동으로 표시됩니다.", { exact: true })).toBeVisible();
  await expect(publish).toBeDisabled();
  await preview.scrollIntoViewIfNeeded();
  await expect(preview.locator('[data-testid="matchup-pdf-page"][data-render-status="ready"]')).toHaveCount(1, { timeout: 30_000 });
  await expect(publish).toBeEnabled();
  await publish.click();
  await page.waitForURL(/\/landing\/resources\/901$/);
  // Verify the saved result before reloading; navigation alone leaves its reads in flight.
  const savedTitle = page.getByRole("heading", { name: "재시도한 한글 분석", exact: true });
  const savedDocument = page.getByRole("region", { name: "qa.hwpx 본문", exact: true });
  await expect(savedTitle).toBeVisible();
  await expect(page.getByRole("link", { name: "수정", exact: true })).toBeVisible();
  await expect(savedDocument.locator('[data-testid="matchup-pdf-page"][data-render-status="ready"]')).toHaveCount(1);
  await page.reload();
  await expect(savedTitle).toBeVisible();
  await expect(page.getByRole("link", { name: "수정", exact: true })).toBeVisible();
  await expect(savedDocument.locator('[data-testid="matchup-pdf-page"][data-render-status="ready"]')).toHaveCount(1);
  expect(createPayloads).toHaveLength(1);
  expect(cleaned).toHaveLength(0);
});
