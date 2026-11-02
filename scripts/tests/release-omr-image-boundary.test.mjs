import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = readFileSync(new URL("../../e2e/helpers/releaseApiBoundary.ts", import.meta.url), "utf8");
const { releaseBoundaryFromEnv, assertReleaseRequestSafe, installReleaseContextGuard } = await import(
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`
);
const env = { E2E_RELEASE_API_MODE: "development", E2E_ALLOW_PRODUCTION_WRITES: "0",
  E2E_BASE_URL: "http://localhost:4173", E2E_API_URL: "http://127.0.0.1:18000",
  E2E_TENANT_CODE: "qa-ymath-realuse-omr-image", E2E_OMR_R2_TENANT_ID: "352" };
const boundary = releaseBoundaryFromEnv(env);
const origin = "https://af4f2937d73db240e99864b8518265c5.r2.cloudflarestorage.com";
const objectPath = "/academy-development-artifacts/tenants/352/ai/submissions/123/aligned/003ec75f-c96f-47b9-8206-6a553e4382d3.jpg";
const query = new URLSearchParams({
  "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": "UNITKEYUNITKEY123456/20260919/auto/s3/aws4_request",
  "X-Amz-Date": "20260919T010000Z", "X-Amz-Expires": "21600", "X-Amz-SignedHeaders": "host",
  "X-Amz-Signature": "a".repeat(64),
});
const url = `${origin}${objectPath}?${query}`;
// Real 1x1 JPEG, not a fabricated image response or a JPEG prefix alone.
const jpeg = Buffer.from("/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD8qqKKKAP/2Q==", "base64");

async function exercise(options = {}) {
  let handler;
  const context = { request: { fetch: async () => assert.fail("No direct API transport") },
    exposeBinding: async () => {}, addInitScript: async () => {}, on() {},
    route: async (_pattern, callback) => { handler = callback; } };
  const guard = await installReleaseContextGuard(context, options.boundary ?? boundary);
  const headers = options.headers ?? { referer: `${boundary.webOrigin}/workspace/private`, accept: "image/*" };
  const request = { url: () => options.url ?? url, method: () => options.method ?? "GET",
    resourceType: () => options.resourceType ?? "image", allHeaders: async () => headers,
    // Playwright returns null (not undefined) for postDataJSON on bodyless GET.
    headerValue: async (name) => headers[name] ?? null, postDataJSON: () => null,
    postDataBuffer: () => options.requestBody ?? null };
  const fetched = [];
  const fulfilled = [];
  let aborted = 0;
  await handler({ request: () => request, abort: async () => { aborted++; },
    continue: async () => assert.fail("No unguarded external transport"),
    fetch: async (fetchOptions) => {
      fetched.push(fetchOptions);
      if (options.fetchError) throw new Error(`private-name ${url}`);
      return { status: () => options.status ?? 200,
        headers: () => ({ "content-type": options.contentType ?? "image/jpeg", "set-cookie": "must-not-forward",
          location: "https://production.invalid/private", "x-private-url": url }),
        body: async () => options.body ?? jpeg };
    }, fulfill: async (response) => { fulfilled.push(response); } });
  return { guard, context, fetched, fulfilled, aborted };
}

function assertRejected(result, expectedFetches = 0) {
  assert.equal(result.fetched.length, expectedFetches);
  assert.equal(result.fulfilled.length, 0);
  assert.equal(result.aborted, 1);
  assert.throws(() => result.guard.assertClean(), (error) => {
    assert.match(error.message, /Release API boundary failed/);
    for (const secret of ["X-Amz", "UNITKEY", "cloudflarestorage", "private-name", "tenants/352"]) {
      assert.equal(error.message.includes(secret), false);
    }
    return true;
  });
}

test("OMR R2 image pins Setup tenant, strips headers, and preserves JPEG bytes", async () => {
  const result = await exercise();
  result.guard.assertClean();
  assert.equal(result.aborted, 0);
  assert.deepEqual(result.fetched, [{ url, method: "GET", headers: { accept: "image/jpeg" }, maxRedirects: 0 }]);
  assert.deepEqual(result.fulfilled, [{ status: 200, headers: { "content-type": "image/jpeg" }, body: jpeg }]);
  assert.throws(() => assertReleaseRequestSafe(boundary, url, "GET"), /escaped/,
    "Direct APIRequestContext must not gain an external-origin exemption");
  await assert.rejects(installReleaseContextGuard(result.context, { ...boundary, omrR2TenantId: 353 }), /mismatch/);
  await assert.rejects(async () => result.context.request.get(url), /escaped/);
  assert.throws(() => result.guard.assertClean(), /boundary failed/,
    "A caught direct-request denial must still fail teardown");
});

test("OMR R2 tenant configuration is development-only and an exact positive integer", () => {
  assert.equal(boundary.omrR2TenantId, 352);
  for (const value of ["", "0", "-1", "0352", "352x", "1.5", "9007199254740992"]) {
    assert.throws(() => releaseBoundaryFromEnv({ ...env, E2E_OMR_R2_TENANT_ID: value }), /scope/);
  }
  assert.throws(() => releaseBoundaryFromEnv({ ...env, E2E_RELEASE_API_MODE: "readonly",
    E2E_API_URL: "https://api.hakwonplus.com", E2E_BASE_URL: "https://hakwonplus.com", E2E_TENANT_CODE: "hakwonplus" }), /scope/);
});

const matchupPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=", "base64");
const matchupPrefix = `${origin}/academy-development-artifacts/tenants/352/matchup/`;
const matchupQuery = new URLSearchParams(query);
matchupQuery.set("X-Amz-Expires", "3600");
const matchupImage = (suffix) => `${matchupPrefix}${suffix}?${matchupQuery}`;

test("Matchup permits only signed development PNG page/crop paths in the Setup tenant", async () => {
  for (const suffix of [
    `jobs/${"a".repeat(64)}/pages/000.png`,
    `jobs/${"b".repeat(64)}/problems/11111111-1111-4111-8111-111111111111/1.png`,
    "manual-41/pages/000.png", "manual-41/pages/manual-bounded-v1/000.png", "manual-41/problems/99.png",
  ]) {
    const target = matchupImage(suffix);
    const result = await exercise({ url: target, contentType: "image/png", body: matchupPng });
    result.guard.assertClean();
    assert.deepEqual(result.fetched, [{ url: target, method: "GET", headers: { accept: "image/png" }, maxRedirects: 0 }]);
    assert.deepEqual(result.fulfilled, [{ status: 200, headers: { "content-type": "image/png" }, body: matchupPng }]);
    assert.throws(() => assertReleaseRequestSafe(boundary, target, "GET"), /escaped/);
  }
});

test("Matchup refuses foreign scopes, credentials, redirects and non-PNG responses", async () => {
  const valid = matchupImage("manual-41/problems/99.png");
  for (const options of [
    { url: valid.replace("tenants/352", "tenants/353") },
    { url: valid.replace("academy-development-artifacts", "academy-production-artifacts") },
    { url: valid.replace("X-Amz-Expires=3600", "X-Amz-Expires=3601") },
    { url: valid.replace("manual-41", "manual-0") },
    { url: matchupImage(`jobs/${"a".repeat(63)}/pages/000.png`) },
    { url: matchupImage("manual-41/original.pdf") },
    { method: "POST" }, { resourceType: "xhr" },
    { headers: { authorization: "Bearer synthetic-must-not-forward" } },
    { boundary: { ...boundary, mode: "readonly" } },
  ]) assertRejected(await exercise({ url: valid, contentType: "image/png", body: matchupPng, ...options }));
  for (const options of [{ status: 302 }, { contentType: "image/jpeg" }, { body: jpeg }]) {
    assertRejected(await exercise({ url: valid, contentType: "image/png", body: matchupPng, ...options }), 1);
  }
});

test("OMR R2 image rejects foreign scope, non-image resources and mutations before transport", async () => {
  for (const options of [
    { boundary: { ...boundary, mode: "readonly" } }, { boundary: { ...boundary, omrR2TenantId: undefined } },
    { url: url.replace("tenants/352/", "tenants/353/") },
    { url: url.replace("academy-development-artifacts", "academy-production-artifacts") },
    { url: url.replace(origin, "https://foreign.r2.cloudflarestorage.com") },
    { url: url.replace(origin, "http://127.0.0.1:9999") },
    { url: url.replace(origin, `${origin}.evil.invalid`) },
    { url: url.replace("https://", "https://username:password@") },
    { url: url.replace("/aligned/", "/original/") }, { url: url.replace(".jpg?", ".pdf?") },
    { url: url.replace("/123/", "/0/") }, { url: url.replace("/123/", "/9007199254740992/") },
    { url: url.replace("/tenants/352/", "/tenants/353/../352/") },
    { url: url.replace("/tenants/352/", "/tenants/353/%2e%2e/352/") },
    { url: url.replace("/tenants/352/", "/tenants/352%2f../352/") }, { url: `${url}#fragment` },
    { resourceType: "fetch" }, { resourceType: "document" },
    ...["HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"].map((method) => ({ method })),
  ]) assertRejected(await exercise(options));
});

