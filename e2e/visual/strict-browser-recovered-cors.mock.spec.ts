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
