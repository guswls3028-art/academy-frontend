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
  E2E_TENANT_CODE: "qa-ymath-realuse-community", E2E_OMR_R2_TENANT_ID: "352" });
const origin = "https://af4f2937d73db240e99864b8518265c5.r2.cloudflarestorage.com";
const query = new URLSearchParams({ "response-content-type": "image/png", "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
  "X-Amz-Credential": "UNITKEYUNITKEY123456/20260919/auto/s3/aws4_request", "X-Amz-Date": "20260919T010000Z",
  "X-Amz-Expires": "3600", "X-Amz-SignedHeaders": "host", "X-Amz-Signature": "a".repeat(64) });
const url = `${origin}/academy-development-artifacts/tenants/352/community/posts/123/uploads/0123456789abcdef0123456789abcdef/0_${"b".repeat(16)}_${"c".repeat(8)}_qa-problem.png?${query}`;
const signedDownload = new URL(url);
signedDownload.searchParams.set("response-content-disposition", 'attachment; filename="qa-problem.png"');
const downloadUrl = signedDownload.href;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64");

async function exercise(options = {}) {
  let handler;
  const context = { request: { fetch: async () => assert.fail("No direct API transport") },
    exposeBinding: async () => {}, addInitScript: async () => {}, on() {},
    route: async (_pattern, callback) => { handler = callback; } };
  const guard = await installReleaseContextGuard(context, options.boundary ?? boundary);
  if (options.register !== false) {
    const apiHeaders = { origin: boundary.webOrigin, authorization: "Bearer qa-token",
      "x-tenant-code": boundary.tenantCode, ...options.apiHeaders };
    const apiRequest = { url: () => `${boundary.apiOrigin}${options.apiPath ?? (options.list ? "/api/v1/community/posts/?page_size=200&post_type=qna" : "/api/v1/community/posts/123/")}`,
      method: () => options.apiMethod ?? "GET", resourceType: () => "fetch", allHeaders: async () => apiHeaders,
      headerValue: async (name) => apiHeaders[name] ?? null, postDataJSON: () => null, postDataBuffer: () => null };
    await handler({ request: () => apiRequest, abort: async () => {}, continue: async () => assert.fail("unguarded API"),
      fetch: async () => ({ status: () => options.apiStatus ?? 200,
        headers: () => ({ "content-type": "application/json", "access-control-allow-origin": options.corsOrigin ?? boundary.webOrigin,
          "access-control-allow-credentials": "true" }),
        json: async () => options.payload ?? (options.list ? [{ id: options.postId ?? 123, post_type: options.postType ?? "qna",
          attachments: options.attachments ?? [{ id: 456, original_name: "qa-problem.png",
            content_type: options.attachmentType ?? "image/png", download_url: options.registerUrl ?? url }] }]
          : { id: options.postId ?? 123, post_type: options.postType ?? "qna",
          attachments: options.attachments ?? [{ id: 456, content_type: options.attachmentType ?? "image/png",
            original_name: "qa-problem.png", download_url: options.registerUrl ?? url }] }) }), fulfill: async () => {} });
  }
  if (options.download) {
    const apiHeaders = { origin: boundary.webOrigin, authorization: "Bearer qa-token", "x-tenant-code": boundary.tenantCode,
      ...options.downloadHeaders };
    await handler({ request: () => ({ url: () => `${boundary.apiOrigin}${options.downloadPath ?? "/api/v1/community/posts/123/attachments/456/download/"}`,
      method: () => "GET", resourceType: () => "fetch", allHeaders: async () => apiHeaders,
      headerValue: async (name) => apiHeaders[name] ?? null, postDataJSON: () => null, postDataBuffer: () => null }),
    abort: async () => {}, continue: async () => assert.fail("unguarded download API"),
    fetch: async () => ({ status: () => options.downloadStatus ?? 200,
      headers: () => ({ "content-type": "application/json", "access-control-allow-origin": boundary.webOrigin,
        "access-control-allow-credentials": "true" }),
      json: async () => ({ url: options.downloadUrl ?? downloadUrl, original_name: options.downloadName ?? "qa-problem.png" }) }),
    fulfill: async () => {} });
  }
  const fetched = [], fulfilled = [];
  let aborted = 0;
  const imageHeaders = options.headers ?? { referer: `${boundary.webOrigin}/workspace/community/qna` };
  await handler({ request: () => ({ url: () => options.url ?? (options.download ? options.downloadUrl ?? downloadUrl : options.registerUrl ?? url),
    method: () => options.method ?? "GET", resourceType: () => options.resourceType ?? "image",
    allHeaders: async () => imageHeaders, headerValue: async (name) => imageHeaders[name] ?? null,
    postDataJSON: () => null, postDataBuffer: () => options.requestBody ?? null }),
  abort: async () => { aborted++; }, continue: async () => assert.fail("unguarded image"),
  fetch: async (settings) => { fetched.push(settings); if (options.fetchError) throw new Error("private signed URL");
    return { status: () => options.status ?? 200,
      headers: () => ({ "content-type": options.contentType ?? "image/png", "set-cookie": "private",
        ...(options.disposition ? { "content-disposition": options.disposition } : {}) }),
      body: async () => options.body ?? png }; }, fulfill: async (response) => fulfilled.push(response) });
  return { guard, fetched, fulfilled, aborted };
}

