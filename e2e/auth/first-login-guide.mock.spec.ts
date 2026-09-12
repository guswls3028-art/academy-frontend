import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { dismissDevelopmentFirstLoginGuide } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");

type TenantRole = "owner" | "admin" | "teacher" | "staff" | "student" | "parent";

function isLocalBase(url: string): boolean {
  const hostname = new URL(url).hostname;
  return hostname === "127.0.0.1" || hostname === "localhost";
}

function createE2eJwt(identity = "first-login"): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 86400, identity }),
  ).toString("base64url");
  return `e30.${payload}.e2e`;
}

type SwitchAccount = {
  id: number;
  username: string;
  password: string;
  role: "admin" | "student" | "parent";
};

const SWITCH_ACCOUNTS: SwitchAccount[] = [
  { id: 811, username: "omr.admin", password: "Admin-Password", role: "admin" },
  { id: 812, username: "omr.student", password: "Student-Password", role: "student" },
  { id: 813, username: "01087654321", password: "Student-Password", role: "parent" },
];

async function stubAccountSwitchingApp(page: Page, tenantCode: string) {
  const accountsByUsername = new Map(SWITCH_ACCOUNTS.map((account) => [account.username, account]));
  const tokensByUsername = new Map(SWITCH_ACCOUNTS.map((account) => [account.username, {
    access: createE2eJwt(account.username),
    refresh: `refresh-${account.role}`,
  }]));
  const accountsByAccess = new Map(
    SWITCH_ACCOUNTS.map((account) => [tokensByUsername.get(account.username)!.access, account]),
  );
  const guideRequired = new Map(SWITCH_ACCOUNTS.map((account) => [account.username, true]));
  const loginUsernames: string[] = [];

  const accountForRequest = (authorization: string | undefined) => {
    const access = String(authorization || "").replace(/^Bearer\s+/i, "");
    return accountsByAccess.get(access);
  };

  await page.route("**/api/v1/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route("**/api/v1/core/program/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tenantCode,
        display_name: "OMR 계정 전환 점검",
        ui_config: { login_title: "OMR 계정 전환 점검", primary_color: "#2563eb" },
        feature_flags: {},
        is_active: true,
      }),
    });
  });
  await page.route("**/api/v1/token/", async (route) => {
    const body = route.request().postDataJSON() as {
      username?: string;
      password?: string;
      tenant_code?: string;
    };
    const account = accountsByUsername.get(String(body.username || ""));
    expect(body.tenant_code).toBe(tenantCode);
    expect(account).toBeDefined();
    expect(body.password).toBe(account?.password);
    loginUsernames.push(String(body.username));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(tokensByUsername.get(account!.username)),
    });
  });
  await page.route("**/api/v1/core/me/", async (route) => {
    const account = accountForRequest(route.request().headers().authorization);
    if (!account) {
      await route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: account.id,
        username: account.username,
        name: `OMR ${account.role}`,
        phone: account.role === "parent" ? account.username : null,
        is_staff: account.role === "admin",
        is_superuser: false,
        tenantRole: account.role,
        linkedStudents: account.role === "parent" ? [{ id: 812, name: "OMR student" }] : null,
        must_change_password: account.role !== "admin",
        first_login_guide_required: guideRequired.get(account.username),
      }),
    });
  });
  await page.route("**/api/v1/core/me/first-login-guide/complete/", async (route) => {
    const account = accountForRequest(route.request().headers().authorization);
    expect(account).toBeDefined();
    guideRequired.set(account!.username, false);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ first_login_guide_required: false }),
    });
  });

  return {
    accountByRole: (role: SwitchAccount["role"]) => SWITCH_ACCOUNTS.find((account) => account.role === role)!,
    loginUsernames,
  };
}

async function readTokenSessionMetadata(page: Page) {
  return page.evaluate(() => {
    const generation = localStorage.getItem("academy:auth-active-generation:v1");
    const raw = generation
      ? localStorage.getItem(`academy:auth-tokens:v1:${generation}`)
      : null;
    let envelope: { access?: unknown; refresh?: unknown; generation?: unknown } | null = null;
    try { envelope = raw ? JSON.parse(raw) : null; } catch { envelope = null; }
    return {
      generation,
      envelopeGeneration: envelope?.generation ?? null,
      hasAccess: typeof envelope?.access === "string" && envelope.access.length > 0,
      hasRefresh: typeof envelope?.refresh === "string" && envelope.refresh.length > 0,
      legacyAccess: localStorage.getItem("access"),
      legacyRefresh: localStorage.getItem("refresh"),
    };
  });
}

