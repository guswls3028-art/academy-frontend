import { expect, test, type Page } from "../fixtures/strictTest";
import { gotoAndSettle } from "../helpers/wait";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5173").replace(/\/+$/, "");

type LoginRole = "student" | "parent" | "staff";

function createE2eJwt(generation = "default"): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 86400, generation }),
  ).toString("base64url");
  return `e30.${payload}.e2e`;
}

async function stubLoginFlow(page: Page, role: LoginRole) {
  const requests: Array<{ username?: string; password?: string; tenant_code?: string }> = [];
  const access = createE2eJwt(`${role}-login`);
  const refresh = `mock-${role}-refresh`;

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
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access, refresh }),
    });
  });
  await page.route("**/api/v1/core/me/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 901,
        username: "student.id-20",
        name: "모바일 로그인 점검",
        is_staff: role === "staff",
        is_superuser: false,
        tenantRole: role,
        linkedStudents: role === "parent" ? [{ id: 902, name: "연결 학생" }] : null,
        must_change_password: false,
        first_login_guide_required: false,
      }),
    });
  });

  return { requests, access, refresh };
}

async function openLogin(page: Page) {
  await gotoAndSettle(page, `${BASE}/login/godmin`, { timeout: 30_000 });
  await expect(page.getByRole("form", { name: "로그인 폼" })).toBeVisible();
}

test.use({ serviceWorkers: "block" });

for (const role of ["student", "parent", "staff"] as const) {
  test(`iPhone 로그인은 ${role} 입력값을 바꾸지 않고 역할 홈까지 이동한다`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const state = await stubLoginFlow(page, role);
    await openLogin(page);

    const username = page.getByTestId("login-username");
    const password = page.getByTestId("login-password");
    await expect(username).toHaveAttribute("autocapitalize", "none");
    await expect(username).toHaveAttribute("autocorrect", "off");
    await expect(username).toHaveAttribute("spellcheck", "false");
    await expect(password).toHaveAttribute("autocapitalize", "none");
    await expect(password).toHaveAttribute("autocorrect", "off");
    await expect(password).toHaveAttribute("spellcheck", "false");

    await username.fill("student.id-20");
    await password.fill("Case-Sensitive-Pw");
    await page.getByTestId("login-submit").click({ timeout: 30_000 });

    await expect.poll(() => state.requests.length).toBe(1);
    expect(state.requests[0]).toEqual({
      username: "student.id-20",
      password: "Case-Sensitive-Pw",
      tenant_code: "godmin",
    });
    await expect.poll(() => page.evaluate(() => ({
      access: localStorage.getItem("access"),
      refresh: localStorage.getItem("refresh"),
    }))).toEqual({ access: state.access, refresh: state.refresh });
    await expect(page).toHaveURL(role === "staff" ? /\/workspace\/mobile(?:\/|$)/ : /\/student(?:\/|$)/);
  });
}

test("첫 번째와 두 번째 토큰 저장 실패 모두 기존 세션을 복원하고 명시 안내한다", async ({ context }) => {
  for (const failedKey of ["access", "refresh"] as const) {
    const page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await stubLoginFlow(page, "student");
    await openLogin(page);
    await page.evaluate(() => {
      localStorage.setItem("access", "previous-access");
      localStorage.setItem("refresh", "previous-refresh");
    });

    await page.evaluate((keyToFail) => {
      const originalSetItem = Storage.prototype.setItem;
      let failed = false;
      Storage.prototype.setItem = function setItem(key: string, value: string) {
        if (this === localStorage && key === keyToFail && !failed) {
          failed = true;
          throw new DOMException("blocked", "QuotaExceededError");
        }
        return originalSetItem.call(this, key, value);
      };
    }, failedKey);

    await page.getByTestId("login-username").fill("student.id-20");
    await page.getByTestId("login-password").fill("Case-Sensitive-Pw");
    await page.getByTestId("login-submit").click({ timeout: 30_000 });

    await expect(page.getByRole("alert")).toHaveText(
      "이 브라우저에 로그인 정보를 저장하지 못했습니다. Safari의 개인정보 보호 설정을 확인한 뒤 다시 시도해 주세요.",
    );
    await expect.poll(() => page.evaluate(() => ({
      access: localStorage.getItem("access"),
      refresh: localStorage.getItem("refresh"),
    }))).toEqual({ access: "previous-access", refresh: "previous-refresh" });
    await expect(page).toHaveURL(/\/login\/godmin$/);
    await page.close();
  }
});

type LockMode = "supported" | "unsupported";

