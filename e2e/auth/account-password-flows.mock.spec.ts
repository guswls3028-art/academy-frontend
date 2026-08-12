import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { gotoAndSettle } from "../helpers/wait";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");

function isLocalBase(url: string): boolean {
  const hostname = new URL(url).hostname;
  return hostname === "127.0.0.1" || hostname === "localhost";
}

function createE2eJwt(): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 86400 }),
  ).toString("base64url");
  return `e30.${payload}.e2e`;
}

async function stubAccountApp(
  page: Page,
  {
    mustChangePassword = false,
    onProfileUpdate,
    onPasswordChange,
    onLegacyPasswordChange,
  }: {
    mustChangePassword?: boolean;
    onProfileUpdate?: (body: Record<string, unknown>) => void;
    onPasswordChange?: (body: Record<string, unknown>) => void;
    onLegacyPasswordChange?: () => void;
  } = {},
) {
  const access = createE2eJwt();
  await page.addInitScript(({ token }) => {
    if (sessionStorage.getItem("account_auth_seeded") !== "1") {
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", "mock-account-refresh");
      localStorage.setItem("tenant_code", "hakwonplus");
      sessionStorage.setItem("tenantCode", "hakwonplus");
      sessionStorage.setItem("account_auth_seeded", "1");
    }
  }, { token: access });

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
        tenantCode: "hakwonplus",
        display_name: "학원플러스",
        ui_config: {},
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
        id: 12,
        username: "t1_admin97",
        name: "관리자",
        phone: "01012345678",
        is_staff: true,
        is_superuser: false,
        tenantRole: "admin",
        linkedStudents: null,
        must_change_password: mustChangePassword,
        first_login_guide_required: false,
      }),
    });
  });

  await page.route("**/api/v1/core/profile/update_me/", async (route) => {
    onProfileUpdate?.(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 12,
        username: "admin97",
        name: "관리자 수정",
        phone: "01012345678",
      }),
    });
  });

  await page.route("**/api/v1/core/change-password/", async (route) => {
    onPasswordChange?.(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "비밀번호가 변경되었습니다." }),
    });
  });

  await page.route("**/api/v1/core/profile/change-password/", async (route) => {
    onLegacyPasswordChange?.();
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ detail: "legacy password endpoint must not be used" }),
    });
  });
}

test.use({ serviceWorkers: "block" });
test.skip(!isLocalBase(BASE), "Local route-mock spec. Set E2E_BASE_URL to localhost to run.");

test.describe("역할별 본인 비밀번호 변경 요청 계약", () => {
  test("관리자 내 정보 수정은 개인정보만 저장하고 비밀번호 입력을 섞지 않는다", async ({ page }) => {
    let profileBody: Record<string, unknown> | undefined;
    let passwordChangeCount = 0;
    await stubAccountApp(page, {
      onProfileUpdate: (body) => { profileBody = body; },
      onPasswordChange: () => { passwordChangeCount += 1; },
    });

    await gotoAndSettle(page, `${BASE}/workspace/settings/profile`, { timeout: 20_000 });
    await page.getByRole("button", { name: "수정", exact: true }).first().click();

    const profileSection = page.getByRole("heading", { name: "프로필" }).locator("xpath=ancestor::section");
    await expect(profileSection.getByLabel("현재 비밀번호")).toHaveCount(0);
    await expect(profileSection.getByLabel("새 비밀번호")).toHaveCount(0);
    await profileSection.getByLabel("이름").fill("관리자 수정");
    await profileSection.getByRole("button", { name: "저장" }).click();

    await expect.poll(() => profileBody).toEqual({
      name: "관리자 수정",
      phone: "01012345678",
    });
    expect(passwordChangeCount).toBe(0);
  });

  test("관리자 본인 변경은 공통 API를 호출하고 성공 즉시 기존 토큰을 폐기한다", async ({ page }) => {
    let passwordBody: Record<string, unknown> | undefined;
    let legacyCount = 0;
    await stubAccountApp(page, {
      onPasswordChange: (body) => { passwordBody = body; },
      onLegacyPasswordChange: () => { legacyCount += 1; },
    });

    await gotoAndSettle(page, `${BASE}/workspace/settings/profile`, { timeout: 20_000 });
    const securitySection = page.getByRole("heading", { name: "보안" }).locator("xpath=ancestor::section");
    await securitySection.getByRole("button", { name: "변경", exact: true }).click();
    await securitySection.getByLabel("현재 비밀번호").fill("old-admin-password");
    await securitySection.getByLabel("새 비밀번호", { exact: true }).fill("new-admin-password");
    await securitySection.getByLabel("새 비밀번호 확인").fill("new-admin-password");
    await securitySection.getByRole("button", { name: "변경", exact: true }).click();

    await expect.poll(() => passwordBody).toEqual({
      old_password: "old-admin-password",
      new_password: "new-admin-password",
    });
    expect(legacyCount).toBe(0);
    await expect.poll(() => page.evaluate(() => ({
      access: localStorage.getItem("access"),
      refresh: localStorage.getItem("refresh"),
    }))).toEqual({ access: null, refresh: null });
  });

  test("임시 비밀번호 첫 로그인도 공통 API 뒤 재로그인 상태로 전환한다", async ({ page }) => {
    let passwordBody: Record<string, unknown> | undefined;
    await stubAccountApp(page, {
      mustChangePassword: true,
      onPasswordChange: (body) => { passwordBody = body; },
    });

    await gotoAndSettle(page, `${BASE}/workspace/dashboard`, { timeout: 20_000 });
    const dialog = page.getByRole("dialog", { name: "비밀번호 변경" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("현재/임시 비밀번호").fill("temporary-password");
    await dialog.getByLabel("새 비밀번호", { exact: true }).fill("permanent-password");
    await dialog.getByLabel("새 비밀번호 확인").fill("permanent-password");
    await dialog.getByRole("button", { name: "비밀번호 변경", exact: true }).click();

    await expect.poll(() => passwordBody).toEqual({
      old_password: "temporary-password",
      new_password: "permanent-password",
    });
    await expect.poll(() => page.evaluate(() => ({
      access: localStorage.getItem("access"),
      refresh: localStorage.getItem("refresh"),
    }))).toEqual({ access: null, refresh: null });
  });
});
