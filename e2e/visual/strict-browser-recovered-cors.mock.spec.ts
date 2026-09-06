import { test, expect } from "../fixtures/strictTest";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";

const APP_URL = "https://hakwonplus.com/__visual-audit-cors-harness";
const API_URL = "https://api.hakwonplus.com/api/v1/core/program/?page=1";
const CORS_ERROR = `Access to XMLHttpRequest at '${API_URL}' from origin 'https://hakwonplus.com' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.`;

test.use({ strictBrowserAutoAssert: false });

test.beforeEach(async ({ page }) => {
  await page.route(APP_URL, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<main data-audit-success><h1>audit success</h1></main>",
    });
  });
});

test("후속 200과 exact ACAO 및 정상 UI가 있는 transient CORS pair만 회복한다", async ({ page }) => {
  await page.route(API_URL, async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "https://hakwonplus.com" },
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.goto(APP_URL);
  const strict = attachStrictBrowserGuards(page, { allowRecoveredProductionCors: true });

  await page.evaluate(async ({ apiUrl, corsError }) => {
    console.error(corsError);
    console.error("Failed to load resource: net::ERR_FAILED");
    await fetch(apiUrl);
  }, { apiUrl: API_URL, corsError: CORS_ERROR });

  await expect(page.locator("[data-audit-success]")).toBeVisible();
  strict.assertZeroDefects();
});

test("후속 응답이 5xx이면 transient CORS pair를 회복하지 않는다", async ({ page }) => {
  await page.route(API_URL, async (route) => {
    await route.fulfill({
      status: 503,
      headers: { "access-control-allow-origin": "https://hakwonplus.com" },
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.goto(APP_URL);
  const strict = attachStrictBrowserGuards(page, { allowRecoveredProductionCors: true });

  await page.evaluate(async ({ apiUrl, corsError }) => {
    console.error(corsError);
    console.error("Failed to load resource: net::ERR_FAILED");
    await fetch(apiUrl);
  }, { apiUrl: API_URL, corsError: CORS_ERROR });

  expect(() => strict.assertZeroDefects()).toThrow(/CORS policy/);
});

test("후속 200의 ACAO가 origin과 다르면 transient CORS pair를 회복하지 않는다", async ({ page }) => {
  await page.route(API_URL, async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "https://wrong.example" },
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.goto(APP_URL);
  const strict = attachStrictBrowserGuards(page, { allowRecoveredProductionCors: true });

  await page.evaluate(async ({ apiUrl, corsError }) => {
    console.error(corsError);
    console.error("Failed to load resource: net::ERR_FAILED");
    await fetch(apiUrl).catch(() => undefined);
  }, { apiUrl: API_URL, corsError: CORS_ERROR });

  expect(() => strict.assertZeroDefects()).toThrow(/CORS policy/);
});

test("release가 로컬 중화한 exact Cloudflare beacon SRI 오류만 분리한다", async ({ page }) => {
  const beacon = "https://static.cloudflareinsights.com/beacon.min.js/v31edd6df95cf4e85bb4c19e7a9bdbcba1788362987495";
  await page.route(beacon, (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript; charset=utf-8",
    body: "",
  }));
  await page.goto(APP_URL);
  const release = attachStrictBrowserGuards(page, { allowNeutralizedCloudflareBeaconIntegrity: true });
  const ordinary = attachStrictBrowserGuards(page);

  const integrityError = page.waitForEvent("console", {
    predicate: (message) => message.type() === "error" && message.text().includes("Failed to find a valid digest"),
  });
  await page.setContent(`<script crossorigin="anonymous" integrity="sha512-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==" src="${beacon}"></script>`);
  await integrityError;

  release.assertZeroDefects();
  expect(() => ordinary.assertZeroDefects()).toThrow(/Failed to find a valid digest/);
});

test("release SRI 분리는 다른 host와 path의 integrity 오류를 숨기지 않는다", async ({ page }) => {
  const foreign = "https://foreign.example/beacon.min.js/v31edd6df95cf4e85bb4c19e7a9bdbcba1788362987495";
  await page.route(foreign, (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript; charset=utf-8",
    body: "",
  }));
  await page.goto(APP_URL);
  const strict = attachStrictBrowserGuards(page, { allowNeutralizedCloudflareBeaconIntegrity: true });

  const integrityError = page.waitForEvent("console", {
    predicate: (message) => message.type() === "error" && message.text().includes("Failed to find a valid digest"),
  });
  await page.setContent(`<script crossorigin="anonymous" integrity="sha512-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==" src="${foreign}"></script>`);
  await integrityError;

  expect(() => strict.assertZeroDefects()).toThrow(/Failed to find a valid digest/);
});
