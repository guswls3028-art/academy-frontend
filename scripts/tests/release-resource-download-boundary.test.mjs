import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
const source = readFileSync(new URL("../../e2e/helpers/releaseApiBoundary.ts", import.meta.url), "utf8");
const { isExactDevelopmentResourceDownload: allowed, releaseBoundaryFromEnv, installReleaseContextGuard } = await import("data:text/javascript;base64," + Buffer.from(stripTypeScriptTypes(source + "\nexport { isExactDevelopmentResourceDownload };\n")).toString("base64"));
const file = "11111111-1111-4111-8111-111111111111";
const boundary = { mode: "development", omrR2TenantId: 352 };
const query = new URLSearchParams({ "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": "UNITKEYUNITKEY123456/20261006/auto/s3/aws4_request", "X-Amz-Date": "20261006T010000Z", "X-Amz-Expires": "300", "X-Amz-SignedHeaders": "host", "X-Amz-Signature": "a".repeat(64) });
const url = `https://af4f2937d73db240e99864b8518265c5.r2.cloudflarestorage.com/academy-development-artifacts/landing-public/resources/352/${file}?${query}`;
test("only the exact development tenant/object signature is accepted", () => {
  assert.equal(allowed(boundary, url, file), true);
  for (const target of [url.replace("/352/", "/353/"), url.replace("academy-development-artifacts", "academy-admin"), url.replace(file, "22222222-2222-4222-8222-222222222222"), url.replace("/352/", "/352/../352/"), url + "&extra=1", url + "#fragment", url.replace("Expires=300", "Expires=301"), url.replace("Expires=300", "Expires=300&X-Amz-Expires=300"), url.replace("https://", "https://user:pass@"), url.replace("https://", "http://")]) assert.equal(allowed(boundary, target, file), false);
  assert.equal(allowed({ ...boundary, mode: "readonly" }, url, file), false);
  assert.equal(allowed({ mode: "development" }, url, file), false);
});

const readerBoundary = releaseBoundaryFromEnv({ E2E_RELEASE_API_MODE: "development", E2E_ALLOW_PRODUCTION_WRITES: "0",
  E2E_BASE_URL: "http://localhost:4173", E2E_API_URL: "http://127.0.0.1:18000",
  E2E_TENANT_CODE: "qa-ymath-realuse-resource", E2E_OMR_R2_TENANT_ID: "352" });
const generation = "22222222-2222-4222-8222-222222222222";
const readerUrl = url.replace(`/${file}?`, `/${file}/reader/${generation}/pages.pdf?`);
const pdf = Buffer.from("%PDF-1.7\nQA derived report\n");

async function exerciseReader(options = {}) {
  let handler;
  const activeBoundary = options.boundary ?? readerBoundary;
  const context = { request: { fetch: async () => assert.fail("No direct API transport") },
    exposeBinding: async () => {}, addInitScript: async () => {}, on() {},
    route: async (_pattern, callback) => { handler = callback; } };
  const guard = await installReleaseContextGuard(context, activeBoundary);
  const registeredUrl = options.registerUrl ?? (options.original || options.readerOriginal ? url : readerUrl);
  if (options.register !== false) {
    const apiHeaders = { origin: readerBoundary.webOrigin, "x-tenant-code": readerBoundary.tenantCode, ...options.apiHeaders };
    const apiRequest = { url: () => `${readerBoundary.apiOrigin}/api/v1/landing-public/resource-files/${file}/${options.original ? "" : "reader/"}`,
      method: () => "GET", resourceType: () => "fetch", allHeaders: async () => apiHeaders,
      headerValue: async (name) => apiHeaders[name] ?? null, postDataJSON: () => null, postDataBuffer: () => null };
    await handler({ request: () => apiRequest, abort: async () => {}, continue: async () => assert.fail("unguarded API"),
      fetch: async () => ({ status: () => options.apiStatus ?? 200,
        headers: () => ({ "content-type": "application/json", "access-control-allow-origin": readerBoundary.webOrigin,
          "access-control-allow-credentials": "true" }),
        json: async () => options.original ? { expires_in: 300, url: registeredUrl }
          : { status: "ready", ...(options.image ? { blocks: [{ kind: "image", url: registeredUrl }] } : { pdf_url: registeredUrl }) } }),
      fulfill: async () => {} });
  }
  const fetched = [], fulfilled = [];
  let aborted = 0;
  const headers = options.headers ?? {};
  const responseHeaders = { "content-type": options.contentType ?? "application/pdf",
    "access-control-allow-origin": options.corsOrigin ?? readerBoundary.webOrigin,
    ...(options.disposition ? { "content-disposition": options.disposition } : {}) };
  await handler({ request: () => ({ url: () => options.url ?? registeredUrl,
    method: () => options.method ?? "GET", resourceType: () => options.resourceType ?? "fetch",
    allHeaders: async () => headers, headerValue: async (name) => headers[name] ?? null,
    postDataJSON: () => null, postDataBuffer: () => options.requestBody ?? null }),
  abort: async () => { aborted++; }, continue: async () => assert.fail("unguarded reader asset"),
  fetch: async (settings) => { fetched.push(settings); if (options.fetchError) throw new Error("private signed URL");
    return { status: () => options.status ?? 200, headers: () => responseHeaders, body: async () => options.body ?? pdf }; },
  fulfill: async (response) => fulfilled.push(response) });
  return { guard, fetched, fulfilled, aborted };
}

