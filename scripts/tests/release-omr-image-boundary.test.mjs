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
    headerValue: async (name) => headers[name] ?? null, postDataJSON: () => undefined,
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
});

test("OMR R2 image refuses redirects, invalid upstream bytes/status and transport errors", async () => {
  for (const options of [{ status: 301 }, { status: 307 }, { status: 403 }, { contentType: "text/html" },
    { body: Buffer.from("not-a-jpeg") }, { fetchError: true }]) assertRejected(await exercise(options), 1);
});
