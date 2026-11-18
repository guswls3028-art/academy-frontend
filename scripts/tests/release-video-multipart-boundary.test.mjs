import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = readFileSync(new URL("../../e2e/helpers/releaseApiBoundary.ts", import.meta.url), "utf8");
const { releaseBoundaryFromEnv, installReleaseContextGuard } = await import(
  "data:text/javascript;base64," + Buffer.from(stripTypeScriptTypes(source)).toString("base64")
);
const env = {
  E2E_RELEASE_API_MODE: "development", E2E_ALLOW_PRODUCTION_WRITES: "0",
  E2E_BASE_URL: "http://localhost:4173", E2E_API_URL: "http://127.0.0.1:18000",
  E2E_TENANT_CODE: "qa-ymath-realuse-video", E2E_OMR_R2_TENANT_ID: "352",
  E2E_VIDEO_MULTIPART_SESSION_ID: "17",
};
const boundary = releaseBoundaryFromEnv(env);
const apiBase = "/api/v1/media/videos/";
const multipartBase = apiBase + "28/upload/multipart/";
const fileKey = "tenants/352/video/raw/17/00000000-0000-4000-8000-000000000001.mp4";
const query = new URLSearchParams({
  uploadId: "qa.upload-id", partNumber: "1", "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
  "X-Amz-Credential": "UNITKEYUNITKEY123456/20261117/auto/s3/aws4_request",
  "X-Amz-Date": "20261117T010000Z", "X-Amz-Expires": "3600",
  "X-Amz-SignedHeaders": "host", "X-Amz-Signature": "a".repeat(64),
});
const url = "https://af4f2937d73db240e99864b8518265c5.r2.cloudflarestorage.com/academy-development-artifacts/" + fileKey + "?" + query;
const bytes = Buffer.from([1, 2, 3]);
const responseEtag = '"' + "b".repeat(32) + '"';

async function exercise(options = {}) {
  let handler;
  const context = {
    request: { fetch: async () => assert.fail("No direct API transport") },
    exposeBinding: async () => {}, addInitScript: async () => {}, on() {},
    route: async (_pattern, callback) => { handler = callback; },
  };
  const guard = await installReleaseContextGuard(context, options.boundary ?? boundary);
  const recordApi = async (path, body, payload, status = 200) => {
    const headers = { origin: boundary.webOrigin, authorization: "Bearer test-app-token",
      "x-tenant-code": boundary.tenantCode, ...options.apiHeaders };
    await handler({
      request: () => ({ url: () => boundary.apiOrigin + path, method: () => "POST",
        resourceType: () => "fetch", allHeaders: async () => headers,
        headerValue: async (name) => headers[name] ?? null, postDataJSON: () => body,
        postDataBuffer: () => Buffer.from(JSON.stringify(body)) }),
      fetch: async () => ({
        status: () => status, headers: () => ({
          "content-type": "application/json", "access-control-allow-origin": boundary.webOrigin,
          "access-control-allow-credentials": "true",
        }), json: async () => payload,
      }),
      abort: async () => {}, fulfill: async () => {}, continue: async () => assert.fail("unguarded API"),
    });
  };
  if (options.init !== false) {
    await recordApi(apiBase + "upload/init/", { session: options.session ?? 17,
      filename: "qa-native-multipart.mp4", content_type: "video/mp4" },
    { video: { id: 28 }, file_key: options.fileKey ?? fileKey }, 201);
  }
  await recordApi(multipartBase + "init/", { content_type: "video/mp4" },
    { video_id: 28, file_key: fileKey, upload_id: "qa.upload-id" });
  await recordApi(multipartBase + "presign/", { upload_id: options.uploadId ?? "qa.upload-id", part_numbers: [1] },
    { urls: { "1": options.registerUrl ?? url } });
  if (options.abort) {
    await recordApi(multipartBase + "abort/", { upload_id: "qa.upload-id" }, { aborted: true });
  }

  const fetched = [], fulfilled = [];
  let aborted = false;
  const headers = { origin: boundary.webOrigin, ...options.headers };
  const actualFetch = globalThis.fetch;
  globalThis.fetch = async (target, params) => {
    fetched.push({ target, params });
    return new Response(null, { status: options.status ?? 200, headers: {
      "access-control-allow-origin": boundary.webOrigin, "access-control-allow-methods": "PUT",
      "access-control-allow-headers": "content-type", "access-control-expose-headers": "ETag",
      etag: responseEtag, "set-cookie": "should-not-propagate", ...options.responseHeaders,
    } });
  };
  try {
    await handler({
      request: () => ({ url: () => options.requestUrl ?? url, method: () => options.method ?? "PUT",
        resourceType: () => options.resource ?? "xhr", allHeaders: async () => headers,
        headerValue: async (name) => headers[name] ?? null, postDataJSON: () => null,
        postDataBuffer: () => options.body ?? bytes }),
      abort: async () => { aborted = true; }, fulfill: async (result) => fulfilled.push(result),
      continue: async () => assert.fail("unguarded R2 transfer"),
      fetch: async () => assert.fail("R2 must not inherit Playwright context credentials"),
    });
  } finally {
    globalThis.fetch = actualFetch;
  }
  return { fetched, fulfilled, aborted, guard };
}

