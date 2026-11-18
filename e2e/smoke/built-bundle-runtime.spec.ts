import { test, expect } from "../fixtures/strictTest";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:4173").replace(/\/+$/, "");
const FALLBACK_TITLE = "화면을 불러오지 못했어요";
const PROMO_TITLE = /학원의 모든 기록을,\s*하나로\./;

for (const width of [1366, 390]) {
  test(`built login renders without loading PDF.js at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(request.url());
    });
    await page.route("**/api/v1/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      await route.fulfill({ json: pathname === "/api/v1/core/program/" ? {
        tenantCode: "hakwonplus", display_name: "학원플러스", ui_config: {},
        feature_flags: {}, is_active: true,
      } : {} });
    });
    await page.goto(`${BASE}/login/hakwonplus`, { waitUntil: "networkidle" });
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "로그인", exact: true })).toBeVisible();
    expect(scripts.some((url) => /\/assets\/index-.*\.js/.test(url))).toBe(true);
    expect(scripts.filter((url) => /vendor-pdfjs|pdf\.worker/.test(url))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("production bundle boots the public promo route without runtime defects", async ({ page }) => {
  const previewOrigin = new URL(BASE).origin;
  await page.route("https://api.hakwonplus.com/**", async (route) => {
    const request = route.request();
    const corsHeaders = {
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": request.headers()["access-control-request-headers"] || "content-type",
      "access-control-allow-methods": "GET,HEAD,OPTIONS",
      "access-control-allow-origin": previewOrigin,
    };

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
      body: "{}",
    });
  });

  const response = await page.goto(`${BASE}/promo`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });

  expect(response?.ok(), `Unexpected /promo status ${response?.status()}`).toBe(true);
  await expect(page.getByRole("heading", {
    name: /학원의 모든 기록을,\s*하나로\./,
  })).toBeVisible();
  await expect(page.locator("#root")).not.toBeEmpty();
});

test.describe("production bundle error recovery", () => {
  // These scenarios deliberately trigger module, authentication and submission failures.
  test.use({ serviceWorkers: "block", strictBrowserAutoAssert: false });

  for (const { width, signedIn, failure } of [
    { width: 1366, signedIn: true, failure: "unavailable" },
    { width: 390, signedIn: true, failure: "unavailable" },
    { width: 390, signedIn: false, failure: "signed-out" },
    { width: 1366, signedIn: true, failure: "invalid-receipt" },
    { width: 390, signedIn: true, failure: "expired-on-submit" },
    { width: 1366, signedIn: true, failure: "expired-before-submit" },
  ]) {
    test(`root error fallback ${failure} at ${width}px`, async ({ page }) => {
      const token = `e30.${Buffer.from(JSON.stringify({
        exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "hakwonplus", user_id: 12,
      })).toString("base64url")}.test`;
      const reportText = "화면을 열 때 같은 문제가 반복됩니다.";
      const manualReports: Array<{ body: unknown; authorization: string; tenantCode: string }> = [];
      let refreshRequests = 0;
      let releaseSubmission = () => {};
      const submissionGate = new Promise<void>((resolve) => { releaseSubmission = resolve; });
      const appOrigin = new URL(BASE).origin;
      await page.setViewportSize({ width, height: 850 });
      await page.addInitScript(({ access }) => {
        sessionStorage.setItem("eb_reload_ts", String(Date.now()));
        sessionStorage.setItem("tenantCode", "hakwonplus");
        localStorage.setItem("tenant_code", "hakwonplus");
        if (access) {
          const generation = "bundle-smoke-report";
          localStorage.setItem("academy:auth-active-generation:v1", generation);
          localStorage.setItem(`academy:auth-tokens:v1:${generation}`, JSON.stringify({
            access, generation, refresh: "bundle-smoke-refresh",
          }));
        }
      }, { access: signedIn ? token : null });

      // Loopback assets and mocked API only, including optional diagnostics.
      await page.route("**/*", (route) => new URL(route.request().url()).origin === appOrigin
        ? route.continue()
        : route.abort());
      await page.route("**/api/v1/**", async (route) => {
        const request = route.request();
        const headers = {
          "access-control-allow-origin": appOrigin,
          "access-control-allow-credentials": "true",
          "access-control-allow-headers": request.headers()["access-control-request-headers"] || "authorization,content-type,x-tenant-code",
          "access-control-allow-methods": "GET,POST,OPTIONS",
        };
        const json = (body: unknown, status = 200) => route.fulfill({ json: body, status, headers });
        if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
        const path = new URL(request.url()).pathname;
        if (path === "/api/v1/token/refresh/") {
          refreshRequests += 1;
          return json({ detail: "만료된 세션입니다." }, 401);
        }
        if (path === "/api/v1/core/program/") {
          return json({ tenantCode: "hakwonplus", display_name: "학원플러스", is_active: true, ui_config: {}, feature_flags: {} });
        }
        if (path === "/api/v1/core/me/") {
          return json({ id: 12, username: "owner", name: "학원장", is_staff: true, tenantRole: "owner", must_change_password: false, first_login_guide_required: false });
        }
        if (path === "/api/v1/core/problem-reports/" && request.method() === "POST") {
          const body = request.postDataJSON();
          if (body.source === "frontend_exception") return json({ incident_id: 1 }, 201);
          manualReports.push({ body, authorization: request.headers().authorization || "", tenantCode: request.headers()["x-tenant-code"] || "" });
          if (failure.startsWith("expired-")) return json({ detail: "만료된 세션입니다." }, 401);
          if (manualReports.length === 1) {
            await submissionGate;
            return failure === "invalid-receipt"
              ? json({ incident_id: "2" }, 201)
              : json({ detail: "접수 실패" }, 503);
          }
          return json({ incident_id: 2 }, 201);
        }
        return json({});
      });

      const promoModule = /\/assets\/PromoRouter-[^/]+\.js(?:\?.*)?$/;
      await page.route(promoModule, (route) => route.fulfill({
        contentType: "application/javascript",
        body: 'throw new Error("bundle-smoke-render-failure");',
      }));
      await page.goto(`${BASE}/promo?diagnostic=private#section`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: FALLBACK_TITLE })).toBeVisible();
      await expect(page.getByText("bundle-smoke-render-failure")).toHaveCount(0);
      await page.getByRole("button", { name: "버그 제보", exact: true }).click();
      const description = page.getByRole("textbox", { name: "어떤 문제가 있었나요?" });
      const submit = page.getByRole("button", { name: "제보 보내기" });
      await expect(description).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(submit).toBeDisabled();
      await description.fill(reportText);
      if (failure === "expired-before-submit") {
        const expiredToken = `e30.${Buffer.from(JSON.stringify({
          exp: Math.floor(Date.now() / 1000) - 60, tenant_code: "hakwonplus", user_id: 12,
        })).toString("base64url")}.test`;
        await page.evaluate((access) => {
          const key = `academy:auth-tokens:v1:${localStorage.getItem("academy:auth-active-generation:v1")}`;
          const session = JSON.parse(localStorage.getItem(key) || "null");
          localStorage.setItem(key, JSON.stringify({ ...session, access }));
        }, expiredToken);
      }
      await submit.click();
      if (failure.startsWith("expired-")) {
        await expect(page.getByRole("alert").filter({ hasText: "로그인이 필요해요" })).toBeVisible();
        await expect(description).toHaveValue(reportText);
        await expect(page).toHaveURL(`${BASE}/promo?diagnostic=private#section`);
        expect(refreshRequests).toBe(1);
        expect(manualReports).toHaveLength(failure === "expired-on-submit" ? 1 : 0);
        expect(await page.evaluate(() => {
          const generation = localStorage.getItem("academy:auth-active-generation:v1");
          return localStorage.getItem(`academy:auth-tokens:v1:${generation}`);
        })).toBeNull();
        await submit.click();
        await expect(description).toHaveValue(reportText);
        expect(refreshRequests).toBe(1);
        expect(manualReports).toHaveLength(failure === "expired-on-submit" ? 1 : 0);
        await page.getByRole("button", { name: "닫기", exact: true }).click();
      } else if (signedIn) {
        try {
          await expect.poll(() => manualReports.length).toBe(1);
          await expect(description).toHaveAttribute("readonly", "");
          await expect(page.getByRole("button", { name: "보내는 중…" })).toBeDisabled();
          // Native repeated submit events also pass through the synchronous guard.
          await description.locator("..").dispatchEvent("submit");
          expect(manualReports).toHaveLength(1);
        } finally {
          releaseSubmission();
        }
        await expect(page.getByRole("alert").filter({ hasText: "제보를 보내지 못했어요" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "버그 제보가 접수됐어요" })).toHaveCount(0);
        await expect(description).toHaveValue(reportText);
        await submit.click();
        await expect(page.getByRole("heading", { name: "버그 제보가 접수됐어요" })).toBeFocused();
        expect(manualReports).toHaveLength(2);
        for (const report of manualReports) {
          expect(report).toMatchObject({
            body: { source: "manual", message: reportText, route: "/promo", screen_size: `${width}x850` },
            authorization: `Bearer ${token}`,
            tenantCode: "hakwonplus",
          });
        }
      } else {
        await expect(page.getByRole("alert").filter({ hasText: "로그인이 필요해요" })).toBeVisible();
        await expect(description).toHaveValue(reportText);
        expect(manualReports).toEqual([]);
        await page.getByRole("button", { name: "닫기", exact: true }).click();
        await expect(page.getByRole("button", { name: "버그 제보", exact: true })).toBeFocused();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      await page.unroute(promoModule);
      await page.getByRole("button", { name: "다시 불러오기" }).click();
      await expect(page.getByRole("heading", { name: PROMO_TITLE })).toBeVisible();
    });
  }
});