async function installNavigatorLocksMode(page: Page, mode: LockMode): Promise<void> {
  await page.addInitScript((selectedMode) => {
    const value = selectedMode === "supported"
      ? { request: async (_name: string, callback: () => unknown) => callback() }
      : undefined;
    Object.defineProperty(navigator, "locks", { configurable: true, value });
  }, mode);
}

async function loginAsAccountB(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await stubLoginFlow(page, "staff");
  await openLogin(page);
  await page.getByTestId("login-username").fill("staff.account-b");
  await page.getByTestId("login-password").fill("Account-B-Pw");
  await page.getByTestId("login-submit").click({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/workspace\/mobile(?:\/|$)/);
  return state;
}

for (const lockMode of ["supported", "unsupported"] as const) {
  test(`지연된 A refresh는 B 로그인을 덮지 않는다 (${lockMode})`, async ({ page, context }) => {
    await installNavigatorLocksMode(page, lockMode);
    await page.route("**/api/v1/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    let releaseRefresh!: () => void;
    const refreshRelease = new Promise<void>((resolve) => { releaseRefresh = resolve; });
    let markRefreshRequested!: () => void;
    const refreshRequested = new Promise<void>((resolve) => { markRefreshRequested = resolve; });
    const staleRotatedAccess = createE2eJwt(`stale-a-${lockMode}`);
    await page.route("**/api/v1/token/refresh/", async (route) => {
      expect(route.request().postDataJSON()).toEqual({ refresh: "refresh-a" });
      markRefreshRequested();
      await refreshRelease;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access: staleRotatedAccess, refresh: "rotated-refresh-a" }),
      });
    });

    const raceAuthorizations: string[] = [];
    await page.route("**/api/v1/race/", async (route) => {
      raceAuthorizations.push(route.request().headers().authorization || "");
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await page.goto(`${BASE}/robots.txt`);
    await page.evaluate(() => {
      const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 60 }));
      localStorage.setItem("access", `e30.${payload}.expired`);
      localStorage.setItem("refresh", "refresh-a");
    });

    const requestResult = page.evaluate(async () => {
      const { default: api } = await new Function(
        "return import('/src/shared/api/axios.ts')",
      )() as { default: { get: (url: string) => Promise<unknown> } };
      return api.get("/race/").then(() => "ok", () => "failed");
    });
    await refreshRequested;

    const accountBPage = await context.newPage();
    const accountB = await loginAsAccountB(accountBPage);
    releaseRefresh();

    await expect(requestResult).resolves.toBe("failed");
    await expect.poll(() => accountBPage.evaluate(() => ({
      access: localStorage.getItem("access"),
      refresh: localStorage.getItem("refresh"),
    }))).toEqual({ access: accountB.access, refresh: accountB.refresh });
    expect(raceAuthorizations).toEqual([]);
  });

  test(`A 요청의 지연된 401은 B 세션을 지우지 않는다 (${lockMode})`, async ({ page, context }) => {
    await installNavigatorLocksMode(page, lockMode);
    await page.route("**/api/v1/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    let releaseUnauthorized!: () => void;
    const unauthorizedRelease = new Promise<void>((resolve) => { releaseUnauthorized = resolve; });
    let markRaceRequested!: () => void;
    const raceRequested = new Promise<void>((resolve) => { markRaceRequested = resolve; });
    let refreshCalls = 0;
    await page.route("**/api/v1/token/refresh/", async (route) => {
      refreshCalls += 1;
      await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    });
    await page.route("**/api/v1/race-401/", async (route) => {
      markRaceRequested();
      await unauthorizedRelease;
      await route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    });
    await page.goto(`${BASE}/robots.txt`);
    const accessA = createE2eJwt(`account-a-${lockMode}`);
    await page.evaluate(({ access }) => {
      localStorage.setItem("access", access);
      localStorage.setItem("refresh", "refresh-a");
    }, { access: accessA });

    const requestResult = page.evaluate(async () => {
      const { default: api } = await new Function(
        "return import('/src/shared/api/axios.ts')",
      )() as { default: { get: (url: string) => Promise<unknown> } };
      return api.get("/race-401/").then(() => "ok", () => "failed");
    });
    await raceRequested;

    const accountBPage = await context.newPage();
    const accountB = await loginAsAccountB(accountBPage);
    releaseUnauthorized();

    await expect(requestResult).resolves.toBe("failed");
    expect(refreshCalls).toBe(0);
    await expect.poll(() => accountBPage.evaluate(() => ({
      access: localStorage.getItem("access"),
      refresh: localStorage.getItem("refresh"),
      expired: sessionStorage.getItem("session_expired"),
    }))).toEqual({ access: accountB.access, refresh: accountB.refresh, expired: null });
  });
}
