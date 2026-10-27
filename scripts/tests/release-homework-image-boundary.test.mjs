import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = readFileSync(new URL("../../e2e/helpers/releaseApiBoundary.ts", import.meta.url), "utf8");
const { releaseBoundaryFromEnv, installReleaseContextGuard, assertReleaseRequestSafe } = await import(
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`
);
const boundary = releaseBoundaryFromEnv({ E2E_RELEASE_API_MODE: "development", E2E_ALLOW_PRODUCTION_WRITES: "0",
  E2E_BASE_URL: "http://localhost:4173", E2E_API_URL: "http://127.0.0.1:18000",
  E2E_TENANT_CODE: "qa-ymath-realuse-homework", E2E_OMR_R2_TENANT_ID: "352" });
const origin = "https://af4f2937d73db240e99864b8518265c5.r2.cloudflarestorage.com";
const query = new URLSearchParams({ "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
  "X-Amz-Credential": "UNITKEYUNITKEY123456/20260919/auto/s3/aws4_request", "X-Amz-Date": "20260919T010000Z",
  "X-Amz-Expires": "600", "X-Amz-SignedHeaders": "host", "X-Amz-Signature": "a".repeat(64) });
const url = `${origin}/academy-development-artifacts/tenants/352/ai/submissions/123/media-456-003ec75fc96f47b982066a553e4382d3.png?${query}`;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64");

async function exercise(options = {}) {
  let handler;
  const context = { request: { fetch: async () => assert.fail("No direct API transport") },
    exposeBinding: async () => {}, addInitScript: async () => {}, on() {},
    route: async (_pattern, callback) => { handler = callback; } };
  const guard = await installReleaseContextGuard(context, options.boundary ?? boundary);
  if (options.register !== false) {
    const apiHeaders = { origin: boundary.webOrigin, authorization: "Bearer test-token",
      "x-tenant-code": boundary.tenantCode, ...options.apiHeaders };
    const apiRequest = {
      url: () => `${boundary.apiOrigin}${options.apiPath ?? "/api/v1/submissions/submissions/homework/789/media/456/preview/"}`,
      method: () => options.apiMethod ?? "GET", resourceType: () => "fetch", allHeaders: async () => apiHeaders,
      headerValue: async (name) => apiHeaders[name] ?? null, postDataJSON: () => null, postDataBuffer: () => null,
    };
    await handler({ request: () => apiRequest, abort: async () => {}, continue: async () => assert.fail("unguarded API"),
      fetch: async () => ({ status: () => options.apiStatus ?? 200,
        headers: () => ({ "content-type": "application/json", "access-control-allow-origin": options.corsOrigin ?? boundary.webOrigin,
          "access-control-allow-credentials": "true" }),
        json: async () => ({ url: options.registerUrl ?? url, media_kind: "image", mime_type: "image/png", expires_in: 600,
          ...options.payload }) }), fulfill: async () => {} });
  }
  const fetched = [], fulfilled = [];
  let aborted = 0;
  const imageHeaders = options.headers ?? { referer: `${boundary.webOrigin}/workspace/private` };
  await handler({ request: () => ({ url: () => options.url ?? options.registerUrl ?? url,
    method: () => options.method ?? "GET", resourceType: () => options.resourceType ?? "image",
    allHeaders: async () => imageHeaders, headerValue: async (name) => imageHeaders[name] ?? null,
    postDataJSON: () => null, postDataBuffer: () => options.requestBody ?? null }),
    abort: async () => { aborted++; }, continue: async () => assert.fail("unguarded image"),
    fetch: async (settings) => {
      fetched.push(settings);
      if (options.fetchError) throw new Error(`private ${url}`);
      return { status: () => options.status ?? 200,
        headers: () => ({ "content-type": options.contentType ?? "image/png", "set-cookie": "private",
          ...(options.storageCors ? { "access-control-allow-origin": options.storageCors } : {}),
          location: "https://production.invalid/private" }), body: async () => options.body ?? png };
    }, fulfill: async (response) => fulfilled.push(response) });
  return { guard, fetched, fulfilled, aborted };
}

function rejected(result, fetches = 0) {
  assert.equal(result.fetched.length, fetches);
  assert.equal(result.fulfilled.length, 0);
  assert.equal(result.aborted, 1);
  assert.throws(() => result.guard.assertClean(), (error) => {
    assert.match(error.message, /Release API boundary failed/);
    for (const secret of ["X-Amz", "UNITKEY", "cloudflarestorage", "test-token", "tenants/352"]) {
      assert.equal(error.message.includes(secret), false);
    }
    return true;
  });
}

test("homework PNG requires its authenticated preview response and preserves real bytes with stripped headers", async () => {
  const result = await exercise();
  result.guard.assertClean();
  assert.deepEqual(result.fetched, [{ url, method: "GET", headers: { accept: "image/png" }, maxRedirects: 0 }]);
  assert.deepEqual(result.fulfilled, [{ status: 200, headers: { "content-type": "image/png" }, body: png }]);
  rejected(await exercise({ register: false }));
  rejected(await exercise({ url: url.replace("a".repeat(64), "b".repeat(64)) }));
  assert.throws(() => assertReleaseRequestSafe(boundary, url, "GET"), /escaped/);
});

test("homework preview registration pins exact authorized API response, media and Setup tenant", async () => {
  for (const options of [
    { apiStatus: 403 }, { apiStatus: 302 }, { apiMethod: "POST" }, { apiHeaders: { authorization: "" } },
    { apiHeaders: { "x-tenant-code": "qa-ymath-realuse-other" } }, { corsOrigin: "https://foreign.invalid" },
    { apiPath: "/api/v1/submissions/submissions/homework/789/media/457/preview/" },
    { apiPath: "/api/v1/submissions/submissions/homework/789/media/456/preview/?extra=1" },
    { apiPath: "/api/v1/other/" }, { payload: { media_kind: "video" } }, { payload: { mime_type: "image/jpeg" } },
    { payload: { expires_in: 601 } }, { boundary: { ...boundary, omrR2TenantId: undefined } },
    { boundary: { ...boundary, mode: "readonly" } },
    ...[
      url.replace("tenants/352/", "tenants/353/"), url.replace("media-456-", "media-457-"),
      url.replace("academy-development-artifacts", "academy-production-artifacts"),
      url.replace(origin, "https://foreign.invalid"), url.replace(".png?", ".jpg?"),
      url.replace("Expires=600", "Expires=601"), `${url}&X-Amz-Signature=${"a".repeat(64)}`,
      url.replace("/tenants/352/", "/tenants/353/../352/"), `${url}#fragment`,
    ].map((registerUrl) => ({ registerUrl })),
  ]) rejected(await exercise(options));
});

