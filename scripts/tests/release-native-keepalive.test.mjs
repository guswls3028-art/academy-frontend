import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { chromium } from "@playwright/test";
import { createPlaybackEndProxy, PLAYBACK_END_PROXY_PATH } from "../release-playback-end-proxy.mjs";

const source = readFileSync(new URL("../../e2e/helpers/releaseApiBoundary.ts", import.meta.url), "utf8");
const { installReleaseContextGuard } = await import(
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`
);
const endpoint = "/api/v1/media/playback/end/";

async function server(handler) {
  const instance = http.createServer(handler);
  await new Promise((resolve) => instance.listen(0, "127.0.0.1", resolve));
  return { origin: `http://127.0.0.1:${instance.address().port}`, close: async () => {
    instance.closeAllConnections();
    await new Promise((resolve) => instance.close(resolve));
  } };
}

async function eventually(check) {
  const deadline = Date.now() + 5000;
  while (!check() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
  assert.ok(check(), "Expected native transport state was not observed");
}

async function fixture(run) {
  const received = [];
  const escaped = [];
  let redirect = false;
  let webOrigin;
  let proxy;
  const proxyFailures = [];
  const sink = await server((req, res) => { escaped.push(req.url); res.end("unexpected"); });
  const api = await server((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", webOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "authorization, content-type, x-tenant-code");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      received.push({ path: req.url, method: req.method, headers: req.headers, body });
      if (redirect) { res.writeHead(307, { Location: `${sink.origin}/stolen` }); res.end(); }
      else { res.setHeader("Content-Type", "application/json"); res.end("{}"); }
    });
  });
  const web = await server((req, res) => {
    if (req.url.startsWith(PLAYBACK_END_PROXY_PATH)) { proxy.handle(req, res); return; }
    res.setHeader("Content-Type", "text/html");
    res.end("<!doctype html><title>Native keepalive boundary</title>ready");
  });
  webOrigin = web.origin;
  // A broken rewrite must never send credentials to the real production host.
  const browser = await chromium.launch({ args: ["--host-resolver-rules=MAP api.hakwonplus.com 127.0.0.1"] });
  const boundary = { mode: "development", apiOrigin: api.origin, webOrigin, tenantCode: "qa-ymath-realuse-native" };
  proxy = createPlaybackEndProxy({ ...boundary, tenantCodes: [boundary.tenantCode], onFailure: (code) => proxyFailures.push(code) });
  try { await run({ browser, boundary, received, escaped, sink, proxyFailures, setRedirect: () => { redirect = true; } }); }
  finally {
    await browser.close();
    await proxy.close();
    await Promise.all([web.close(), api.close(), sink.close()]);
  }
}

async function installExit(page, boundary, options = {}) {
  await page.evaluate(({ boundary, endpoint, options }) => {
    const init = {
      method: options.method ?? "POST", keepalive: true, credentials: "omit",
      headers: { "content-type": "application/json", authorization: "Bearer fixture-access",
        "x-student-id": "731", "x-client": "academyfront", "x-client-version": "fixture-revision",
        "x-tenant-code": options.tenant ?? boundary.tenantCode },
      body: JSON.stringify({ token: "fixture-playback" }),
    };
    const url = options.url ?? `https://api.hakwonplus.com${endpoint}`;
    const send = () => {
      const promise = options.requestInput ? fetch(new Request(url, init)) : fetch(url, init);
      void promise.catch(() => undefined);
    };
    if (options.immediate) send();
    else window.addEventListener("pagehide", send, { once: true });
  }, { boundary, endpoint, options });
}

test("real pagehide keepalive reaches only development after reload with string and Axios Request inputs", async () => {
  await fixture(async ({ browser, boundary, received, escaped, proxyFailures }) => {
    for (const requestInput of [false, true]) {
      const context = await browser.newContext();
      const guard = await installReleaseContextGuard(context, boundary);
      let routedEnd = 0;
      await context.route("**/__qa__/playback-end", async (route) => { routedEnd++; await route.fallback(); });
      const page = await context.newPage();
      await page.goto(boundary.webOrigin);
      await installExit(page, boundary, { requestInput });
      await page.reload();
      try { await eventually(() => received.length === (requestInput ? 2 : 1)); }
      catch (error) { guard.assertClean(); throw error; }
      const request = received.at(-1);
      assert.equal(request.method, "POST");
      assert.equal(request.path, endpoint);
      assert.equal(request.headers.authorization, "Bearer fixture-access");
      assert.equal(request.headers["x-tenant-code"], boundary.tenantCode);
      assert.equal(request.headers["x-student-id"], "731");
      assert.equal(request.headers["x-client"], "academyfront");
      assert.equal(request.headers["x-client-version"], "fixture-revision");
      assert.equal(request.body, JSON.stringify({ token: "fixture-playback" }));
      assert.equal(routedEnd, 0, "The test must exercise Chromium's native route bypass");
      guard.assertClean();
      await context.close();
    }
    assert.deepEqual(escaped, []);
    assert.deepEqual(proxyFailures, []);
  });
});

