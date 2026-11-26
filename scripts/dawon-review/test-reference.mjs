import test from "node:test";
import assert from "node:assert/strict";
import { serveReference } from "../../deploy/dawon/hakwonplus-reference.mjs";

const origin = "https://original-demo.hakwonplus.com";
const env = { REFERENCE_STATIC_ORIGIN: "https://abcd1234.dawon-original-reference.pages.dev" };

test("the comparison serves the original artifact and links back to all three Dawon roles", async () => {
  const res = await serveReference(new Request(origin + "/workspace/lectures"), env, async (url, options) => {
    assert.equal(url, env.REFERENCE_STATIC_ORIGIN + "/");
    assert.equal(options.headers, undefined);
    return new Response("<html><head></head><body>원본</body></html>", { headers: { "content-type": "text/html" } });
  });
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(html, /data-demo-app="original" aria-current="page"/);
  assert.ok(html.includes("https://demo.hakwonplus.com/login/dawon?demo=admin"));
  assert.match(res.headers.get("content-security-policy"), /connect-src 'self'/);
});

test("the static origin receives neither API traffic nor changes, even when the asset is missing", async () => {
  const unexpected = () => assert.fail("static backend received a non-asset request");
  assert.equal((await serveReference(new Request(origin + "/api/v1/core/me/"), env, unexpected)).status, 404);
  assert.equal((await serveReference(new Request(origin + "/assets/file", {method:"POST"}), env, unexpected)).status, 405);
  assert.equal((await serveReference(new Request(origin), {REFERENCE_STATIC_ORIGIN:"https://hakwonplus.com"}, unexpected)).status, 503);
  const asset = await serveReference(new Request(origin + "/assets/missing.js"), env,
    async () => new Response("<html/>", {headers:{"content-type":"text/html"}}));
  assert.equal(asset.status, 404);
});

test("an asset failure can be retried and immutable paths preserve bytes", async () => {
  const request = new Request(origin + "/assets/lesson-abcdef12.js", {headers:{"authorization":"local-test"}});
  const failed = await serveReference(request, env, async () => { throw Error("unavailable"); });
  assert.equal(failed.status, 503);
  const asset = await serveReference(request, env, async (url, options) => {
    assert.equal(url, env.REFERENCE_STATIC_ORIGIN + "/assets/lesson-abcdef12.js");
    assert.equal(options.headers, undefined);
    return new Response("export default 1", {headers:{"content-type":"text/javascript"}});
  });
  assert.equal(await asset.text(), "export default 1");
  assert.match(asset.headers.get("cache-control"), /immutable/);
});
