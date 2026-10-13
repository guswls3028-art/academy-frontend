import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
const source = readFileSync(new URL("../../e2e/helpers/releaseApiBoundary.ts", import.meta.url), "utf8");
const policy = await import("data:text/javascript;base64," + Buffer.from(stripTypeScriptTypes(source
  + "\nexport { registerPublicVideoSources, publicVideoRequestKind };\n")).toString("base64"));
const { registerPublicVideoSources: register, publicVideoRequestKind: kind, installReleaseContextGuard } = policy;
const boundary = { mode: "development", apiOrigin: "http://127.0.0.1:18000", webOrigin: "http://localhost:4173", tenantCode: "qa-ymath-realuse-video" };
const id = "xgjL2HyrdFM";
const video = { youtube_video_id: id, canonical_url: `https://www.youtube.com/watch?v=${id}`, thumbnail_url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
const embed = `https://www.youtube.com/embed/${id}?autoplay=0&playsinline=1&origin=${encodeURIComponent(boundary.webOrigin)}`;
const ids = new Set([id]);

test("only API-shaped sources with fixed canonical and thumbnail addresses are registered", () => {
  const known = new Set(); register({ results: [video] }, known); assert.deepEqual([...known], [id]);
  for (const malformed of [{ ...video, youtube_video_id: "../secret" }, { ...video, canonical_url: "https://foreign.invalid" }, { ...video, thumbnail_url: "https://foreign.invalid" }]) {
    const rejected = new Set(); register(malformed, rejected); assert.equal(rejected.size, 0);
  }
});

test("only registered thumbnail GET and exact non-autoplay embed documents enter the provider boundary", () => {
  assert.equal(kind(boundary, video.thumbnail_url, "GET", "image", ids, false), "thumbnail");
  assert.equal(kind(boundary, embed, "GET", "document", ids, false), "embed");
  for (const url of [embed.replace("autoplay=0", "autoplay=1"), embed + "&autoplay=0", embed.replace(id, "YYTULV4h4Io"), embed.replace("localhost", "foreign.invalid"), embed.replace("https://", "https://user:secret@"), embed + "#x"]) {
    assert.equal(kind(boundary, url, "GET", "document", ids, false), null);
  }
  assert.equal(kind(boundary, video.thumbnail_url, "POST", "image", ids, false), null);
  assert.equal(kind(boundary, video.thumbnail_url, "GET", "fetch", ids, false), null);
  assert.equal(kind(boundary, embed, "GET", "document", new Set(), false), null);
  assert.equal(kind({ ...boundary, mode: "readonly" }, embed, "GET", "document", ids, true), null);
});

test("provider requests require an admitted player frame and never allow platform APIs, spoofed hosts or destructive verbs", () => {
  const telemetry = "https://www.youtube.com/youtubei/v1/log_event";
  assert.equal(kind(boundary, telemetry, "POST", "fetch", ids, true), "player");
  assert.equal(kind(boundary, telemetry, "POST", "fetch", ids, false), null);
  for (const url of ["https://api.hakwonplus.com/api/v1/core/me/", "http://127.0.0.1:18000/api/v1/core/me/", "https://www.youtube.com.foreign.invalid/embed/x", "https://www.youtube.com:8443/player", "https://foreign.invalid/upload"]) {
    assert.equal(kind(boundary, url, "POST", "fetch", ids, true), null);
  }
  for (const method of ["PUT", "PATCH", "DELETE"]) assert.equal(kind(boundary, telemetry, method, "fetch", ids, true), null);
});

async function setup(options = {}) {
  let handler;
  const initializers = [];
  const context = { request: { fetch: async () => assert.fail("No direct external API transport") }, exposeBinding: async () => {}, addInitScript: async (fn, arg) => { initializers.push({ fn, arg }); }, on() {}, route: async (_pattern, callback) => { handler = callback; } };
  const guard = await installReleaseContextGuard(context, boundary);
  if (options.register !== false) {
    const headers = { origin: boundary.webOrigin, "x-tenant-code": boundary.tenantCode };
    await handler({ request: () => ({ url: () => `${boundary.apiOrigin}/api/v1/landing-public/videos/resolve/`, method: () => "POST", resourceType: () => "fetch", allHeaders: async () => headers, headerValue: async (name) => headers[name] ?? null, postDataJSON: () => ({}), postDataBuffer: () => null }),
      abort: async () => assert.fail("Valid QA API source was rejected"), continue: async () => assert.fail("API must use verified transport"),
      fetch: async () => ({ status: () => options.status ?? 200, headers: () => ({ "content-type": "application/json", "access-control-allow-origin": boundary.webOrigin, "access-control-allow-credentials": "true" }), json: async () => video }), fulfill: async () => {} });
  }
  async function request(url, { method = "GET", type = "image", frame, headers = {} } = {}) {
    let continued = 0, aborted = 0;
    await handler({ request: () => ({ url: () => url, method: () => method, resourceType: () => type, frame: () => frame, allHeaders: async () => headers, headerValue: async (name) => headers[name] ?? null, postDataJSON: () => null, postDataBuffer: () => null }),
      continue: async () => { continued++; }, abort: async () => { aborted++; }, fetch: async () => assert.fail("Public player must use native HTTPS"), fulfill: async () => assert.fail("Public player response must not be mocked") });
    return { continued, aborted };
  }
  return { guard, request, initializers };
}

test("real public resources continue without mocked bytes; app credentials and unregistered resources are rejected", async () => {
  const allowed = await setup(); assert.deepEqual(await allowed.request(video.thumbnail_url), { continued: 1, aborted: 0 }); allowed.guard.assertClean();
  for (const options of [{ register: false }, { status: 503 }, { headers: { authorization: "Bearer fixture" } }, { headers: { "x-tenant-code": boundary.tenantCode } }]) {
    const denied = await setup(options); assert.deepEqual(await denied.request(video.thumbnail_url, options), { continued: 0, aborted: 1 }); assert.throws(() => denied.guard.assertClean());
  }
});

test("frame trust is scoped to the actual admitted iframe and ends when it navigates away", async () => {
  const parent = { url: () => `${boundary.webOrigin}/landing/videos/video`, parentFrame: () => null };
  let current = "about:blank";
  const frame = { url: () => current, parentFrame: () => parent };
  const allowed = await setup();
  assert.deepEqual(await allowed.request(embed, { type: "document", frame }), { continued: 1, aborted: 0 });
  current = embed;
  assert.deepEqual(await allowed.request("https://www.youtube.com/youtubei/v1/log_event", { method: "POST", type: "fetch", frame }), { continued: 1, aborted: 0 });
  allowed.guard.assertClean();
  current = `${boundary.webOrigin}/landing`;
  assert.deepEqual(await allowed.request("https://www.youtube.com/youtubei/v1/log_event", { method: "POST", type: "fetch", frame }), { continued: 0, aborted: 1 });
  assert.throws(() => allowed.guard.assertClean());
});

test("native player telemetry cannot carry application credentials, redirect or contact production APIs", async () => {
  const { initializers } = await setup();
  const init = initializers[0];
  for (const scenario of [
    { allowed: true, url: "https://www.youtube.com/youtubei/v1/log_event" },
    { url: "https://api.hakwonplus.com/api/v1/token/" },
    { url: "https://www.youtube.com/youtubei/v1/log_event", headers: { authorization: "Bearer fixture" } },
    { url: "https://www.youtube.com/youtubei/v1/log_event", headers: { "x-tenant-code": boundary.tenantCode } },
    { url: "https://www.youtube.com/youtubei/v1/log_event", page: boundary.webOrigin + "/landing" },
    { url: "https://www.youtube.com/youtubei/v1/log_event", topLevel: true },
    { url: "https://www.youtube.com/youtubei/v1/like/like" },
    { url: "https://foreign.invalid/log_event" },
  ]) {
    const sent = [], rejected = [];
    const window = { Request, fetch: async (...args) => { sent.push(args); return new Response("ok"); }, parent: {}, __academyReleaseKeepaliveViolation: async (code) => rejected.push(code) };
    if (scenario.topLevel) window.parent = window;
    runInNewContext(`(${init.fn.toString()})(boundary)`, { window, boundary: init.arg, URL, location: new URL(scenario.page ?? embed), sessionStorage: { getItem: () => null, setItem() {} }, console: { warn() {} } });
    const pending = window.fetch(scenario.url, { method: "POST", body: "{}", keepalive: true, headers: scenario.headers });
    if (scenario.allowed) {
      await pending; assert.equal(sent.length, 1); assert.equal(sent[0][1].redirect, "error"); assert.deepEqual(rejected, []);
    } else {
      await assert.rejects(pending, /keepalive request refused/); assert.equal(sent.length, 0); assert.equal(rejected.length, 1);
    }
  }
});
