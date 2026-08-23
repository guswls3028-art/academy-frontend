import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { gotoAndSettle } from "../helpers/wait";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");

async function stubLoginBootstrap(page: Page, tenantCode: string) {
  await page.route("**/api/v1/core/program/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tenantCode,
        display_name: tenantCode,
        ui_config: { login_title: tenantCode },
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
}

for (const tenantCode of ["godmin", "tchul"] as const) {
  test(`${tenantCode} 로그인은 유지하고 회원가입 진입은 숨긴다`, async ({ page }) => {
    await stubLoginBootstrap(page, tenantCode);

    await gotoAndSettle(page, `${BASE}/login/${tenantCode}`, { timeout: 20_000 });

    await expect(page.getByTestId("login-username")).toBeVisible();
    await expect(page.getByTestId("login-password")).toBeVisible();
    await expect(page.getByTestId("login-submit")).toBeVisible();
    await expect(page.getByRole("button", { name: "아이디 찾기" })).toBeVisible();
    await expect(page.getByRole("button", { name: "비밀번호 찾기" })).toBeVisible();
    await expect(page.getByRole("button", { name: "회원가입", exact: true })).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "학생 회원가입" })).toHaveCount(0);
  });
}

test("회원가입 사용 테넌트는 기존 진입과 모달을 유지한다", async ({ page }) => {
  await stubLoginBootstrap(page, "hakwonplus");
  await gotoAndSettle(page, `${BASE}/login/hakwonplus`, { timeout: 20_000 });

  await page.getByRole("button", { name: "회원가입", exact: true }).click();

  await expect(page.getByRole("dialog", { name: "학생 회원가입" })).toBeVisible();
});
