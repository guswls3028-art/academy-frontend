import { expect, test, type Page } from "../fixtures/strictTest";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";

async function openGodminLogin(page: Page) {
  await page.route("**/api/v1/core/program/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tenantCode: "godmin",
        display_name: "신과함께",
        ui_config: {
          login_title: "신과함께",
          logo_url: "/tenants/godmin/logo.png",
        },
        feature_flags: {},
        is_active: true,
      }),
    });
  });
  await page.route("**/api/v1/core/landing/has-published/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ has_published: false }),
    });
  });

  await page.goto(`${BASE}/login/godmin`, { waitUntil: "commit", timeout: 45_000 });
  await expect(page.getByRole("form", { name: "로그인 폼" })).toBeVisible({ timeout: 30_000 });
}

test("Godmin 데스크톱 로그인은 점 없이 분할 레이아웃과 포커스 피드백을 유지한다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openGodminLogin(page);

  const ambient = page.locator('[data-auth-part="ambient"] > span');
  const username = page.getByTestId("login-username");

  await expect(ambient.nth(0)).toBeVisible();
  await expect(ambient.nth(1)).toBeVisible();
  await expect(ambient.nth(2)).toBeHidden();
  await expect(username).toBeFocused();

  const layout = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector(selector)?.getBoundingClientRect();
    const cardRect = rect('[data-auth-part="card"]');
    const brandRect = rect('[data-auth-part="brand-stage"]');
    const panelRect = rect('[data-auth-part="login-panel"]');
    return {
      cardWidth: cardRect?.width ?? 0,
      brandRight: brandRect?.right ?? 0,
      panelLeft: panelRect?.left ?? 0,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  expect(layout.cardWidth).toBeGreaterThan(900);
  expect(layout.brandRight).toBeLessThanOrEqual(layout.panelLeft + 1);
  expect(layout.horizontalOverflow).toBe(false);

  await username.focus();
  const focusShadow = await username.evaluate((element) => getComputedStyle(element).boxShadow);
  expect(focusShadow).not.toBe("none");

  await testInfo.attach("godmin-login-desktop.png", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});

test("Godmin 390px 로그인은 한 열로 쌓이고 가로로 넘치지 않는다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openGodminLogin(page);

  const layout = await page.evaluate(() => {
    const cardRect = document.querySelector('[data-auth-part="card"]')?.getBoundingClientRect();
    const brandRect = document.querySelector('[data-auth-part="brand-stage"]')?.getBoundingClientRect();
    const panelRect = document.querySelector('[data-auth-part="login-panel"]')?.getBoundingClientRect();
    return {
      cardLeft: cardRect?.left ?? 0,
      cardRight: cardRect?.right ?? 0,
      brandBottom: brandRect?.bottom ?? 0,
      panelTop: panelRect?.top ?? 0,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  expect(layout.cardLeft).toBeGreaterThanOrEqual(11);
  expect(layout.cardRight).toBeLessThanOrEqual(379);
  expect(layout.panelTop).toBeGreaterThanOrEqual(layout.brandBottom - 1);
  expect(layout.horizontalOverflow).toBe(false);
  await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
  await expect(page.getByRole("button", { name: "회원가입" })).toBeVisible();

  await testInfo.attach("godmin-login-mobile-390.png", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});

test("Godmin은 reduced motion 환경에서 장식과 진입 애니메이션을 멈춘다", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openGodminLogin(page);

  const animationNames = await page.evaluate(() => [
    '[data-auth-part="card"]',
    '[data-auth-part="brand-artwork"]',
    '[data-auth-part="login-intro"]',
    'form[aria-label="로그인 폼"]',
  ].map((selector) => getComputedStyle(document.querySelector(selector)!).animationName));
  expect(animationNames).toEqual(["none", "none", "none", "none"]);
});