function rejected(result, fetches = 0) {
  assert.equal(result.fetched.length, fetches);
  assert.equal(result.fulfilled.length, 0);
  assert.equal(result.aborted, 1);
  assert.throws(() => result.guard.assertClean(), (error) => {
    assert.match(error.message, /Release API boundary failed/);
    for (const secret of ["X-Amz", "UNITKEY", "cloudflarestorage", "qa-token", "tenants/352", "private signed URL"]) {
      assert.equal(error.message.includes(secret), false);
    }
    return true;
  });
}

for (const kind of ["board", "reviews"]) test(`public ${kind} photos require exact authenticated tenant detail and signed development object`, async () => {
  const photoQuery = new URLSearchParams(query);
  photoQuery.delete("response-content-type");
  photoQuery.set("X-Amz-Expires", "604800");
  const photo = `${origin}/academy-development-artifacts/landing-public/reviews/352/users/12/${"b".repeat(64)}.png?${photoQuery}`;
  const defaults = { apiPath: `/api/v1/landing-public/${kind}/123/`, registerUrl: photo,
    payload: { id: 123, ...(kind === "board" ? { meta: { photos: [photo] } } : { photos: [photo] }) } };
  const accepted = await exercise(defaults);
  accepted.guard.assertClean();
  assert.deepEqual(accepted.fulfilled, [{ status: 200, headers: { "content-type": "image/png" }, body: png }]);
  for (const options of [
    { register: false }, { apiStatus: 403 }, { apiMethod: "POST" }, { apiHeaders: { authorization: "" } },
    { apiHeaders: { "x-tenant-code": "qa-ymath-realuse-other" } }, { payload: { id: 124, photos: [photo], meta: { photos: [photo] } } },
    { apiPath: `${defaults.apiPath}?extra=1` }, { headers: { authorization: "Bearer qa-token" } }, { status: 302 },
    { body: Buffer.from("not an image") }, { boundary: { ...boundary, mode: "readonly" } },
  ]) rejected(await exercise({ ...defaults, ...options }), options.status || options.body ? 1 : 0);
  for (const invalid of [photo.replace("/352/", "/353/"), photo.replace("academy-development-artifacts", "academy-admin"),
    photo.replace(origin, "https://foreign.invalid"), photo.replace("Expires=604800", "Expires=604801"),
    photo.replace("/users/12/", "/users/0/"), `${photo}&extra=1`, `${photo}#fragment`]) {
    rejected(await exercise({ ...defaults, registerUrl: invalid, payload: { id: 123, photos: [invalid], meta: { photos: [invalid] } } }));
  }
});