function assertDenied(result, expectedFetches = 0) {
  assert.equal(result.fetched.length, expectedFetches);
  assert.equal(result.fulfilled.length, 0);
  assert.equal(result.aborted, true);
  assert.throws(() => result.guard.assertClean(), (error) => {
    assert.match(error.message, /Release API boundary failed/);
    assert.doesNotMatch(error.message, /X-Amz|UNITKEY|qa.upload-id|test-app-token|tenants\/352/);
    return true;
  });
}

test("a registered multipart part sends exact bytes with a credential-free, redirect-free request", async () => {
  const result = await exercise({ headers: { "content-type": "video/mp4", referer: "https://private.invalid/" } });
  result.guard.assertClean();
  assert.equal(result.aborted, false);
  assert.equal(result.fetched.length, 1);
  const { target, params } = result.fetched[0];
  assert.equal(target, url);
  assert.equal(params.method, "PUT");
  assert.equal(params.redirect, "manual");
  assert.deepEqual(params.headers, { origin: boundary.webOrigin, "content-type": "video/mp4" });
  assert.deepEqual(Buffer.from(params.body), bytes);
  assert.deepEqual(result.fulfilled, [{ status: 200, headers: {
    "access-control-allow-origin": boundary.webOrigin, "access-control-expose-headers": "ETag",
    etag: responseEtag,
  } }]);
});

test("real multipart CORS controls preflight and ETag availability without granting a new URL", async () => {
  const opts = { method: "OPTIONS", headers: { "access-control-request-method": "PUT",
    "access-control-request-headers": "content-type" } };
  const result = await exercise(opts);
  result.guard.assertClean();
  assert.equal(result.fetched[0].params.body, undefined);
  assert.equal(result.fulfilled[0].headers["access-control-allow-methods"], "PUT");
  assertDenied(await exercise({ ...opts, headers: { "access-control-request-method": "POST" } }));
  assertDenied(await exercise({ ...opts, responseHeaders: { "access-control-allow-methods": "GET" } }), 1);
  (await exercise({ responseHeaders: { "access-control-expose-headers": "*" } })).guard.assertClean();
  assertDenied(await exercise({ responseHeaders: { "access-control-expose-headers": "Last-Modified" } }), 1);
  assertDenied(await exercise({ responseHeaders: { etag: "missing" } }), 1);
  assertDenied(await exercise({ responseHeaders: { etag: responseEtag.slice(1) } }), 1);
  assertDenied(await exercise({ status: 302, responseHeaders: { location: "https://outside.invalid/" } }), 1);
});

test("only the bound upload and its exact live part URLs can send bytes", async () => {
  for (const options of [
    { init: false }, { session: 18 }, { fileKey: fileKey.replace("/17/", "/18/") },
    { uploadId: "foreign-upload" }, { abort: true },
    { requestUrl: url.replace("partNumber=1", "partNumber=2") },
    { registerUrl: url.replace("academy-development-artifacts", "academy-production-artifacts") },
    { registerUrl: url.replace("/352/", "/353/") }, { registerUrl: url + "&partNumber=1" },
    { registerUrl: url.replace("Expires=3600", "Expires=3601") },
    { boundary: releaseBoundaryFromEnv({ ...env, E2E_VIDEO_MULTIPART_SESSION_ID: undefined }) },
    { method: "POST" }, { resource: "fetch" }, { body: Buffer.alloc(0) },
    { headers: { "content-type": "unreviewed" } }, { headers: { "x-tenant-code": "private" } },
    { headers: { authorization: "secret" } }, { headers: { cookie: "private" } },
  ]) assertDenied(await exercise(options));
});

test("multipart setup can only opt in via an owned development scope", () => {
  assert.throws(() => releaseBoundaryFromEnv({ ...env, E2E_OMR_R2_TENANT_ID: undefined }), /session scope/);
  assert.throws(() => releaseBoundaryFromEnv({ ...env, E2E_API_URL: "http://127.0.0.1:18001" }), /session scope/);
  assert.throws(() => releaseBoundaryFromEnv({ ...env, E2E_VIDEO_MULTIPART_SESSION_ID: "-2" }), /session scope/);
  assert.throws(() => releaseBoundaryFromEnv({ ...env, E2E_VIDEO_MULTIPART_SESSION_ID: "" }), /session scope/);
  assert.throws(() => releaseBoundaryFromEnv({
    ...env, E2E_RELEASE_API_MODE: "readonly", E2E_BASE_URL: "https://hakwonplus.com",
    E2E_API_URL: "https://api.hakwonplus.com", E2E_TENANT_CODE: "hakwonplus", E2E_OMR_R2_TENANT_ID: undefined,
  }), /session scope/);
});
