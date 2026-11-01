import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/strictTest";

const BASE = (
  process.env.E2E_LANDING_BASE_URL
  || process.env.E2E_LOCAL_BASE_URL
  || "http://127.0.0.1:5174"
).replace(/\/+$/, "");

// Service-worker fetches bypass page.route; this suite owns the mocked API.
test.use({ serviceWorkers: "block" });

async function prepareGodmin(page: Page) {
  await page.route("**/api/v1/landing-public/videos/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(route.request().url().includes("showcase") ? { hero: null } : { count: 0, results: [], next: null }) }));
  await page.addInitScript(() => {
    localStorage.setItem("tenant_code", "godmin");
    sessionStorage.setItem("tenantCode", "godmin");
    // Keep production-build mocks same-origin, including WebKit's CORS preflight.
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, value, ...rest) {
      const url = new URL(String(value), location.href);
      return Reflect.apply(open, this, [method, url.pathname.startsWith("/api/v1/") ? `${location.origin}${url.pathname}${url.search}` : value, ...rest]);
    };
  });
  await page.route("**/api/v1/core/program/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tenantCode: "godmin",
        display_name: "신과함께",
        ui_config: { login_title: "신과함께" },
        feature_flags: {},
        is_active: true,
      }),
    });
  });
}

// Page overflow alone misses Korean words split across otherwise valid lines.
async function expectReadableHeadings(page: Page) {
  // WebKit applies viewport media-query changes on the next rendering frame.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.locator("main h1, main h2, main h3").evaluateAll((headings) => headings.flatMap((heading) => {
    const failures: string[] = [];
    const bounds = heading.getBoundingClientRect();
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      for (const match of (node.textContent ?? "").matchAll(/[가-힣]+/g)) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
        if (rects.some((rect) => Math.abs(rect.top - rects[0].top) > 1)) {
          failures.push(`${heading.id || heading.textContent}: split ${match[0]} (${rects.map((rect) => `${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)}`).join("; ")})`);
        }
        if (rects.some((rect) => rect.left < Math.max(0, bounds.left) - 1 || rect.right > Math.min(innerWidth, bounds.right) + 1)) {
          failures.push(`${heading.id || heading.textContent}: clipped ${match[0]}`);
        }
      }
    }
    return failures;
  }))).toEqual([]);
}

