import { expect, test, type Page } from "../fixtures/strictTest";
import { gotoAndSettle } from "../helpers/wait";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5173").replace(/\/+$/, "");

type LoginRole = "student" | "parent" | "staff";

function createE2eJwt(): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 86400 }),
  ).toString("base64url");
  return `e30.${payload}.e2e`;
}

async function stubLoginFlow(page: Page, role: LoginRole) {
  const requests: Array<{ username?: string; password?: string; tenant_code?: string }> = [];
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
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access, refresh: "mock-iphone-refresh" }),
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

  return { requests };
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
    await page.getByTestId("login-submit").click();

    await expect.poll(() => state.requests.length).toBe(1);
    expect(state.requests[0]).toEqual({
      username: "student.id-20",
      password: "Case-Sensitive-Pw",
      tenant_code: "godmin",
    });
    await expect.poll(() => page.evaluate(() => localStorage.getItem("access"))).toBeTruthy();
    await expect(page).toHaveURL(role === "staff" ? /\/workspace\/mobile(?:\/|$)/ : /\/student(?:\/|$)/);
  });
}

test("토큰 저장이 중간에 실패하면 반쪽 토큰을 지우고 비밀번호 오류와 구분한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubLoginFlow(page, "student");
  await openLogin(page);

  await page.evaluate(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (this === localStorage && key === "refresh") {
        throw new DOMException("blocked", "QuotaExceededError");
      }
      return originalSetItem.call(this, key, value);
    };
  });

  await page.getByTestId("login-username").fill("student.id-20");
  await page.getByTestId("login-password").fill("Case-Sensitive-Pw");
  await page.getByTestId("login-submit").click();

  await expect(page.getByRole("alert")).toHaveText(
    "이 브라우저에 로그인 정보를 저장하지 못했습니다. Safari의 개인정보 보호 설정을 확인한 뒤 다시 시도해 주세요.",
  );
  await expect.poll(() => page.evaluate(() => ({
    access: localStorage.getItem("access"),
    refresh: localStorage.getItem("refresh"),
  }))).toEqual({ access: null, refresh: null });
  await expect(page).toHaveURL(/\/login\/godmin$/);
});