test("OMR R2 image accepts only host-signed object GET query shape", async () => {
  for (const [key, value] of [
    ["X-Amz-Algorithm", "AWS"], ["X-Amz-Credential", "UNITKEYUNITKEY123456/20260918/auto/s3/aws4_request"],
    ["X-Amz-Credential", "UNITKEYUNITKEY123456/20260919/us-east-1/s3/aws4_request"],
    ["X-Amz-Date", "20260230T010000Z"], ["X-Amz-Date", "not-a-date"],
    ["X-Amz-Expires", "0"], ["X-Amz-Expires", "21601"], ["X-Amz-Expires", "1.5"],
    ["X-Amz-Signature", "secret"], ["X-Amz-SignedHeaders", "host;authorization"], ["delete", ""],
  ]) {
    const changed = new URL(url); changed.searchParams.set(key, value);
    assertRejected(await exercise({ url: changed.href }));
  }
  assertRejected(await exercise({ url: `${url}&X-Amz-Signature=${"a".repeat(64)}` }));
  assertRejected(await exercise({ url: `${origin}${objectPath}` }));
});

test("OMR R2 image refuses application credentials and request bodies", async () => {
  for (const key of ["authorization", "proxy-authorization", "cookie", "x-tenant-code", "x-student-id", "x-api-key"]) {
    assertRejected(await exercise({ headers: { [key]: "private-secret" } }));
  }
  assertRejected(await exercise({ requestBody: Buffer.from("private-secret") }));
  assertRejected(await exercise({ requestBody: Buffer.from("null") }));
});

