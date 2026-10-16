import { type Locator, type Page, type TestInfo } from "@playwright/test";
import { test, expect } from "../fixtures/strictTest";
import { getApiBaseUrl, getBaseUrl, loginViaUI } from "../helpers/auth";
import { assertInteractiveSurface } from "../helpers/assertInteractiveSurface";
import { captureGuideEvidence } from "../helpers/guideEvidence";

const BASE = getBaseUrl("admin").replace(/\/+$/, "");
const API_BASE = getApiBaseUrl().replace(/\/+$/, "");

async function verifyGuideJourney(
  page: Page,
  testInfo: TestInfo,
  guide: { scope: string; path: string; topic: string; title: string; target: string; targetReady: Locator },
) {
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const guideUrl = `${BASE}${guide.path}?topic=${guide.topic}`;
    await page.goto(guideUrl, { waitUntil: "domcontentloaded" });
    const article = page.getByRole("article", { name: guide.title });
    await expect(article.getByRole("heading", { name: "여기까지 확인하면 완료" })).toBeVisible();
    const action = article.getByRole("link", { name: `${guide.title} 화면 열기` });
    await assertInteractiveSurface(page, article, action);
    await captureGuideEvidence(article, action, testInfo, `live-guide-${guide.scope}-${width}`);
    await action.click();
    await expect(page).toHaveURL(`${BASE}${guide.target}`);
    await expect(guide.targetReady).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(guideUrl);
    await expect(article).toBeVisible();
    await page.reload();
    await expect(article).toBeVisible();
  }
}

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

  test("admin dashboard login survives production edge", async ({ page }, testInfo) => {
    test.setTimeout(420_000);
    const guard = attachProductionRequestGuard(page);

    await loginViaUI(page, "admin", { landingPath: "/workspace/dashboard" });

    expect(page.url()).toMatch(/\/(workspace|dev)(\/|$)/);
    await expect(page.locator("nav, [class*='sidebar'], [class*='header'], main").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "오늘 처리할 일", exact: true })).toBeVisible();
    await expect(page.locator("text=Not Found")).not.toBeVisible();

    await page.goto(`${BASE}/admin/dashboard?compat=1#legacy-full`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await expect(page).toHaveURL(
      `${BASE}/workspace/dashboard?compat=1#legacy-full`,
      { timeout: 15_000 },
    );
    await expect(page.getByRole("heading", { name: "오늘 처리할 일", exact: true })).toBeVisible();

    await page.goto(`${BASE}/teacher/classes?compat=1#legacy-mobile`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await expect(page).toHaveURL(
      `${BASE}/workspace/mobile/classes?compat=1#legacy-mobile`,
      { timeout: 15_000 },
    );
    // The redirect URL arrives before lazy route chunks and the lecture query.
    // Keep the context alive until the destination is usable; teardown must not
    // manufacture blocked static-asset errors or hide an unfinished route.
    await expect(page.getByRole("heading", { name: "강의 관리", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^강의목록 \(\d+\)$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "강의 추가", exact: true })).toBeEnabled();
    await expect(page.locator("text=Not Found")).not.toBeVisible();
    await verifyGuideJourney(page, testInfo, {
      scope: "admin", path: "/workspace/guide", topic: "homework",
      title: "과제 배정·제출 확인·평가", target: "/workspace/lectures",
      targetReady: page.getByRole("button", { name: "강의 추가", exact: true }),
    });
    await verifyGuideJourney(page, testInfo, {
      scope: "teacher", path: "/workspace/mobile/guide", topic: "attendance",
      title: "모바일 출결 입력", target: "/workspace/mobile/classes",
      targetReady: page.getByRole("heading", { name: "강의 관리", exact: true }),
    });
    guard.assertClean();
  });

  test("student dashboard login survives production edge", async ({ page }, testInfo) => {
    test.setTimeout(420_000);
    const guard = attachProductionRequestGuard(page);

    await loginViaUI(page, "student", { landingPath: "/student/dashboard" });

    expect(page.url()).toMatch(/\/student(\/|$)/);
    await expect(page.locator("[class*='tabbar'], [class*='tab-bar'], nav, main").first()).toBeVisible();
    await expect(page.locator("text=Not Found")).not.toBeVisible();
    await verifyGuideJourney(page, testInfo, {
      scope: "student", path: "/student/guide", topic: "submit-assignment",
      title: "과제 사진·동영상 제출", target: "/student/submit/assignment",
      targetReady: page.getByRole("heading", { name: "과제 제출", exact: true }),
    });
    guard.assertClean();
  });
});
