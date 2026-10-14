import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = readFileSync(new URL("../../e2e/helpers/releaseApiBoundary.ts", import.meta.url), "utf8");
const { isExactDevelopmentConversionAsset: accepts } = await import(
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