test("OMR R2 image refuses redirects, invalid upstream bytes/status and transport errors", async () => {
  for (const options of [{ status: 301 }, { status: 307 }, { status: 403 }, { contentType: "text/html" },
    { body: Buffer.from("not-a-jpeg") }, { fetchError: true }]) assertRejected(await exercise(options), 1);
});


const pdfQuery = new URLSearchParams(query);
pdfQuery.set("X-Amz-Expires", "900");
const pdfUrl = `${origin}/academy-development-artifacts/tenants/352/ai/submissions/123/${"a".repeat(32)}.pdf?${pdfQuery}`;
const pdfBytes = Buffer.from("%PDF-1.7\nclosed boundary fixture\n%%EOF");
async function previewPdf(options = {}) {
  let handler;
  const context = { request: { fetch: async () => assert.fail("No external direct request") },
    exposeBinding: async () => {}, addInitScript: async () => {}, on() {},
    route: async (_pattern, callback) => { handler = callback; } };
  const guard = await installReleaseContextGuard(context, options.boundary ?? boundary);
  const register = async patch => {
    const item = { ...options, ...patch };
    const headers = { origin: boundary.webOrigin, authorization: "Bearer fixture", "x-tenant-code": boundary.tenantCode, ...item.apiHeaders };
    await handler({ request: () => ({ url: () => boundary.apiOrigin + (item.apiPath ?? "/api/v1/submissions/submissions/123/preview/"),
      method: () => item.apiMethod ?? "GET", resourceType: () => "fetch", allHeaders: async () => headers,
      headerValue: async name => headers[name] ?? null, postDataJSON: () => null, postDataBuffer: () => null }),
      abort: async () => {}, continue: async () => assert.fail("unguarded API"),
      fetch: async () => ({ status: () => item.apiStatus ?? 200, headers: () => ({ "content-type": item.apiMime ?? "application/json",
        "cache-control": item.cache ?? "no-store", "access-control-allow-origin": item.corsOrigin ?? boundary.webOrigin,
        "access-control-allow-credentials": "true" }), json: async () => ({ url: item.registerUrl ?? pdfUrl, ...item.payload }) }),
      fulfill: async () => {} });
  };
  if (options.register !== false) await register({});
  if (options.replace) await register(options.replace);
  const fetched = [], fulfilled = [];
  let aborted = 0;
  const headers = options.headers ?? { referer: boundary.webOrigin + "/private" };
  for (let i = 0; i < (options.reads ?? 1); i++) await handler({ request: () => ({ url: () => options.url ?? options.registerUrl ?? pdfUrl,
    method: () => options.method ?? "GET", resourceType: () => options.resourceType ?? "document", allHeaders: async () => headers,
    headerValue: async name => headers[name] ?? null, postDataJSON: () => null, postDataBuffer: () => options.requestBody ?? null }),
    abort: async () => { aborted++; }, continue: async () => assert.fail("unguarded PDF"),
    fetch: async settings => { fetched.push(settings); return { status: () => options.status ?? 200,
      headers: () => ({ "content-type": options.mime ?? "application/pdf", "set-cookie": "private", location: "https://foreign.invalid" }),
      body: async () => options.bytes ?? pdfBytes }; }, fulfill: async response => fulfilled.push(response) });
  return { guard, fetched, fulfilled, aborted };
}

