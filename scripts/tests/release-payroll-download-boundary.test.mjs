import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = readFileSync(new URL("../../e2e/helpers/releaseApiBoundary.ts", import.meta.url), "utf8");
const { releaseBoundaryFromEnv, installReleaseContextGuard, assertReleaseRequestSafe } = await import(
  "data:text/javascript;base64," + Buffer.from(stripTypeScriptTypes(source)).toString("base64")
);
const boundary = releaseBoundaryFromEnv({ E2E_RELEASE_API_MODE: "development", E2E_ALLOW_PRODUCTION_WRITES: "0",
  E2E_BASE_URL: "http://localhost:4173", E2E_API_URL: "http://127.0.0.1:18000",
  E2E_TENANT_CODE: "qa-ymath-realuse-payroll", E2E_OMR_R2_TENANT_ID: "352" });
const origin = "https://af4f2937d73db240e99864b8518265c5.r2.cloudflarestorage.com";
const jobId = "11111111-1111-4111-8111-111111111111";
const filename = "payroll_2026_8.xlsx";
const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const disposition = 'attachment; filename="' + filename + '"; filename*=UTF-8\'\'' + filename;
const query = new URLSearchParams({ "response-content-type": mime, "response-content-disposition": disposition,
  "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
  "X-Amz-Credential": "UNITKEYUNITKEY123456/20260919/auto/s3/aws4_request",
  "X-Amz-Date": "20260919T010000Z", "X-Amz-Expires": "3600",
  "X-Amz-SignedHeaders": "host", "X-Amz-Signature": "a".repeat(64) });
const signedUrl = origin + "/academy-development-artifacts/exports/352/" + jobId + "_" + filename + "?" + query;
const xlsxBytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x50, 0x50, 0x54, 0x58]);

async function exercise(options = {}) {
  let handler;
  const context = { request: { fetch: async () => assert.fail("No direct API transport") },
    exposeBinding: async () => {}, addInitScript: async () => {}, on() {},
    route: async (_pattern, callback) => { handler = callback; } };
  const guard = await installReleaseContextGuard(context, options.boundary ?? boundary);
  const apiHeaders = { origin: boundary.webOrigin, authorization: "Bearer qa-token",
    "x-tenant-code": boundary.tenantCode, ...options.apiHeaders };
  const api = async (path, method, payload, status = 200) => {
    await handler({ request: () => ({
      url: () => boundary.apiOrigin + path, method: () => method, resourceType: () => "fetch",
      allHeaders: async () => apiHeaders, headerValue: async (name) => apiHeaders[name] ?? null,
      postDataJSON: () => method === "POST" ? (options.period ?? { year: 2026, month: 8, force_rerun: true }) : null, postDataBuffer: () => null,
    }), abort: async () => {}, continue: async () => assert.fail("unguarded API"),
    fetch: async () => ({ status: () => status,
      headers: () => ({ "content-type": "application/json", "access-control-allow-origin": boundary.webOrigin,
        "access-control-allow-credentials": "true" }), json: async () => payload }),
    fulfill: async () => {} });
  };
  if (options.submit !== false) {
    await api("/api/v1/staffs/payroll-snapshots/export-excel/", "POST", { job_id: options.submittedJobId ?? jobId },
      options.submitStatus ?? 201);
  }
  if (options.statusRead !== false) {
    await api("/api/v1/jobs/" + (options.statusJobId ?? jobId) + (options.detail ? "/" : "/progress/"),
      "GET", { job_id: options.payloadJobId ?? jobId, job_type: options.jobType ?? "staff_excel_export",
        status: options.jobStatus ?? "DONE", result: { download_url: options.registerUrl ?? signedUrl,
          filename: options.filename ?? filename } }, options.apiStatus ?? 200);
  }
  const fetched = [], fulfilled = [];
  let aborted = 0;
  const requestHeaders = options.headers ?? { referer: boundary.webOrigin + "/workspace/staff/reports" };
  await handler({ request: () => ({
    url: () => options.url ?? options.registerUrl ?? signedUrl,
    method: () => options.method ?? "GET", resourceType: () => options.resourceType ?? "document",
    allHeaders: async () => requestHeaders, headerValue: async (name) => requestHeaders[name] ?? null,
    postDataJSON: () => null, postDataBuffer: () => options.requestBody ?? null,
  }), abort: async () => { aborted++; }, continue: async () => assert.fail("unguarded download"),
  fetch: async (settings) => { fetched.push(settings);
    if (options.fetchError) throw new Error("private signed URL");
    return { status: () => options.status ?? 200,
      headers: () => ({ "content-type": options.contentType ?? mime,
        "content-disposition": options.disposition ?? disposition, location: "https://foreign.invalid" }),
      body: async () => options.body ?? xlsxBytes };
  }, fulfill: async (response) => fulfilled.push(response) });
  return { guard, fetched, fulfilled, aborted };
}

