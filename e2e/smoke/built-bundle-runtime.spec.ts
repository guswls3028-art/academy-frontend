import { test, expect } from "../fixtures/strictTest";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:4173").replace(/\/+$/, "");

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
