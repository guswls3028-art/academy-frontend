import { expect, test, type Page } from "../fixtures/strictTest";
import { gotoAndSettle } from "../helpers/wait";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5173").replace(/\/+$/, "");

type SafariCapabilityProfile = {
  name: string;
  colorMix: boolean;
};

declare global {
  interface Window {
    __browserUpdateGateObserved?: boolean;
  }
}

function createE2eJwt(): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 86_400 }),
  ).toString("base64url");
  return `e30.${payload}.e2e`;
}

async function installSafariCapabilityProfile(
  page: Page,
  profile: SafariCapabilityProfile,
): Promise<void> {
  await page.addInitScript(({ name, colorMix }) => {
    const originalSupports = CSS.supports.bind(CSS);
    Object.defineProperty(CSS, "supports", {
      configurable: true,
      value: (...args: Parameters<typeof CSS.supports>) => {
        if (args.some((value) => String(value).includes("color-mix"))) return colorMix;
        return originalSupports(...args);
      },
    });
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      get: () => `Mozilla/5.0 (iPhone; CPU iPhone OS ${name.replace("Safari ", "").replace(".", "_")} like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1`,
    });

    window.__browserUpdateGateObserved = false;
    const observer = new MutationObserver(() => {
      const root = document.getElementById("root");
      if (root?.textContent?.includes("브라우저 업데이트가 필요합니다")) {
        window.__browserUpdateGateObserved = true;
      }
    });
    observer.observe(document, { childList: true, subtree: true, characterData: true });
  }, profile);
}

async function stubStudentLogin(page: Page): Promise<void> {
  const access = createE2eJwt();

  await page.route("**/api/v1/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
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
  await page.route("**/api/v1/core/landing/has-published/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ has_published: false }),
    });
  });
  await page.route("**/api/v1/token/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access, refresh: "mock-student-refresh" }),
    });
  });
  await page.route("**/api/v1/core/me/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 901,
        username: "student.browser-support",
        name: "모바일 브라우저 점검",
        is_staff: false,
        is_superuser: false,
        tenantRole: "student",
        must_change_password: false,
        first_login_guide_required: false,
      }),
    });
  });
}

async function expectStudentShell(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/student(?:\/|$)/);
  await expect(page.locator(".student-layout")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("region", { name: "자주 쓰는 일" })).toBeVisible({ timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 });
  expect(await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1);
}

test.use({ serviceWorkers: "block" });

for (const profile of [
  { name: "Safari 14", colorMix: false },
  { name: "Safari 15", colorMix: false },
  { name: "Safari 16.1", colorMix: false },
  { name: "current Safari", colorMix: true },
] satisfies SafariCapabilityProfile[]) {
  test(`${profile.name} capability에서 로그인과 학생 cold load가 전역 차단되지 않는다`, async ({ page }) => {
    let staffClockChunkRequests = 0;
    page.on("request", (request) => {
      if (request.url().includes("StaffClockInChoiceDialog")) staffClockChunkRequests += 1;
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await installSafariCapabilityProfile(page, profile);
    await stubStudentLogin(page);
    await gotoAndSettle(page, `${BASE}/login/godmin`, { timeout: 30_000 });
    await expect(page.getByRole("form", { name: "로그인 폼" })).toBeVisible();
    expect(await page.evaluate(() => window.__browserUpdateGateObserved)).toBe(false);

    await page.getByTestId("login-username").fill("student.browser-support");
    await page.getByTestId("login-password").fill("Case-Sensitive-Pw");
    await page.getByTestId("login-submit").click({ timeout: 30_000 });
    await expectStudentShell(page);

    await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await expectStudentShell(page);
    await page.goto("about:blank");
    await gotoAndSettle(page, `${BASE}/student`, { timeout: 30_000 });
    await expectStudentShell(page);

    await expect.poll(() => staffClockChunkRequests).toBe(0);
    await expect(page.getByText("브라우저 업데이트가 필요합니다")).toHaveCount(0);
    if (!profile.colorMix) {
      await expect(page.locator("html")).toHaveAttribute("data-color-mix", "unsupported");
      const fallbackTint = await page.locator(".student-layout").evaluate((element) => (
        getComputedStyle(element).getPropertyValue("--stu-tint-primary").trim()
      ));
      expect(fallbackTint).not.toContain("color-mix");
      expect(fallbackTint).not.toBe("");
    }
  });
}