function rejectReader(result, fetches = 0) {
  assert.equal(result.fetched.length, fetches);
  assert.equal(result.fulfilled.length, 0);
  assert.equal(result.aborted, 1);
  assert.throws(() => result.guard.assertClean(), (error) => {
    assert.match(error.message, /Release API boundary failed/);
    for (const secret of ["X-Amz", "UNITKEY", "cloudflarestorage", "private signed URL"]) {
      assert.equal(error.message.includes(secret), false);
    }
    return true;
  });
}

test("derived PDF reads without attachment disposition and preserves real response bytes", async () => {
  const result = await exerciseReader();
  result.guard.assertClean();
  assert.equal(result.aborted, 0);
  assert.deepEqual(result.fetched, [{ url: readerUrl, method: "GET",
    headers: { accept: "*/*", origin: readerBoundary.webOrigin }, maxRedirects: 0 }]);
  assert.equal(result.fulfilled.length, 1);
  assert.deepEqual(result.fulfilled[0].body, pdf);
});

test("reader image assets use their exact native image format", async () => {
  for (const [extension, contentType, body] of [
    ["png", "image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])],
    ["webp", "image/webp", Buffer.from("RIFF0000WEBPQA")],
    ["gif", "image/gif", Buffer.from("GIF89aQA")],
  ]) {
    const options = { image: true, registerUrl: readerUrl.replace("pages.pdf", `image-1.${extension}`),
      contentType, body, resourceType: "image" };
    const result = await exerciseReader(options);
    result.guard.assertClean();
    assert.deepEqual(result.fulfilled[0].body, body);
    rejectReader(await exerciseReader({ ...options, contentType: "text/html" }), 1);
    rejectReader(await exerciseReader({ ...options, body: Buffer.from("not an image") }), 1);
  }
});

test("original downloads and original PDF previews still require attachment disposition", async () => {
  for (const kind of [{ original: true, resourceType: "document" }, { readerOriginal: true }]) {
    const result = await exerciseReader({ ...kind, disposition: 'attachment; filename="qa.pdf"' });
    result.guard.assertClean();
    assert.deepEqual(result.fulfilled[0].body, pdf);
    rejectReader(await exerciseReader(kind), 1);
  }
});

test("reader registration stays bound to exact tenant file generation and signed API response", async () => {
  for (const options of [
    { register: false }, { apiStatus: 403 }, { apiHeaders: { "x-tenant-code": "qa-ymath-realuse-other" } },
    { boundary: { ...readerBoundary, mode: "readonly" } },
    { url: readerUrl.replace(generation, "33333333-3333-4333-8333-333333333333") },
    ...[readerUrl.replace("/352/", "/353/"), readerUrl.replace("academy-development-artifacts", "academy-admin"),
      readerUrl.replace(file, generation), readerUrl.replace("pages.pdf", "page.html"),
      readerUrl.replace("Expires=300", "Expires=301"), readerUrl + "&extra=1",
      readerUrl.replace("/352/", "/353/../352/")].map((registerUrl) => ({ registerUrl })),
  ]) rejectReader(await exerciseReader(options));
});

test("reader transport rejects credentials mutations redirects CORS mismatch and corrupt media", async () => {
  for (const options of [
    { method: "POST" }, { method: "HEAD" }, { resourceType: "document" }, { resourceType: "script" },
    { requestBody: Buffer.from("private") },
    ...["authorization", "proxy-authorization", "cookie", "x-tenant-code", "x-student-id", "x-api-key"]
      .map((key) => ({ headers: { [key]: "private" } })),
  ]) rejectReader(await exerciseReader(options));
  for (const options of [{ status: 302 }, { status: 403 }, { contentType: "text/html" },
    { body: Buffer.from("not pdf") }, { body: Buffer.alloc(0) }, { corsOrigin: "https://foreign.invalid" }, { fetchError: true }]) {
    rejectReader(await exerciseReader(options), 1);
  }
});

test("derived outputs retain the 60 MiB cap while originals retain their 30 MiB cap", async () => {
  const body = Buffer.alloc(30 * 1024 * 1024 + 1); pdf.copy(body);
  const result = await exerciseReader({ body }); result.guard.assertClean();
  assert.equal(result.fulfilled[0].body.length, body.length);
  rejectReader(await exerciseReader({ original: true, body, disposition: 'attachment; filename="qa.pdf"' }), 1);
  const oversized = Buffer.alloc(60 * 1024 * 1024 + 1); pdf.copy(oversized);
  rejectReader(await exerciseReader({ body: oversized }), 1);
});
