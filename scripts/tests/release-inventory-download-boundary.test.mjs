import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = readFileSync(new URL("../../e2e/helpers/releaseApiBoundary.ts", import.meta.url), "utf8");
const { releaseBoundaryFromEnv, installReleaseContextGuard } = await import(
  "data:text/javascript;base64," + Buffer.from(stripTypeScriptTypes(source)).toString("base64")
);
const boundary = releaseBoundaryFromEnv({ E2E_RELEASE_API_MODE: "development", E2E_ALLOW_PRODUCTION_WRITES: "0",
  E2E_BASE_URL: "http://localhost:4173", E2E_API_URL: "http://127.0.0.1:18000",
  E2E_TENANT_CODE: "qa-ymath-realuse-inventory", E2E_OMR_R2_TENANT_ID: "352" });
const origin = "https://af4f2937d73db240e99864b8518265c5.r2.cloudflarestorage.com";
const encode = (value) => encodeURIComponent(value).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
function fixture(hwpx = false) {
  const ext = hwpx ? "hwpx" : "HWP";
  const name = "qa-한글원본." + ext;
  const r2Key = "tenants/352/students/01012345678/inventory/qa-한글원본_261011_" + "a".repeat(32) + "." + ext;
  const contentType = hwpx ? "application/vnd.hancom.hwpx" : "application/x-hwp";
  const body = Buffer.from(hwpx ? [0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4] : [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  const disposition = 'attachment; filename="download"; filename*=UTF-8\'\'' + encode(name);
  const query = new URLSearchParams({ "response-content-type": contentType, "response-content-disposition": disposition,
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": "UNITKEYUNITKEY123456/20261011/auto/s3/aws4_request",
    "X-Amz-Date": "20261011T010000Z", "X-Amz-Expires": "3600", "X-Amz-SignedHeaders": "host", "X-Amz-Signature": "a".repeat(64) });
  return { name, r2Key, contentType, sizeBytes: body.length, body, disposition,
    url: origin + "/academy-development-artifacts/" + r2Key.split("/").map(encode).join("/") + "?" + query };
}

async function exercise(options = {}) {
  const file = fixture(options.hwpx);
  let handler;
  const context = { request: { fetch: async () => assert.fail("No direct API transport") },
    exposeBinding: async () => {}, addInitScript: async () => {}, on() {},
    route: async (_pattern, callback) => { handler = callback; } };
  const guard = await installReleaseContextGuard(context, options.boundary ?? boundary);
  const apiHeaders = { origin: boundary.webOrigin, authorization: "Bearer qa-token",
    "x-tenant-code": boundary.tenantCode, ...options.apiHeaders };
  const api = async (endpoint, data, payload, status = 200) => handler({
    request: () => ({ url: () => boundary.apiOrigin + "/api/v1/storage/inventory/" + endpoint,
      method: () => "POST", resourceType: () => "fetch", allHeaders: async () => apiHeaders,
      headerValue: async (key) => apiHeaders[key] ?? null, postDataJSON: () => data, postDataBuffer: () => null }),
    abort: async () => {}, continue: async () => assert.fail("unguarded API"),
    fetch: async () => ({ status: () => status, headers: () => ({ "content-type": "application/json",
      "access-control-allow-origin": boundary.webOrigin, "access-control-allow-credentials": "true" }),
      json: async () => payload }), fulfill: async () => {},
  });
  if (options.upload !== false) await api("upload/", {}, { ...file, ...options.metadata }, options.uploadStatus ?? 201);
  if (options.presign !== false) await api("presign/", { r2_key: file.r2Key, download: true, ...options.presignData },
    { url: options.registerUrl ?? file.url }, options.presignStatus ?? 200);
  const fetched = [], fulfilled = [];
  let aborted = 0;
  const headers = options.headers ?? {};
  await handler({
    request: () => ({ url: () => options.url ?? options.registerUrl ?? file.url, method: () => options.method ?? "GET",
      resourceType: () => options.resourceType ?? "document", allHeaders: async () => headers,
      headerValue: async (key) => headers[key] ?? null, postDataJSON: () => null,
      postDataBuffer: () => options.requestBody ?? null }),
    abort: async () => { aborted++; }, continue: async () => assert.fail("unguarded download"),
    fetch: async (settings) => { fetched.push(settings);
      if (options.fetchError) throw new Error("private signed URL");
      return { status: () => options.status ?? 200, headers: () => ({
        "content-type": options.contentType ?? file.contentType,
        "content-disposition": options.disposition ?? file.disposition,
      }), body: async () => options.body ?? file.body }; },
    fulfill: async (response) => fulfilled.push(response),
  });
  return { guard, fetched, fulfilled, aborted, file };
}
function rejected(result, fetches = 0) {
  assert.equal(result.fetched.length, fetches);
  assert.equal(result.fulfilled.length, 0);
  assert.equal(result.aborted, 1);
  assert.throws(() => result.guard.assertClean(), (error) => {
    assert.match(error.message, /Release API boundary failed/);
    for (const secret of ["X-Amz", "UNITKEY", "cloudflarestorage", "qa-token", "private signed URL"]) {
      assert.equal(error.message.includes(secret), false);
    }
    return true;
  });
}
test("owned uploaded HWP and HWPX download exact original bytes and Unicode filenames", async () => {
  for (const hwpx of [false, true]) {
    const result = await exercise({ hwpx });
    result.guard.assertClean();
    assert.equal(result.aborted, 0);
    assert.deepEqual(result.fetched, [{ url: result.file.url, method: "GET",
      headers: { accept: result.file.contentType }, maxRedirects: 0 }]);
    assert.deepEqual(result.fulfilled, [{ status: 200, headers: { "content-type": result.file.contentType,
      "content-disposition": result.file.disposition }, body: result.file.body }]);
  }
});
test("registration requires actual owned QA upload, authenticated presign and exact signed object", async () => {
  const { url } = fixture();
  for (const options of [
    { upload: false }, { presign: false }, { uploadStatus: 400 }, { presignStatus: 403 },
    { apiHeaders: { authorization: "" } }, { apiHeaders: { "x-tenant-code": "qa-foreign" } },
    { boundary: { ...boundary, mode: "readonly" } }, { boundary: { ...boundary, omrR2TenantId: undefined } },
    { metadata: { r2Key: fixture().r2Key.replace("/352/", "/353/") } },
    { metadata: { name: "customer.HWP" } }, { metadata: { contentType: "application/octet-stream" } },
    { metadata: { sizeBytes: 0 } }, { metadata: { sizeBytes: 31 * 1024 * 1024 } },
    { presignData: { download: false } }, { presignData: { r2_key: "foreign" } },
    ...[
      url.replace("tenants/352/", "tenants/353/"), url.replace("students/01012345678/", "students/01099999999/"),
      url.replace("academy-development-artifacts", "academy-production-artifacts"),
      url.replace(origin, "https://foreign.invalid"), url.replace("https://", "https://user:password@"),
      url.replace("Expires=3600", "Expires=3601"), url.replace("response-content-type=", "other="),
      url.replace("response-content-disposition=", "other="), url + "&extra=1", url + "#fragment",
      url.replace("/tenants/352/", "/tenants/353/../352/"),
    ].map((registerUrl) => ({ registerUrl })),
  ]) rejected(await exercise(options));
});
test("download rejects changed URL, credentials, mutation, wrong MIME/name/container/length and redirects", async () => {
  for (const options of [
    { url: fixture().url.replace("a".repeat(64), "b".repeat(64)) }, { method: "POST" }, { method: "HEAD" },
    { resourceType: "fetch" }, { requestBody: Buffer.from("private") },
    ...["authorization", "proxy-authorization", "cookie", "x-tenant-code", "x-student-id", "x-api-key"]
      .map((key) => ({ headers: { [key]: "private" } })),
  ]) rejected(await exercise(options));
  for (const options of [
    { status: 302 }, { status: 403 }, { contentType: "application/octet-stream" },
    { disposition: 'attachment; filename="wrong.HWP"' }, { body: Buffer.from("not hwp!") },
    { body: fixture().body.subarray(0, 4) }, { body: Buffer.concat([fixture().body, Buffer.from("extra")]) },
    { fetchError: true },
  ]) rejected(await exercise(options), 1);
});

