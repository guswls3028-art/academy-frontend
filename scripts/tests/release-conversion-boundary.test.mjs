import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = readFileSync(new URL("../../e2e/helpers/releaseApiBoundary.ts", import.meta.url), "utf8");
const { isExactDevelopmentConversionAsset: accepts, installReleaseContextGuard } = await import(
  "data:text/javascript;base64," + Buffer.from(stripTypeScriptTypes(source)).toString("base64")
);
const id = "11111111-1111-4111-8111-111111111111";
const boundary = { mode: "development", omrR2TenantId: 352 };
const origin = "https://af4f2937d73db240e99864b8518265c5.r2.cloudflarestorage.com";
function url({ tenant = 352, conversion = id, expires = "900", filename = "page-1.png", mime = "image/png" } = {}) {
  const query = new URLSearchParams({ "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": "aaaaaaaaaaaaaaaa/20261014/auto/s3/aws4_request", "X-Amz-Date": "20261014T010000Z",
    "X-Amz-Expires": expires, "X-Amz-SignedHeaders": "host", "X-Amz-Signature": "a".repeat(64),
    "response-content-type": mime, "response-content-disposition": `attachment; filename="${filename}"` });
  return `${origin}/academy-development-artifacts/tenants/${tenant}/tools/problem-studio/conversions/${conversion}/${"a".repeat(20)}/${filename}?${query}`;
}
test("conversion readback only permits exact tenant, conversion, filename, type and short signature", () => {
  assert.equal(accepts(boundary, url(), id, "page-1.png", "image/png"), true);
  assert.equal(accepts(boundary, url({ filename: "exam.hwpx", mime: "application/hwp+zip" }), id, "exam.hwpx", "application/hwp+zip"), true);
  for (const value of [url({ tenant: 353 }), url({ conversion: "22222222-2222-4222-8222-222222222222" }),
    url({ expires: "3600" }), url().replace("academy-development-artifacts", "academy-storage"),
    url() + "&X-Amz-Expires=900", url() + "#unsafe", url().replace(origin, "https://example.com")]) {
    assert.equal(accepts(boundary, value, id, "page-1.png", "image/png"), false);
  }
  assert.equal(accepts({ ...boundary, mode: "readonly" }, url(), id, "page-1.png", "image/png"), false);
  assert.equal(accepts(boundary, url(), id, "different.png", "image/png"), false);
  assert.equal(accepts(boundary, url(), id, "page-1.png", "text/html"), false);
});

async function readConversionImage(options = {}) {
  const active = { ...boundary, apiOrigin: "http://127.0.0.1:18000", webOrigin: "http://localhost:4173",
    tenantCode: "qa-ymath-realuse-conversion" };
  let handler;
  const context = { request: { fetch: async () => assert.fail("Unexpected direct request") },
    exposeBinding: async () => {}, addInitScript: async () => {}, on() {},
    route: async (_pattern, callback) => { handler = callback; } };
  const guard = await installReleaseContextGuard(context, active);
  const filename = options.filename ?? "page-1.jpg";
  const mime = options.mime ?? "image/jpeg";
  const signed = url({ filename, mime, tenant: options.tenant ?? 352 });
  const headers = { origin: active.webOrigin, authorization: "Bearer qa-token", "x-tenant-code": active.tenantCode };
  let apiFulfilled = 0, imageFulfilled = 0, imageFetched = 0;
  const request = (target, resourceType, values = {}) => ({ url: () => target, method: () => "GET", resourceType: () => resourceType,
    allHeaders: async () => values, headerValue: async name => values[name] ?? null, postDataJSON: () => null, postDataBuffer: () => null });
  await handler({ request: () => request(`${active.apiOrigin}/api/v1/tools/problem-studio/conversions/${id}/`, "fetch", headers),
    abort: async () => {}, continue: async () => assert.fail("Unguarded API"),
    fetch: async () => ({ status: () => 200, headers: () => ({ "content-type": "application/json",
      "access-control-allow-origin": active.webOrigin, "access-control-allow-credentials": "true" }),
      json: async () => ({ id, document: { pages: [{ filename, mime, url: signed }], questions: [] } }) }),
    fulfill: async () => { apiFulfilled++; } });
  await handler({ request: () => request(signed, "image", options.headers),
    abort: async () => {}, continue: async () => assert.fail("Unguarded image"),
    fetch: async () => { imageFetched++; return { status: () => 200,
      headers: () => ({ "content-type": options.responseType ?? mime, "access-control-allow-origin": active.webOrigin }),
      body: async () => options.body ?? Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]) }; },
    fulfill: async () => { imageFulfilled++; } });
  return { guard, apiFulfilled, imageFulfilled, imageFetched };
}

test("PDF JPEG readback and original preview keep exact scope, MIME and byte checks", async () => {
  for (const filename of ["page-1.jpg", "figure-1.jpg", "page-1.png"]) {
    const result = await readConversionImage({ filename }); // Existing saved JPEGs may have the old PNG suffix.
    result.guard.assertClean();
    assert.equal(result.apiFulfilled, 1);
    assert.equal(result.imageFulfilled, 1);
  }
  const png = await readConversionImage({ filename: "page-1.png", mime: "image/png",
    body: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) });
  png.guard.assertClean();
  assert.equal(png.imageFulfilled, 1);
  for (const options of [{ tenant: 353 }, { body: Buffer.from("<html>not an image</html>") },
    { responseType: "text/html" }, { headers: { authorization: "Bearer qa-token" } }]) {
    const result = await readConversionImage(options);
    assert.equal(result.imageFulfilled, 0);
    assert.throws(() => result.guard.assertClean(), /Release API boundary failed/);
  }
});