async function loginAccountThroughForm(
  page: Page,
  tenantCode: string,
  account: SwitchAccount,
  previousGeneration: string | null,
): Promise<string> {
  await gotoAndSettle(page, `${BASE}/login/${tenantCode}`, { timeout: 20_000 });
  await expect(page.getByRole("form", { name: "로그인 폼" })).toBeVisible();
  await page.getByTestId("login-username").fill(account.username);
  await page.getByTestId("login-password").fill(account.password);
  const loginResponsePromise = page.waitForResponse((response) => (
    response.request().method() === "POST"
    && new URL(response.url()).pathname === "/api/v1/token/"
  ));
  const meResponsePromise = page.waitForResponse((response) => (
    response.request().method() === "GET"
    && new URL(response.url()).pathname === "/api/v1/core/me/"
    && response.status() === 200
  ));
  await page.getByTestId("login-submit").click();
  expect((await loginResponsePromise).status()).toBe(200);
  const currentUser = await (await meResponsePromise).json() as {
    tenantRole?: string;
    must_change_password?: boolean;
    first_login_guide_required?: boolean;
  };
  expect(currentUser.tenantRole).toBe(account.role);
  expect(typeof currentUser.must_change_password).toBe("boolean");
  expect(typeof currentUser.first_login_guide_required).toBe("boolean");

  const session = await readTokenSessionMetadata(page);
  expect(session.generation).toBeTruthy();
  expect(session.envelopeGeneration).toBe(session.generation);
  expect(session.hasAccess).toBe(true);
  expect(session.hasRefresh).toBe(true);
  expect(session.legacyAccess).toBeNull();
  expect(session.legacyRefresh).toBeNull();
  if (previousGeneration) expect(session.generation).not.toBe(previousGeneration);

  const landingPath = account.role === "admin" ? "/workspace/guide" : "/student/guide";
  await gotoAndSettle(page, `${BASE}${landingPath}`, { timeout: 20_000 });
  const passwordDialog = page.getByRole("dialog", { name: "비밀번호 변경 권장" });
  if (currentUser.must_change_password) {
    await expect(passwordDialog).toBeVisible();
    await passwordDialog
      .getByRole("button", { name: "위험을 이해했고 나중에", exact: true })
      .click();
    await expect(passwordDialog).toBeHidden();
  } else {
    await expect(passwordDialog).toBeHidden();
  }

  const guideDialog = page.getByRole("dialog", { name: "계정 안내" });
  if (currentUser.first_login_guide_required) {
    await expect(guideDialog).toBeVisible();
    const completionResponsePromise = page.waitForResponse((response) => (
      response.request().method() === "POST"
      && new URL(response.url()).pathname === "/api/v1/core/me/first-login-guide/complete/"
    ));
    await guideDialog.getByRole("button", { name: "확인", exact: true }).click();
    const completionResponse = await completionResponsePromise;
    expect(completionResponse.status()).toBe(200);
    expect((await completionResponse.json()).first_login_guide_required).toBe(false);
  } else {
    await expect(guideDialog).toBeHidden();
  }

  const reloadedMeResponsePromise = page.waitForResponse((response) => (
    response.request().method() === "GET"
    && new URL(response.url()).pathname === "/api/v1/core/me/"
    && response.status() === 200
  ));
  await page.reload();
  const reloadedUser = await (await reloadedMeResponsePromise).json() as {
    tenantRole?: string;
    first_login_guide_required?: boolean;
  };
  expect(reloadedUser.tenantRole).toBe(account.role);
  expect(reloadedUser.first_login_guide_required).toBe(false);
  await expect(passwordDialog).toBeHidden();
  await expect(guideDialog).toBeHidden();
  expect((await readTokenSessionMetadata(page)).generation).toBe(session.generation);
  return String(session.generation);
}