test("staff-issued development OMR PDF is relayed twice for embed and popup with only PDF bytes and safe headers", async () => {
  const result = await previewPdf({ reads: 2 }); result.guard.assertClean();
  assert.equal(result.aborted, 0);
  assert.deepEqual(result.fetched, Array(2).fill({ url: pdfUrl, method: "GET", headers: { accept: "application/pdf" }, maxRedirects: 0 }));
  assert.deepEqual(result.fulfilled, Array(2).fill({ status: 200, headers: { "content-type": "application/pdf", "cache-control": "no-store" }, body: pdfBytes }));
  assert.throws(() => assertReleaseRequestSafe(boundary, pdfUrl, "GET"), /escaped/);
});

test("OMR original PDF requires one authenticated no-store response and exact tenant, submission, key and signature", async () => {
  for (const options of [{ register: false }, { apiStatus: 403 }, { apiStatus: 404 }, { apiMethod: "POST" },
    { apiPath: "/api/v1/submissions/submissions/124/preview/" }, { apiHeaders: { authorization: "" } },
    { apiHeaders: { "x-tenant-code": "qa-other" } }, { apiHeaders: { "x-student-id": "123" } },
    { cache: "public" }, { apiMime: "text/plain" }, { corsOrigin: "*" }, { payload: { extra: "private" } },
    { replace: { apiStatus: 404 } }, { method: "HEAD" }, { method: "POST" }, { resourceType: "fetch" }, { resourceType: "image" },
    { requestBody: Buffer.from("private") }, ...["authorization", "proxy-authorization", "cookie", "x-api-key", "x-student-id", "x-tenant-code"].map(key => ({ headers: { [key]: "private" } })),
    ...[pdfUrl.replace(origin, "https://foreign.invalid"), pdfUrl.replace("academy-development-artifacts", "academy-production-artifacts"),
      pdfUrl.replace("tenants/352", "tenants/353"), pdfUrl.replace("submissions/123", "submissions/124"),
      pdfUrl.replace("a".repeat(32) + ".pdf", "original.pdf"), pdfUrl.replace(".pdf?", ".jpg?"),
      pdfUrl.replace("/123/", "/999/../123/"), pdfUrl.replace("Expires=900", "Expires=901"),
      pdfUrl.replace("SignedHeaders=host", "SignedHeaders=content-type"), pdfUrl + "&extra=private", pdfUrl + "#private"].map(registerUrl => ({ registerUrl })),
    { url: pdfUrl.replace("a".repeat(64), "b".repeat(64)) }]) assertRejected(await previewPdf(options));
  for (const options of [{ status: 302 }, { status: 206 }, { status: 404 }, { mime: "text/html" },
    { bytes: Buffer.from("not a PDF") }, { bytes: Buffer.concat([pdfBytes, Buffer.alloc(10 * 1024 * 1024)]) }]) {
    assertRejected(await previewPdf(options), 1);
  }
});