test("QnA image requires exact authenticated post response and preserves R2 PNG bytes", async () => {
  const result = await exercise();
  result.guard.assertClean();
  assert.equal(result.aborted, 0);
  assert.deepEqual(result.fetched, [{ url, method: "GET", headers: { accept: "image/png" }, maxRedirects: 0 }]);
  assert.deepEqual(result.fulfilled, [{ status: 200, headers: { "content-type": "image/png" }, body: png }]);
  rejected(await exercise({ register: false }));
  rejected(await exercise({ url: url.replace("a".repeat(64), "d".repeat(64)) }));
  assert.throws(() => assertReleaseRequestSafe(boundary, url, "GET"), /escaped/);
});

test("student QnA list binds attachment ID to an exact authorized download URL", async () => {
  const result = await exercise({ list: true, download: true });
  result.guard.assertClean();
  assert.equal(result.aborted, 0);
  assert.deepEqual(result.fetched, [{ url: downloadUrl, method: "GET", headers: { accept: "image/png" }, maxRedirects: 0 }]);
  assert.deepEqual(result.fulfilled, [{ status: 200, headers: { "content-type": "image/png" }, body: png }]);
  for (const options of [
    { register: false }, { postType: "notice" }, { postId: 124 }, { downloadStatus: 403 },
    { downloadPath: "/api/v1/community/posts/123/attachments/457/download/" },
    { downloadPath: "/api/v1/community/posts/124/attachments/456/download/" },
    { downloadName: "other.png" }, { downloadHeaders: { authorization: "" } },
    { downloadUrl: downloadUrl.replace("tenants/352/", "tenants/353/") },
    { downloadUrl: downloadUrl.replace("response-content-disposition=", "other=") },
  ]) rejected(await exercise({ list: true, download: true, ...options }));
});

test("notice detail binds saved photos and refreshed student download URLs", async () => {
  for (const download of [false, true]) {
    const result = await exercise({ postType: "notice", download });
    result.guard.assertClean();
    assert.equal(result.aborted, 0);
    assert.deepEqual(result.fetched, [{ url: download ? downloadUrl : url, method: "GET", headers: { accept: "image/png" }, maxRedirects: 0 }]);
    assert.deepEqual(result.fulfilled, [{ status: 200, headers: { "content-type": "image/png" }, body: png }]);
  }
});

for (const postType of ["qna", "notice", "board", "materials", "counsel"]) test(`${postType} registration rejects foreign API responses and loose R2 URL scopes`, async () => {
  const accepted = await exercise({ postType });
  accepted.guard.assertClean();
  assert.equal(accepted.fulfilled.length, 1);
  for (const options of [
    { apiStatus: 403 }, { apiStatus: 302 }, { apiMethod: "POST" },
    { apiHeaders: { authorization: "" } }, { apiHeaders: { "x-tenant-code": "qa-ymath-realuse-other" } },
    { corsOrigin: "https://foreign.invalid" }, { apiPath: "/api/v1/community/posts/124/" },
    { apiPath: "/api/v1/community/posts/123/?extra=1" }, { postId: 124 }, { postType: "private" }, { postType: ["notice"] },
    { attachments: Array.from({ length: 11 }, () => ({ content_type: "image/png", download_url: url })) },
    { boundary: { ...boundary, mode: "readonly" } }, { boundary: { ...boundary, omrR2TenantId: undefined } },
    ...[
      url.replace("tenants/352/", "tenants/353/"), url.replace("posts/123/", "posts/124/"),
      url.replace("academy-development-artifacts", "academy-production-artifacts"),
      url.replace(origin, "https://foreign.invalid"), url.replace(".png?", ".pdf?"),
      url.replace("Expires=3600", "Expires=3601"), url.replace("response-content-type=image%2Fpng", "response-content-type=image%2Fjpeg"),
      `${url}&extra=1`, `${url}#fragment`, url.replace("tenants/352/", "tenants/353/../352/"),
    ].map((registerUrl) => ({ registerUrl })),
  ]) rejected(await exercise({ postType, ...options }));
});

