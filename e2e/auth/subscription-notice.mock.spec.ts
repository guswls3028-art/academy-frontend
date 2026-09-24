import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/strictTest";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const notice = { subscription_expires_at: "2026-09-16", service_access_expires_at: "2026-10-16", days_overdue: 8, days_remaining: 22 };
type Role = "owner" | "admin" | "teacher" | "staff" | "student" | "parent";

async function installApp(page: Page, role: Role, path = "/workspace/settings/profile") {
  const state = { notice: notice as typeof notice | null | undefined, guide: false, failLogin: false, failMe: false, subscriptionRequests: 0, refreshes: 0 };
  const jwt = () => `e30.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.mock`;
  await page.addInitScript(({ path }) => {
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("session_return_path", path);
  }, { path });
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (endpoint === "/core/program/") return json({ tenantCode: "hakwonplus", display_name: "QA 학원", ui_config: {}, feature_flags: {}, is_active: true });
    if (endpoint === "/token/") return state.failLogin ? json({ detail: "invalid" }, 400) : json({ access: jwt(), refresh: "mock-refresh" });
    if (endpoint === "/token/refresh/") { state.refreshes++; return json({ access: jwt(), refresh: "mock-rotated" }); }
    if (endpoint === "/core/me/") {
      if (state.failMe) return json({ detail: "temporarily unavailable" }, 503);
      return json({ id: 77, username: "qa.notice", name: "QA 안내", phone: null, tenantRole: role, is_staff: true,
        is_superuser: false, must_change_password: false, first_login_guide_required: state.guide,
        linkedStudents: role === "parent" ? [{ id: 78, name: "QA 학생" }] : null, subscription_notice: state.notice });
    }
    if (endpoint === "/core/me/first-login-guide/complete/") { state.guide = false; return json({ first_login_guide_required: false }); }
    if (endpoint === "/core/subscription/") { state.subscriptionRequests++; return json({}); }
    if (endpoint === "/staffs/me/") return json({ is_authenticated: true, is_staff: true, is_superuser: false,
      is_payroll_manager: false, is_owner: role === "owner", staff_id: 77, assigned_work_types: [] });
    if (endpoint === "/staffs/77/work-records/current/") return json({ status: "OFF" });
    if (endpoint === "/landing/has-published/") return json({ has_published: false });
    if (endpoint === "/staffs/currently-working/" || endpoint === "/core/profile/expenses/") return json([]);
    return json({ count: 0, next: null, previous: null, results: [] });
  });
  return state;
}

async function login(page: Page) {
  await page.goto(`${BASE}/login/hakwonplus`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.getByTestId("login-username").fill("qa.notice");
  await page.getByTestId("login-password").fill("Mock-password");
  await page.getByTestId("login-submit").click();
}

const dialog = (page: Page) => page.getByRole("dialog", { name: "이용기간 안내", exact: true });
async function recheckMe(page: Page) {
  const response = page.waitForResponse("**/api/v1/core/me/");
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await response;
}

test.use({ serviceWorkers: "block" });
test.skip(!["localhost", "127.0.0.1"].includes(new URL(BASE).hostname), "Local mocked API only");

for (const [role, width, path] of [
  ["owner", 1100, "/workspace/settings/profile"],
  ["admin", 1366, "/workspace/settings/profile"],
  ["teacher", 390, "/workspace/mobile/profile"],
  ["staff", 390, "/workspace/mobile/profile"],
] as const) {
  test(`${role} ${width}px: login notice, keyboard dismissal, navigation/reload/refresh and next login`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await installApp(page, role, path);
    await login(page);
    if (role === "staff") {
      await page.getByRole("button", { name: /출근하지 않고 로그인/ }).click();
    }
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page)).toContainText("2026-09-16");
    await expect(dialog(page)).toContainText("2026-10-16");
    await expect(dialog(page)).toContainText("8일이 지났으며");
    await expect(dialog(page)).toContainText("22일 남았습니다");
    await expect(dialog(page).getByRole("link")).toHaveCount(0);
    const bounds = await dialog(page).boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await dialog(page).getByRole("button", { name: "확인", exact: true }).focus();
    for (let i = 0; i < 5; i++) await page.keyboard.press("Tab");
    expect(await dialog(page).evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`notice-${role}-${width}.png`) });
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await recheckMe(page);
    await expect(dialog(page)).toBeHidden();
    // Real SPA navigation must not create another invitation.
    await page.evaluate(() => { history.pushState({}, "", "/workspace/mobile/profile"); dispatchEvent(new PopStateEvent("popstate")); });
    await expect(dialog(page)).toBeHidden();
    await page.reload();
    await expect(page.locator("[data-app]").first()).toBeVisible();
    await expect(dialog(page)).toBeHidden();
    // Expire only the mocked access token; the next /me request rotates it.
    await page.evaluate(() => {
      const generation = localStorage.getItem("academy:auth-active-generation:v1")!;
      const key = `academy:auth-tokens:v1:${generation}`;
      const envelope = JSON.parse(localStorage.getItem(key)!);
      envelope.access = `e30.${btoa(JSON.stringify({ exp: 1 }))}.mock`;
      localStorage.setItem(key, JSON.stringify(envelope));
    });
    await recheckMe(page);
    expect(state.refreshes).toBeGreaterThan(0);
    await expect(dialog(page)).toBeHidden();
    expect(state.subscriptionRequests).toBe(0);
    await login(page);
    if (role === "staff") await page.getByRole("button", { name: /출근하지 않고 로그인/ }).click();
    await expect(dialog(page)).toBeVisible();
    await dialog(page).getByRole("button", { name: "확인", exact: true }).click();
    await expect(dialog(page)).toBeHidden();
  });
}

for (const role of ["student", "parent"] as const) {
  test(`${role}: never expose a staff notice even with is_staff and a malformed server audience`, async ({ page }) => {
    await installApp(page, role, "/student/profile");
    await login(page);
    await expect(page).toHaveURL(/\/student/);
    await expect(dialog(page)).toBeHidden();
  });
}

for (const empty of [null, undefined]) {
  test(`server notice ${String(empty)}: no popup or billing fetch`, async ({ page }) => {
    const state = await installApp(page, "teacher");
    state.notice = empty;
    await login(page);
    await expect(page).toHaveURL(/\/workspace/);
    await expect(dialog(page)).toBeHidden();
    expect(state.subscriptionRequests).toBe(0);
  });
}

test("first-login guide precedes notice; server renewal closes it; reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const state = await installApp(page, "admin");
  state.guide = true;
  await login(page);
  await expect(page.getByRole("dialog", { name: "계정 안내", exact: true })).toBeVisible();
  await expect(dialog(page)).toBeHidden();
  await page.getByRole("button", { name: "계정 안내 닫기" }).click();
  await expect(dialog(page)).toBeVisible();
  expect(await dialog(page).locator(".admin-modal__inner").evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  state.notice = null;
  await recheckMe(page);
  await expect(dialog(page)).toBeHidden();
});

test("failed credentials do not show a notice; retry succeeds", async ({ page }) => {
  const state = await installApp(page, "teacher");
  state.failLogin = true;
  await login(page);
  await expect(page.getByText("아이디 또는 비밀번호가 올바르지 않습니다.")).toBeVisible();
  await expect(dialog(page)).toBeHidden();
  state.failLogin = false;
  await page.getByTestId("login-submit").click();
  await expect(dialog(page)).toBeVisible();
});