function rejected(result, fetches = 0) {
  assert.equal(result.fetched.length, fetches);
  assert.equal(result.fulfilled.length, 0);
  assert.equal(result.aborted, 1);
  assert.throws(() => result.guard.assertClean(), (error) => {
    assert.match(error.message, /Release API boundary failed/);
    for (const secret of ["X-Amz", "UNITKEY", "cloudflarestorage", "qa-token", "exports/352",
      "private signed URL"]) assert.equal(error.message.includes(secret), false);
    return true;
  });
}

test("exact accepted payroll XLSX job response permits a real binary download with stripped headers", async () => {
  const result = await exercise();
  result.guard.assertClean();
  assert.equal(result.aborted, 0);
  assert.deepEqual(result.fetched, [{ url: signedUrl, method: "GET",
    headers: { accept: mime }, maxRedirects: 0 }]);
  assert.deepEqual(result.fulfilled, [{ status: 200,
    headers: { "content-type": mime, "content-disposition": disposition }, body: xlsxBytes }]);
  const recovery = await exercise({ detail: true, resourceType: "other" });
  recovery.guard.assertClean();
  assert.equal(recovery.fulfilled.length, 1);
  rejected(await exercise({ submit: false }));
  assert.throws(() => assertReleaseRequestSafe(boundary, signedUrl, "GET"), /escaped/);
});

test("payroll XLSX URL registration remains bound to accepted job, development tenant and exact signed object", async () => {
  for (const options of [
    { submitStatus: 400 }, { submittedJobId: "22222222-2222-4222-8222-222222222222" },
    { apiStatus: 403 }, { statusJobId: "22222222-2222-4222-8222-222222222222" },
    { payloadJobId: "22222222-2222-4222-8222-222222222222" }, { jobType: "matchup_analysis" },
    { jobStatus: "RUNNING" }, { period: { year: 2026, month: 7 } },
    { period: { year: 2026, month: 13 } }, { period: { year: 2019, month: 8 } }, { apiHeaders: { authorization: "" } },
    { apiHeaders: { "x-tenant-code": "qa-ymath-realuse-foreign" } },
    { boundary: { ...boundary, mode: "readonly" } },
    { boundary: { ...boundary, omrR2TenantId: undefined } },
    ...[
      signedUrl.replace("exports/352/", "exports/353/"),
      signedUrl.replace("academy-development-artifacts", "academy-production-artifacts"),
      signedUrl.replace(origin, "https://foreign.invalid"),
      signedUrl.replace("https://", "https://user:password@"),
      signedUrl.replace(".xlsx?", ".pdf?"),
      signedUrl.replace("Expires=3600", "Expires=3601"),
      signedUrl.replace("response-content-type=", "other="),
      signedUrl.replace("response-content-disposition=", "other="),
      signedUrl.replace("payroll_", "other_"),
      signedUrl + "&extra=1", signedUrl + "#fragment",
      signedUrl.replace("/exports/352/", "/exports/353/../352/"),
    ].map((registerUrl) => ({ registerUrl })),
  ]) rejected(await exercise(options));
});

test("registered payroll XLSX download rejects changed URL, app credentials, mutation and invalid R2 bytes", async () => {
  for (const options of [
    { url: signedUrl.replace("a".repeat(64), "b".repeat(64)) },
    { method: "POST" }, { method: "HEAD" }, { resourceType: "fetch" }, { resourceType: "image" },
    { requestBody: Buffer.from("private") },
    ...["authorization", "proxy-authorization", "cookie", "x-tenant-code", "x-student-id", "x-api-key"]
      .map((key) => ({ headers: { [key]: "private" } })),
  ]) rejected(await exercise(options));
  for (const options of [
    { status: 302 }, { status: 403 }, { contentType: "application/octet-stream" },
    { disposition: 'attachment; filename="foreign.xlsx"' }, { body: Buffer.from("not xlsx") },
    { body: xlsxBytes.subarray(0, 2) }, { fetchError: true },
  ]) rejected(await exercise(options), 1);
});