test("QnA signed image rejects credentials, mutation, non-image use and invalid R2 responses", async () => {
  for (const options of [
    { method: "POST" }, { method: "HEAD" }, { resourceType: "fetch" }, { resourceType: "document" },
    { requestBody: Buffer.from("private") },
    ...["authorization", "proxy-authorization", "cookie", "x-tenant-code", "x-student-id", "x-api-key"]
      .map((key) => ({ headers: { [key]: "private" } })),
  ]) rejected(await exercise(options));
  for (const options of [{ status: 302 }, { status: 403 }, { contentType: "image/jpeg" },
    { body: Buffer.from("not png") }, { body: png.subarray(0, 4) }, { fetchError: true }]) {
    rejected(await exercise(options), 1);
  }
});

for (const postType of ["qna", "notice", "board", "materials", "counsel"]) test(`${postType} file downloads require bound metadata and exact development bytes`, async () => {
  for (const [extension, contentType, body, unicodeName] of [
    ["txt", "text/plain", Buffer.from("QA attachment\n")],
    ["pdf", "application/pdf", Buffer.from("%PDF-1.4\n%%EOF")],
    ["txt", "text/plain", Buffer.from("QA unicode attachment\n"), "qa-질문-추가-학습자료.txt"],
  ]) {
    const name = unicodeName ?? `qa-problem.${extension}`;
    const disposition = unicodeName
      ? `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(name)}`
      : `attachment; filename="${name}"`;
    const fileUrl = new URL(downloadUrl.replace("qa-problem.png?", `${name}?`));
    fileUrl.searchParams.set("response-content-type", contentType);
    fileUrl.searchParams.set("response-content-disposition", disposition);
    const attachments = [{ id: 456, original_name: name, content_type: contentType, size_bytes: body.length }];
    const options = { postType, download: true, downloadUrl: fileUrl.href, downloadName: name, resourceType: "document",
      attachments, body, contentType, disposition };
    const result = await exercise(options);
    result.guard.assertClean();
    assert.deepEqual(result.fetched, [{ url: fileUrl.href, method: "GET", headers: { accept: contentType }, maxRedirects: 0 }]);
    assert.deepEqual(result.fulfilled, [{ status: 200, headers: { "content-type": contentType, "content-disposition": disposition }, body }]);
    for (const invalid of [
      { register: false }, { downloadStatus: 403 }, { postId: 124 }, { postType: "private" },
      { downloadPath: "/api/v1/community/posts/123/attachments/457/download/" },
      { downloadHeaders: { authorization: "" } }, { downloadName: "another.txt" },
      { downloadUrl: fileUrl.href.replace("tenants/352/", "tenants/353/") },
      { downloadUrl: fileUrl.href.replace("academy-development-artifacts", "academy-production-artifacts") },
      { downloadUrl: fileUrl.href.replace("Expires=3600", "Expires=3601") },
      { downloadUrl: fileUrl.href + "&extra=1" },
      { url: fileUrl.href.replace("a".repeat(64), "d".repeat(64)) },
      { method: "POST" }, { method: "HEAD" }, { resourceType: "fetch" }, { resourceType: "image" },
      { requestBody: Buffer.from("private") }, { boundary: { ...boundary, mode: "readonly" } },
      ...[0, -1, 1.5, 50 * 1024 * 1024 + 1, undefined].map((size_bytes) => ({ attachments: [{ ...attachments[0], size_bytes }] })),
      ...["authorization", "proxy-authorization", "cookie", "x-tenant-code", "x-student-id", "x-api-key"]
        .map((key) => ({ headers: { [key]: "private" } })),
    ]) rejected(await exercise({ ...options, ...invalid }));
    for (const invalid of [{ status: 302 }, { status: 403 }, { disposition: undefined },
      { disposition: "inline" }, { contentType: "text/html" }, { body: body.subarray(1) }, { fetchError: true }]) {
      rejected(await exercise({ ...options, ...invalid }), 1);
    }
    if (extension === "pdf") rejected(await exercise({ ...options, body: Buffer.alloc(body.length, 32) }), 1);
  }
});
