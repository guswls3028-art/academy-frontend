import { test, expect } from "../fixtures/strictTest";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:4173").replace(/\/+$/, "");

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
    name: "출결·성적·복습·학부모 안내까지, 학원의 모든 흐름을 하나로.",
  })).toBeVisible();
  await expect(page.locator("#root")).not.toBeEmpty();
});
