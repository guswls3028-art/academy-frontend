import { type Page } from "@playwright/test";
import { test, expect } from "../fixtures/strictTest";
import { getApiBaseUrl, getBaseUrl, loginViaUI } from "../helpers/auth";

const BASE = getBaseUrl("admin").replace(/\/+$/, "");
const API_BASE = getApiBaseUrl().replace(/\/+$/, "");

function trackedHostnames(): Set<string> {
  const hosts = new Set<string>();
  for (const url of [BASE, API_BASE]) {
    try {
      hosts.add(new URL(url).hostname);
    } catch {
      // Ignore malformed env input; the actual navigation/API assertions will fail.
    }
  }
  return hosts;
}

function attachProductionRequestGuard(page: Page) {
  const hostnames = trackedHostnames();
  const defects: string[] = [];

  function shouldTrack(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" && hostnames.has(parsed.hostname);
    } catch {
      return false;
    }
  }

  page.on("requestfailed", (request) => {
    const url = request.url();
    if (!shouldTrack(url)) return;
    const errorText = request.failure()?.errorText || "unknown";
    if (errorText === "net::ERR_ABORTED") return;
    defects.push(`${request.method()} ${url} failed: ${errorText}`);
  });

  page.on("response", (response) => {
    const url = response.url();
    if (!shouldTrack(url)) return;
    const request = response.request();
    const status = response.status();
    const resourceType = request.resourceType();
    const isApiResponse = (() => {
      try {
        return new URL(url).hostname === new URL(API_BASE).hostname;
      } catch {
        return false;
      }
    })();
    const isCriticalFrontAsset = ["document", "script", "stylesheet", "fetch", "xhr"].includes(resourceType);
    if (status >= 500 || (status >= 400 && (isApiResponse || isCriticalFrontAsset))) {
      defects.push(`${status} ${request.method()} ${resourceType} ${url}`);
    }
  });

  return {
    assertClean() {
      expect(defects, `Production request defects:\n${defects.join("\n")}`).toEqual([]);
    },
  };
}

test.describe("Production canary", () => {
  test("API healthz responds", async ({ request }) => {
    const resp = await request.get(`${API_BASE}/healthz`, { timeout: 30_000 });
    expect(resp.status()).toBe(200);
  });

  test("public promo page renders without browser or request defects", async ({ page }) => {
    const guard = attachProductionRequestGuard(page);

    const response = await page.goto(`${BASE}/promo`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    expect(response?.ok(), `Unexpected /promo status ${response?.status()}`).toBe(true);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("text=Not Found")).not.toBeVisible();
    const bodyText = (await page.locator("body").innerText({ timeout: 10_000 })).trim();
    expect(bodyText.length).toBeGreaterThan(20);
    guard.assertClean();
  });

  test("admin dashboard login survives production edge", async ({ page }) => {
    test.setTimeout(90_000);
    const guard = attachProductionRequestGuard(page);

    await loginViaUI(page, "admin", { landingPath: "/admin/dashboard" });

    expect(page.url()).toMatch(/\/(admin|dev)(\/|$)/);
    await expect(page.locator("nav, [class*='sidebar'], [class*='header'], main").first()).toBeVisible();
    await expect(page.locator("text=Not Found")).not.toBeVisible();
    guard.assertClean();
  });

  test("student dashboard login survives production edge", async ({ page }) => {
    test.setTimeout(90_000);
    const guard = attachProductionRequestGuard(page);

    await loginViaUI(page, "student", { landingPath: "/student/dashboard" });

    expect(page.url()).toMatch(/\/student(\/|$)/);
    await expect(page.locator("[class*='tabbar'], [class*='tab-bar'], nav, main").first()).toBeVisible();
    await expect(page.locator("text=Not Found")).not.toBeVisible();
    guard.assertClean();
  });
});
