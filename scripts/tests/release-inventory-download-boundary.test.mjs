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
function fixture(hwpx = false, survey = false) {
  if (survey) {
    const name = "시험범위.png", contentType = "image/png";
    const body = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
    const r2Key = "tenants/352/students/01012345678/inventory/시험범위_261011_" + "a".repeat(32) + ".png";
    const disposition = 'attachment; filename="download"; filename*=UTF-8\'\'' + encode(name);
    const u = new URL(fixture().url);
    u.pathname = "/academy-development-artifacts/" + r2Key.split("/").map(encode).join("/");
    u.searchParams.set("response-content-type", contentType);
    u.searchParams.set("response-content-disposition", disposition);
    u.searchParams.set("X-Amz-Expires", "300");
    return { name, r2Key, contentType, body, sizeBytes: body.length, disposition, url: u.href };
  }
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
  const file = fixture(options.hwpx, options.survey);
  let handler;
  const context = { request: { fetch: async () => assert.fail("No direct API transport") },
    exposeBinding: async () => {}, addInitScript: async () => {}, on() {},
    route: async (_pattern, callback) => { handler = callback; } };
  const guard = await installReleaseContextGuard(context, options.boundary ?? boundary);
  const apiHeaders = { origin: boundary.webOrigin, authorization: "Bearer qa-token",
    "x-tenant-code": boundary.tenantCode, ...options.apiHeaders };
  const api = async (path, data, payload, status = 200, method = "POST") => handler({
    request: () => ({ url: () => boundary.apiOrigin + "/api/v1/" + path,
      method: () => method, resourceType: () => "fetch", allHeaders: async () => apiHeaders,
      headerValue: async (key) => apiHeaders[key] ?? null, postDataJSON: () => data, postDataBuffer: () => null }),
    abort: async () => {}, continue: async () => assert.fail("unguarded API"),
    fetch: async () => ({ status: () => status, headers: () => ({ "content-type": "application/json",
      "access-control-allow-origin": boundary.webOrigin, "access-control-allow-credentials": "true" }),
      json: async () => payload }), fulfill: async () => {},
  });
  if (options.survey) {
    if (options.register !== false) await api("surveys/123/responses/?filter=all", null, { survey: { id: 123 }, results: [{
      student_id: 17, answered: true, response: {
        survey_id: 123, student_id: 17, student_ps: "01012345678",
        attachments: [{ name: file.name, content_type: file.contentType, size_bytes: file.sizeBytes, r2_key: file.r2Key, ...options.metadata }],
        ...options.surveyResponse,
      },
    }] }, options.registerStatus ?? 200, "GET");
  } else if (options.upload !== false) {
    await api("storage/inventory/upload/", {}, { ...file, ...options.metadata }, options.uploadStatus ?? 201);
  }
  if (options.presign !== false) await api("storage/inventory/presign/", { r2_key: file.r2Key, download: true,
    ...(options.survey ? { expires_in: 300 } : {}), ...options.presignData },
    { url: options.registerUrl ?? file.url }, options.presignStatus ?? 200);
  const fetched = [], fulfilled = [];
  let aborted = 0;
  const headers = { ...(options.survey ? { origin: boundary.webOrigin } : {}), ...options.headers };
  await handler({
    request: () => ({ url: () => options.url ?? options.registerUrl ?? file.url, method: () => options.method ?? "GET",
      resourceType: () => options.resourceType ?? (options.survey ? "xhr" : "document"), allHeaders: async () => headers,
      headerValue: async (key) => headers[key] ?? null, postDataJSON: () => null,
      postDataBuffer: () => options.requestBody ?? null }),
    abort: async () => { aborted++; }, continue: async () => assert.fail("unguarded download"),
    fetch: async (settings) => { fetched.push(settings);
      if (options.fetchError) throw new Error("private signed URL");
      return { status: () => options.status ?? 200, headers: () => ({
        "content-type": options.contentType ?? file.contentType,
        "content-disposition": options.disposition ?? file.disposition,
        ...(options.survey ? { "access-control-allow-origin": options.allowOrigin ?? boundary.webOrigin } : {}),
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


test("staff survey download reads only the isolated, presigned synthetic attachment", async () => {
  const result = await exercise({ survey: true });
  result.guard.assertClean();
  assert.equal(result.aborted, 0);
  assert.deepEqual(result.fetched, [{ url: result.file.url, method: "GET",
    headers: { accept: "image/png", origin: boundary.webOrigin }, maxRedirects: 0 }]);
  assert.deepEqual(result.fulfilled, [{ status: 200, headers: { "content-type": "image/png",
    "access-control-allow-origin": boundary.webOrigin, "cache-control": "no-store" }, body: result.file.body }]);
});

test("survey read fails closed on missing provenance, altered signature, other actors or bytes", async () => {
  const { r2Key, url, body } = fixture(false, true);
  for (const options of [
    { register: false }, { registerStatus: 403 }, { presign: false }, { presignStatus: 403 },
    { boundary: { ...boundary, mode: "readonly" } }, { apiHeaders: { "x-student-id": "17" } },
    { surveyResponse: { survey_id: 124 } }, { surveyResponse: { student_id: 18 } },
    { metadata: { r2_key: r2Key.replace("/352/", "/353/") } },
    { metadata: { r2_key: r2Key.replace("/01012345678/", "/01000000000/") } },
    { metadata: { name: "other.png" } }, { metadata: { size_bytes: 69 } },
    { presignData: { expires_in: 301 } }, { registerUrl: url.replace("Expires=300", "Expires=301") },
    { registerUrl: url.replace("academy-development-artifacts", "academy-production-artifacts") },
    { url: url.replace("a".repeat(64), "b".repeat(64)) }, { method: "HEAD" }, { resourceType: "document" },
    { headers: { origin: "https://foreign.invalid" } }, { headers: { authorization: "private" } },
  ]) rejected(await exercise({ survey: true, ...options }));
  for (const options of [
    { status: 302 }, { allowOrigin: "https://foreign.invalid" }, { disposition: "inline" },
    { body: Buffer.concat([body.subarray(0, -1), Buffer.from([0])]) },
  ]) rejected(await exercise({ survey: true, ...options }), 1);
});