test.describe("godmin public landing", () => {
  test.beforeEach(async ({ page }) => {
    await prepareGodmin(page);
  });

  test("renders the dedicated desktop home without depending on a published landing config", async ({ page }, testInfo) => {
    let genericLandingRequests = 0;
    let publishedConfigRequests = 0;
    await page.route("**/api/v1/core/landing/public/**", async (route) => {
      genericLandingRequests += 1;
      await route.abort("blockedbyclient");
    });
    await page.route("**/api/v1/core/landing/has-published/**", async (route) => {
      publishedConfigRequests += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ has_published: false }) });
    });
    await page.setViewportSize({ width: 1366, height: 900 });

    await page.goto(`${BASE}/landing`, { waitUntil: "commit", timeout: 45_000 });

    await expect(page.getByRole("heading", { name: "복잡한 과학을, 이해되는 구조로." })).toBeVisible({ timeout: 90_000 });
    await expect(page).toHaveTitle("신민T 통합과학 | 신과함께");
    await expect(page.getByAltText("통합과학 강사 신민 선생님")).toBeVisible();
    const login = page.getByRole("link", { name: "수강생·학부모 로그인" });
    await expect(login).toHaveAttribute("href", "/login/godmin");
    await expect(page.getByText("대성마이맥 통합과학", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "네 영역을 잇는 하나의 과학 지도" })).toBeVisible();
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /대치동 통합과학 강사 신민T/);
    expect(genericLandingRequests).toBe(0);
    expect(publishedConfigRequests).toBe(0);
    expect(await page.evaluate(
      () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
    )).toBeLessThanOrEqual(1);

    const screenshotPath = testInfo.outputPath("godmin-landing-1366.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach("godmin-landing-1366.png", { path: screenshotPath, contentType: "image/png" });

    await login.click();
    await expect(page).toHaveURL(/\/login\/godmin$/);
    await expect(page.getByRole("form", { name: "로그인 폼" })).toBeVisible({ timeout: 30_000 });
  });

  test("keeps the 390px home readable, actionable, and free of horizontal overflow", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(`${BASE}/landing`, { waitUntil: "commit", timeout: 45_000 });

    await expect(page.getByRole("heading", { name: "복잡한 과학을, 이해되는 구조로." })).toBeVisible({ timeout: 90_000 });
    const nav = page.getByRole("navigation", { name: "홈페이지 주요 메뉴" });
    await expect(nav).toBeVisible();
    for (const label of ["수업 철학", "학습 관리", "신민T", "자료게시판", "영상"]) {
      await expect(nav.getByRole("link", { name: label, exact: true })).toBeInViewport();
    }
    const account = page.getByRole("link", { name: "로그인", exact: true });
    await expect(account).toBeInViewport();
    expect((await account.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    const login = page.getByRole("link", { name: "수강생·학부모 로그인" });
    await expect(login).toBeVisible();
    const loginBox = await login.boundingBox();
    expect(loginBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(
      () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
    )).toBeLessThanOrEqual(1);

    const screenshotPath = testInfo.outputPath("godmin-landing-390.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach("godmin-landing-390.png", { path: screenshotPath, contentType: "image/png" });
  });

  test("routes an unauthenticated godmin root visit to the public home and respects reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.goto(`${BASE}/`, { waitUntil: "commit", timeout: 45_000 });

    await expect(page.getByRole("heading", { name: "복잡한 과학을, 이해되는 구조로." })).toBeVisible({ timeout: 90_000 });
    await expect(page).toHaveURL(/\/landing$/);
    const portraitMotion = await page.getByAltText("통합과학 강사 신민 선생님").evaluate((element) => {
      const frame = element.parentElement;
      const style = frame ? getComputedStyle(frame) : null;
      return { duration: style?.animationDuration, iterations: style?.animationIterationCount };
    });
    expect(Number.parseFloat(portraitMotion.duration ?? "1")).toBeLessThanOrEqual(0.00001);
    expect(portraitMotion.iterations).toBe("1");
  });

  test("keeps Korean heading words together across narrow screens, desktop columns, and enlarged fallback text", async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${BASE}/landing`, { waitUntil: "commit", timeout: 45_000 });
    await expect(page.locator("#system-title")).toBeVisible({ timeout: 90_000 });
    await page.evaluate(() => document.fonts.ready);

    for (const font of ["configured", "Arial, sans-serif"]) {
      await page.locator("main h1, main h2, main h3").evaluateAll((headings, family) => {
        for (const heading of headings) (heading as HTMLElement).style.fontFamily = family === "configured" ? "" : family;
      }, font);
      for (const width of [320, 375, 390, 430, 768, 980, 981, 982, 1100, 1366, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        await test.step(`${font}, ${width}px rendered word boundaries`, async () => {
          await expectReadableHeadings(page);
          for (const id of ["philosophy-title", "system-title"]) {
            const layout = await page.locator(`#${id}`).evaluate((heading) => {
              const style = getComputedStyle(heading);
              const bounds = heading.getBoundingClientRect();
              return { lines: bounds.height / Number.parseFloat(style.lineHeight), width: bounds.width, fontSize: style.fontSize, fontFamily: style.fontFamily };
            });
            expect(layout.lines, `${id}: ${JSON.stringify(layout)}`).toBeCloseTo(2, 0);
          }
          expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
        });
      }
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await expectReadableHeadings(page);
    await page.locator("main h1, main h2, main h3").evaluateAll((headings) => {
      for (const heading of headings) {
        const element = heading as HTMLElement;
        element.style.fontSize = `${Number.parseFloat(getComputedStyle(element).fontSize) * 1.25}px`;
        element.style.fontFamily = "Arial, sans-serif";
      }
    });
    // A font change can load a new fallback face after the initial page fonts settle.
    await page.evaluate(() => document.fonts.ready);
    await expectReadableHeadings(page);
    const screenshot = testInfo.outputPath("godmin-enlarged-fallback-390.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    await testInfo.attach("godmin-enlarged-fallback-390", { path: screenshot, contentType: "image/png" });
  });
});
