import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
const source = readFileSync(new URL("../../e2e/helpers/releaseApiBoundary.ts", import.meta.url), "utf8");
const { isExactDevelopmentResourceDownload: allowed } = await import("data:text/javascript;base64," + Buffer.from(stripTypeScriptTypes(source + "\nexport { isExactDevelopmentResourceDownload };\n")).toString("base64"));
const file = "11111111-1111-4111-8111-111111111111";
const boundary = { mode: "development", omrR2TenantId: 352 };
const query = new URLSearchParams({ "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": "UNITKEYUNITKEY123456/20261006/auto/s3/aws4_request", "X-Amz-Date": "20261006T010000Z", "X-Amz-Expires": "300", "X-Amz-SignedHeaders": "host", "X-Amz-Signature": "a".repeat(64) });
const url = `https://af4f2937d73db240e99864b8518265c5.r2.cloudflarestorage.com/academy-development-artifacts/landing-public/resources/352/${file}?${query}`;
test("only the exact development tenant/object signature is accepted", () => {
  assert.equal(allowed(boundary, url, file), true);
  for (const target of [url.replace("/352/", "/353/"), url.replace("academy-development-artifacts", "academy-admin"), url.replace(file, "22222222-2222-4222-8222-222222222222"), url.replace("/352/", "/352/../352/"), url + "&extra=1", url + "#fragment", url.replace("Expires=300", "Expires=301"), url.replace("Expires=300", "Expires=300&X-Amz-Expires=300"), url.replace("https://", "https://user:pass@"), url.replace("https://", "http://")]) assert.equal(allowed(boundary, target, file), false);
  assert.equal(allowed({ ...boundary, mode: "readonly" }, url, file), false);
  assert.equal(allowed({ mode: "development" }, url, file), false);
});