async function stubAuthenticatedApp(
  page: Page,
  {
    role,
    required = true,
    tenantCode = "movementhui",
    completionStatus = 200,
  }: {
    role: TenantRole;
    required?: boolean;
    tenantCode?: string;
    completionStatus?: number;
  },
) {
  let guideRequired = required;
  let completionCount = 0;
  const access = createE2eJwt();

  await page.addInitScript(({ code, token }) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", "mock-first-login-refresh");
    localStorage.setItem("tenant_code", code);
    sessionStorage.setItem("tenantCode", code);
  }, { code: tenantCode, token: access });

  await page.route("**/api/v1/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });

  await page.route("**/api/v1/core/program/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tenantCode,
        display_name: "동휘원소 과학연구소",
        ui_config: {
          login_title: "동휘원소 과학연구소",
          primary_color: "#e7bd2f",
        },
        feature_flags: {},
        is_active: true,
      }),
    });
  });

  await page.route("**/api/v1/core/me/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 72,
        username: "t10_dlehdgnl0728",
        name: "이동휘",
        phone: null,
        is_staff: role !== "student" && role !== "parent",
        is_superuser: false,
        tenantRole: role,
        linkedStudents: role === "parent" ? [{ id: 101, name: "테스트 학생" }] : null,
        must_change_password: false,
        first_login_guide_required: guideRequired,
      }),
    });
  });

  await page.route("**/api/v1/core/me/first-login-guide/complete/", async (route) => {
    completionCount += 1;
    if (completionStatus !== 200) {
      await route.fulfill({
        status: completionStatus,
        contentType: "application/json",
        body: JSON.stringify({ detail: "temporary failure" }),
      });
      return;
    }
    guideRequired = false;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        first_login_guide_required: false,
        completed_at: "2026-07-30T12:00:00Z",
      }),
    });
  });

  return {
    completionCount: () => completionCount,
  };
}

test.use({ serviceWorkers: "block" });
test.skip(!isLocalBase(BASE), "Local route-mock spec. Set E2E_BASE_URL to localhost to run.");