test("registered homework image still rejects mutations, non-image use and application credentials", async () => {
  for (const options of [
    { method: "POST" }, { method: "HEAD" }, { resourceType: "fetch" }, { resourceType: "document" },
    { requestBody: Buffer.from("private") },
    ...["authorization", "proxy-authorization", "cookie", "x-tenant-code", "x-student-id", "x-api-key"]
      .map((key) => ({ headers: { [key]: "private" } })),
  ]) rejected(await exercise(options));
});

test("registered homework image rejects redirects and wrong upstream status/content/bytes without disclosing URLs", async () => {
  for (const options of [{ status: 302 }, { status: 403 }, { contentType: "image/jpeg" },
    { contentType: "text/html" }, { body: Buffer.from("not png") }, { body: png.subarray(0, 4) }, { fetchError: true }]) {
    rejected(await exercise(options), 1);
  }
});

test("HEIC XHR stays bound to its authorized object, MIME, credentials and actual storage CORS", async () => {
  const heic = readFileSync(new URL("../../e2e/fixtures/files/homework.heic", import.meta.url));
  const heicUrl = url.replace(".png?", ".heic?");
  const options = { registerUrl: heicUrl, payload: { mime_type: "image/heic" }, resourceType: "xhr",
    contentType: "image/heic", body: heic, storageCors: boundary.webOrigin };
  const result = await exercise(options);
  result.guard.assertClean();
  assert.deepEqual(result.fetched, [{ url: heicUrl, method: "GET", headers: { accept: "image/heic", origin: boundary.webOrigin }, maxRedirects: 0 }]);
  assert.deepEqual(result.fulfilled, [{ status: 200, headers: { "content-type": "image/heic", "access-control-allow-origin": boundary.webOrigin }, body: heic }]);
  for (const override of [
    { register: false }, { registerUrl: heicUrl.replace("tenants/352", "tenants/353") },
    { payload: { mime_type: "image/png" } }, { method: "POST" }, { resourceType: "document" },
    { resourceType: "fetch" }, { headers: { authorization: "Bearer private" } },
    { headers: { cookie: "private" } }, { headers: { "x-tenant-code": boundary.tenantCode } },
  ]) rejected(await exercise({ ...options, ...override }));
  for (const override of [
    { storageCors: undefined }, { storageCors: "https://foreign.invalid" },
    { body: png }, { contentType: "image/png" }, { status: 302 },
  ]) rejected(await exercise({ ...options, ...override }), 1);
});

test("homework source and compatible MP4 require exact authorized response and retain real bounded bytes", async () => {
  const body = readFileSync(new URL("../../e2e/fixtures/files/homework-video.mp4", import.meta.url));
  const sourceUrl = url.replace(".png?", ".mp4?");
  const derivativeUrl = sourceUrl.replace(/media-456-[0-9a-f]{32}/, `preview-${"c".repeat(32)}-${"d".repeat(32)}`);
  for (const compatible of [false, true]) {
    const options = { registerUrl: compatible ? derivativeUrl : sourceUrl, payload: { media_kind: "video", mime_type: "video/mp4", status: "ready" },
      apiPath: `/api/v1/submissions/submissions/homework/789/media/456/preview/${compatible ? "compatible/" : ""}`,
      resourceType: "media", contentType: "video/mp4", body, headers: { range: "bytes=0-" } };
    const result = await exercise(options);
    result.guard.assertClean();
    assert.deepEqual(result.fetched, [{ url: options.registerUrl, method: "GET", headers: { accept: "video/mp4" }, maxRedirects: 0 }]);
    assert.deepEqual(result.fulfilled, [{ status: 200, headers: { "content-type": "video/mp4", "content-length": String(body.length) }, body }]);
    for (const override of [{ register: false }, { resourceType: "xhr" }, { resourceType: "document" }, { method: "POST" },
      { headers: { authorization: "Bearer private" } }, { headers: { cookie: "private" } },
      { registerUrl: options.registerUrl.replace("tenants/352", "tenants/353") }, { apiHeaders: { authorization: "" } },
      ...(compatible ? [{ payload: { status: "queued" } }, { registerUrl: sourceUrl }] : [{ registerUrl: derivativeUrl }])]) {
      rejected(await exercise({ ...options, ...override }));
    }
    for (const override of [{ status: 302 }, { contentType: "text/html" }, { body: png }, { body: Buffer.alloc(2 * 1024 * 1024 + 1) }]) {
      rejected(await exercise({ ...options, ...override }), 1);
    }
  }
});