test("caught native pagehide violations remain defects after reload without any API or foreign request", async () => {
  await fixture(async ({ browser, boundary, received, escaped, sink }) => {
    for (const scenario of [
      { tenant: "qa-ymath-realuse-foreign", code: "tenant" },
      { url: `${sink.origin}${endpoint}`, code: "origin" },
      { url: `https://api.hakwonplus.com${endpoint}?secret=hidden`, code: "shape" },
      { url: "https://api.hakwonplus.com/api/v1/students/", code: "shape" },
      { readonly: true, code: "mutation" },
    ]) {
      const context = await browser.newContext();
      const guard = await installReleaseContextGuard(context, { ...boundary, mode: scenario.readonly ? "readonly" : "development" });
      const page = await context.newPage();
      await page.goto(boundary.webOrigin);
      await installExit(page, boundary, scenario);
      await page.reload();
      await eventually(() => {
        try { guard.assertClean(); return false; } catch { return true; }
      });
      assert.throws(() => guard.assertClean(), new RegExp(`native keepalive rejected \\[${scenario.code}\\]`));
      assert.deepEqual(received, []);
      assert.deepEqual(escaped, []);
      await context.close();
    }
  });
});

test("native pagehide proxy rejects redirect before credentials/body reach a second origin and records failure", async () => {
  await fixture(async ({ browser, boundary, received, escaped, proxyFailures, setRedirect }) => {
    setRedirect();
    const context = await browser.newContext();
    const guard = await installReleaseContextGuard(context, boundary);
    const page = await context.newPage();
    await page.goto(boundary.webOrigin);
    await installExit(page, boundary, { requestInput: true });
    await page.reload();
    await eventually(() => proxyFailures.length === 1);
    assert.equal(received.length, 1);
    assert.deepEqual(escaped, []);
    assert.deepEqual(proxyFailures, ["upstream"]);
    guard.assertClean(); // The server journal, independent of the departed page, owns this failure.
    await context.close();
  });
});

test("server terminal proxy rejects forged tenant, missing auth, alternate path/method/body and origin without upstream writes", async () => {
  await fixture(async ({ boundary, received, escaped, proxyFailures }) => {
    const headers = { origin: boundary.webOrigin, "content-type": "application/json",
      authorization: "Bearer fixture-access", "x-tenant-code": boundary.tenantCode };
    const body = JSON.stringify({ token: "fixture-playback" });
    for (const change of [
      { headers: { ...headers, "x-tenant-code": "qa-ymath-realuse-foreign" } },
      { headers: { ...headers, authorization: "" } },
      { headers: { ...headers, origin: "https://foreign.invalid" } },
      { headers: { ...headers, cookie: "session=fixture" } },
      { headers: { ...headers, "x-student-id": "731,732" } },
      { headers: { ...headers, "x-client-version": "x".repeat(101) } },
      { path: `${PLAYBACK_END_PROXY_PATH}?token=hidden` },
      { path: `${PLAYBACK_END_PROXY_PATH}/other` },
      { method: "PUT" },
      { body: JSON.stringify({ token: "fixture", tenant: "foreign" }) },
      { body: "{}" },
      { body: JSON.stringify({ token: "x".repeat(8193) }) },
    ]) {
      try {
        const response = await fetch(`${boundary.webOrigin}${change.path ?? PLAYBACK_END_PROXY_PATH}`, {
          method: change.method ?? "POST", headers: change.headers ?? headers, body: change.body ?? body,
        });
        assert.equal(response.status, 502);
      } catch (error) { assert.equal(error.name, "TypeError"); } // Oversized body can close its socket.
    }
    assert.equal(proxyFailures.length, 12);
    assert.deepEqual(received, []);
    assert.deepEqual(escaped, []);
  });
});

test("terminal proxy preserves successful response bytes and the original token JSON bytes", async () => {
  await fixture(async ({ boundary, received, proxyFailures }) => {
    const body = '{ "token" : "fixture-playback" }\n';
    const response = await fetch(`${boundary.webOrigin}${PLAYBACK_END_PROXY_PATH}`, {
      method: "POST", headers: { origin: boundary.webOrigin, "content-type": "application/json",
        authorization: "Bearer fixture-access", "x-tenant-code": boundary.tenantCode }, body,
    });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "{}");
    assert.equal(received.length, 1);
    assert.equal(received[0].body, body);
    assert.deepEqual(proxyFailures, []);
  });
});

test("corrupt violation journal cannot prevent native boundary installation", async () => {
  await fixture(async ({ browser, boundary, received, escaped }) => {
    const context = await browser.newContext();
    const guard = await installReleaseContextGuard(context, boundary);
    const page = await context.newPage();
    await page.goto(boundary.webOrigin);
    await page.evaluate(() => sessionStorage.setItem("academy:release-native-keepalive-defects", "invalid-json"));
    await page.reload();
    await installExit(page, boundary, { tenant: "foreign", requestInput: true });
    await page.reload();
    await eventually(() => { try { guard.assertClean(); return false; } catch { return true; } });
    assert.throws(() => guard.assertClean(), /native keepalive rejected \[shape\]/);
    assert.deepEqual(received, []);
    assert.deepEqual(escaped, []);
    await context.close();
  });
});

test("a caught pagehide denial stays visible after the tab closes without a replacement document", async () => {
  await fixture(async ({ browser, boundary, received, escaped }) => {
    const context = await browser.newContext();
    const guard = await installReleaseContextGuard(context, boundary);
    const page = await context.newPage();
    await page.goto(boundary.webOrigin);
    await installExit(page, boundary, { tenant: "foreign" });
    await page.close({ runBeforeUnload: true });
    await eventually(() => { try { guard.assertClean(); return false; } catch { return true; } });
    assert.throws(() => guard.assertClean(), /native keepalive rejected \[tenant\]/);
    assert.deepEqual(received, []);
    assert.deepEqual(escaped, []);
    await context.close();
  });
});