test.describe("생애 첫 접속 계정 안내", () => {
  test("OMR 실사용 순서의 모든 계정 전환은 로그인 폼으로 새 generation을 만든다", async ({ page }) => {
    const tenantCode = "qa-ymath-realuse-omr-account-switch";
    const state = await stubAccountSwitchingApp(page, tenantCode);
    const roles = ["admin", "student", "parent", "admin", "student", "parent"] as const;
    const generations: string[] = [];
    let previousGeneration: string | null = null;

    for (const role of roles) {
      const account = state.accountByRole(role);
      previousGeneration = await loginAccountThroughForm(
        page,
        tenantCode,
        account,
        previousGeneration,
      );
      generations.push(previousGeneration);
    }

    expect(new Set(generations).size).toBe(roles.length);
    expect(state.loginUsernames).toEqual(roles.map((role) => state.accountByRole(role).username));
  });

  test("신규 관리자는 계정 안내를 확인한 뒤 보호 화면 작업을 이어간다", async ({ page }, testInfo) => {
    const tenantCode = "qa-ymath-realuse-admin-first-login";
    const apiState = await stubAuthenticatedApp(page, { role: "admin", tenantCode });

    await gotoAndSettle(page, `${BASE}/workspace/guide`, { timeout: 20_000 });
    const backgroundAction = page.getByRole("button", {
      name: /학원 정보와 공개 고지부터 확인/,
    });
    await expect(backgroundAction).toBeVisible();
    await expect(backgroundAction).toBeEnabled();

    const dialog = page.getByRole("dialog", { name: "계정 안내" });
    await expect(dialog).toBeVisible();
    const overlayScreenshot = testInfo.outputPath("admin-first-login-guide-overlay.png");
    await page.screenshot({ path: overlayScreenshot });
    await testInfo.attach("admin-first-login-guide-overlay", {
      path: overlayScreenshot,
      contentType: "image/png",
    });
    expect(apiState.completionCount()).toBe(0);
    const completionResponse = page.waitForResponse((response) => (
      response.request().method() === "POST"
      && response.url().includes("/api/v1/core/me/first-login-guide/complete/")
    ));
    await dialog.getByRole("button", { name: "확인", exact: true }).click();
    expect((await completionResponse).status()).toBe(200);
    await expect(dialog).toBeHidden();
    expect(apiState.completionCount()).toBe(1);

    const refreshedMeResponse = page.waitForResponse((response) => (
      response.request().method() === "GET"
      && response.url().includes("/api/v1/core/me/")
      && !response.url().includes("/first-login-guide/")
    ));
    await page.reload();
    const refreshedMe = await (await refreshedMeResponse).json() as {
      first_login_guide_required?: boolean;
    };
    expect(refreshedMe.first_login_guide_required).toBe(false);
    await expect(dialog).toBeHidden();
    expect(apiState.completionCount()).toBe(1);
    await expect(backgroundAction).toBeVisible();
    await expect(backgroundAction).toBeEnabled();
    await backgroundAction.click();
    await expect(page).toHaveURL(/\/workspace\/settings\/organization$/);
    expect(apiState.completionCount()).toBe(1);
  });

  test("개발 배포 실사용 로그인은 일회성 계정 안내를 확인한 뒤 계속한다", async ({ page }) => {
    const tenantCode = "qa-ymath-realuse-first-login-guide";
    const apiState = await stubAuthenticatedApp(page, { role: "student", tenantCode });

    await gotoAndSettle(page, `${BASE}/student/guide`, { timeout: 20_000 });
    await dismissDevelopmentFirstLoginGuide(page, tenantCode, "development");

    await expect(page.getByRole("dialog", { name: "계정 안내" })).not.toBeVisible();
    expect(apiState.completionCount()).toBe(1);
  });

  test("학생은 아이디와 권유형 안내를 한 번 확인하고 다시 보지 않는다", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem("hakwonplus:student-theme-mode", "dark");
    });
    const apiState = await stubAuthenticatedApp(page, { role: "student" });

    await gotoAndSettle(page, `${BASE}/student/guide`, { timeout: 20_000 });

    const dialog = page.getByRole("dialog", { name: "계정 안내" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "확인", exact: true })).toBeFocused();
    await expect(dialog.getByText("dlehdgnl0728", { exact: true })).toBeVisible();
    await expect(dialog.getByText("필요할 때 내 정보에서 언제든 변경할 수 있습니다.")).toBeVisible();
    await expect(dialog.getByRole("textbox")).toHaveCount(0);
    await testInfo.attach("student-dark-390-first-login-guide", {
      body: await page.screenshot(),
      contentType: "image/png",
    });

    await dialog.getByRole("button", { name: "확인", exact: true }).click();

    await expect(dialog).not.toBeVisible();
    expect(apiState.completionCount()).toBe(1);

    await page.reload();
    await expect(dialog).not.toBeVisible();
    expect(apiState.completionCount()).toBe(1);
  });

  test("학부모의 내 정보 버튼은 안내를 완료하고 학생 프로필로 이동한다", async ({ page }) => {
    const apiState = await stubAuthenticatedApp(page, { role: "parent" });

    await gotoAndSettle(page, `${BASE}/student/guide`, { timeout: 20_000 });
    const dialog = page.getByRole("dialog", { name: "계정 안내" });
    await dialog.getByRole("button", { name: "내 정보 열기" }).click();

    await expect(page).toHaveURL(/\/student\/profile$/);
    await expect(dialog).not.toBeVisible();
    expect(apiState.completionCount()).toBe(1);
  });

  test("선생 모바일 화면의 내 정보 버튼은 모바일 설정으로 이동한다", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    const apiState = await stubAuthenticatedApp(page, { role: "teacher" });

    await gotoAndSettle(page, `${BASE}/workspace/mobile/guide`, { timeout: 20_000 });
    const dialog = page.getByRole("dialog", { name: "계정 안내" });
    await testInfo.attach("teacher-1366-first-login-guide", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
    await dialog.getByRole("button", { name: "내 정보 열기" }).click();

    await expect.poll(apiState.completionCount).toBe(1);
    await expect(page).toHaveURL(/\/workspace\/mobile\/settings$/);
    await expect(dialog).not.toBeVisible();
    expect(apiState.completionCount()).toBe(1);
  });

  test("이미 확인한 계정에는 안내를 표시하지 않는다", async ({ page }) => {
    await stubAuthenticatedApp(page, { role: "staff", required: false });

    await gotoAndSettle(page, `${BASE}/workspace/mobile/guide`, { timeout: 20_000 });

    await expect(page.getByRole("dialog", { name: "계정 안내" })).not.toBeVisible();
  });

  test("완료 저장이 실패하면 안내와 재시도 가능한 오류를 유지한다", async ({ page }) => {
    const apiState = await stubAuthenticatedApp(page, {
      role: "owner",
      completionStatus: 503,
    });

    await gotoAndSettle(page, `${BASE}/workspace/guide`, { timeout: 20_000 });
    const dialog = page.getByRole("dialog", { name: "계정 안내" });
    await dialog.getByRole("button", { name: "확인", exact: true }).click();

    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("alert")).toHaveText(
      "안내 확인을 저장하지 못했습니다. 다시 시도해 주세요.",
    );
    expect(apiState.completionCount()).toBe(1);
  });
});
