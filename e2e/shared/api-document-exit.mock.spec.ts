import { expect, test } from "../fixtures/strictTest";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  test.skip(!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE), "Local API lifecycle regression only");
  await page.route("**/__api-document-exit__", (route) => route.fulfill({
    contentType: "text/html", body: "<!doctype html><title>API document lifecycle</title>",
  }));
  await page.route("**/api/v1/**", (route) => route.fulfill({ json: { ok: true } }));
  await page.goto(`${BASE}/__api-document-exit__`);
  await page.evaluate(() => {
    const generation = "document-exit";
    const access = `e30.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.test`;
    localStorage.setItem(`academy:auth-tokens:v1:${generation}`, JSON.stringify({ generation, access, refresh: "test-refresh" }));
    localStorage.setItem("academy:auth-active-generation:v1", generation);
    sessionStorage.setItem("tenantCode", "hakwonplus");
  });
});

for (const restoreImmediately of [false, true]) {
  test(`departed document cannot dispatch a queued API request; immediate restore=${restoreImmediately}`, async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/v1/")) requests.push(new URL(request.url()).pathname);
    });
    const result = await page.evaluate(async ({ restoreImmediately }) => {
      const { default: api } = await new Function("return import('/src/shared/api/axios.ts')")();
      const pending = api.get("/student/me/").then(() => "sent", (error: { code?: string }) => error.code);
      // Let the request interceptor enter its asynchronous token check.
      await Promise.resolve();
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: restoreImmediately }));
      if (restoreImmediately) window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
      const queued = await pending;
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
      const restored = await api.get("/student/me/");
      return { queued, restored: restored.status };
    }, { restoreImmediately });
    expect(result).toEqual({ queued: "ERR_CANCELED", restored: 200 });
    expect(requests).toEqual(["/api/v1/student/me/"]);
  });
}

test("exit cancels ordinary reads but retains the explicit playback completion request", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/")) requests.push(new URL(request.url()).pathname);
  });
  const result = await page.evaluate(async () => {
    const { default: api, createPlaybackUnloadConfig } = await new Function("return import('/src/shared/api/axios.ts')")();
    window.dispatchEvent(new PageTransitionEvent("pagehide"));
    const ordinary = await api.get("/student/me/").then(() => "sent", (error: { code?: string }) => error.code);
    const playback = await api.post("/media/playback/end/", { playback_session_id: "test-playback" }, createPlaybackUnloadConfig());
    window.dispatchEvent(new PageTransitionEvent("pageshow"));
    return { ordinary, playback: playback.status };
  });
  expect(result).toEqual({ ordinary: "ERR_CANCELED", playback: 200 });
  expect(requests).toEqual(["/api/v1/media/playback/end/"]);
});

test("logout cancels queued reads before pagehide and a new login can request again", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/")) requests.push(new URL(request.url()).pathname);
  });
  const result = await page.evaluate(async () => {
    const { default: api, markSessionEnding, resetSessionEnding } = await new Function("return import('/src/shared/api/axios.ts')")();
    const pending = api.get("/student/me/").then(() => "sent", (error: { code?: string }) => error.code);
    await Promise.resolve();
    markSessionEnding();
    const queued = await pending;
    const late = await api.get("/student/me/").then(() => "sent", (error: { code?: string }) => error.code);
    const login = await api.post("/token/", { username: "test-relogin", password: "test-only" });
    resetSessionEnding();
    const restored = await api.get("/student/me/");
    return { queued, late, login: login.status, restored: restored.status };
  });
  expect(result).toEqual({ queued: "ERR_CANCELED", late: "ERR_CANCELED", login: 200, restored: 200 });
  expect(requests).toEqual(["/api/v1/token/", "/api/v1/student/me/"]);
});

test("chunk recovery cannot replace an auth redirect and resumes after a new login", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { markSessionEnding } = await new Function("return import('/src/shared/api/axios.ts')")();
    const { hardReloadWithCacheBust } = await new Function("return import('/src/shared/utils/hardReload.ts')")();
    sessionStorage.setItem("session_return_path", "/landing/admin/videos/new");
    markSessionEnding();
    return {
      reloaded: hardReloadWithCacheBust({ key: "chunk_reload_ts", cooldownMs: 10_000 }),
      retryTimestamp: sessionStorage.getItem("chunk_reload_ts"),
      returnPath: sessionStorage.getItem("session_return_path"),
    };
  });
  expect(result).toEqual({ reloaded: false, retryTimestamp: null, returnPath: "/landing/admin/videos/new" });
  await expect(page).toHaveURL(`${BASE}/__api-document-exit__`);

  await page.route("**/__api-document-exit__?*", (route) => route.fulfill({
    contentType: "text/html", body: "<!doctype html><title>Recovered document</title>",
  }));
  await page.evaluate(async () => {
    const { resetSessionEnding } = await new Function("return import('/src/shared/api/axios.ts')")();
    const { hardReloadWithCacheBust } = await new Function("return import('/src/shared/utils/hardReload.ts')")();
    resetSessionEnding();
    hardReloadWithCacheBust({ key: "chunk_reload_ts", cooldownMs: 10_000 });
  });
  await expect(page).toHaveURL(/\/__api-document-exit__\?__hplus_reload=\d+$/);
  await expect(page).toHaveTitle("Recovered document");
});
