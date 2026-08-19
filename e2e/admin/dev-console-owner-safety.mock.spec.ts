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

async function stubDevTenant(page: Page) {
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", "mock-dev-owner-refresh");
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, createE2eJwt());

  await page.route("**/api/v1/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "{}",
  }));
  await page.route("**/api/v1/core/program/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      tenantCode: "hakwonplus",
      display_name: "학원플러스",
      ui_config: { primary_color: "#2563eb" },
      feature_flags: {},
      is_active: true,
      isPlatformAdmin: true,
    }),
  }));
  await page.route("**/api/v1/core/me/", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      id: 1,
      username: "platform-owner",
      name: "Platform Owner",
      is_staff: true,
      is_superuser: false,
      tenantRole: "owner",
      must_change_password: false,
      first_login_guide_required: false,
    }),
  }));
  await page.route("**/api/v1/core/tenants/11/", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      id: 11,
      code: "godmin",
      name: "신과함께",
      isActive: true,
      primaryDomain: "godmin.kr",
      domains: [
        { host: "godmin.kr", isPrimary: true },
        { host: "www.godmin.kr", isPrimary: false },
      ],
      hasProgram: true,
      featureFlags: {},
    }),
  }));
}

test.use({ serviceWorkers: "block" });
test.skip(!isLocalBase(BASE), "Local route-mock spec. Set E2E_BASE_URL to localhost to run.");

test.describe("개발자 콘솔 소유자 실패 안전", () => {
  test("소유자 조회 실패를 0명으로 오인하지 않고 재시도 전 추가를 잠근다", async ({ page }, testInfo) => {
    await stubDevTenant(page);
    let ownerReadCount = 0;
    let allowOwnerRead = false;
    await page.route("**/api/v1/core/tenants/11/owners/", (route) => {
      ownerReadCount += 1;
      if (!allowOwnerRead) {
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ detail: "temporary_failure" }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
    });

    await gotoAndSettle(page, `${BASE}/dev/tenants/11`);
    await page.getByRole("button", { name: "소유자", exact: true }).click();

    const failure = page.getByRole("alert");
    await expect(failure).toContainText("소유자 조회 실패");
    await expect(page.getByRole("button", { name: "+ 소유자 추가" })).toHaveCount(0);
    const failureScreenshot = testInfo.outputPath("owner-read-failure-desktop.png");
    await page.screenshot({ path: failureScreenshot });
    await testInfo.attach("owner-read-failure-desktop", {
      path: failureScreenshot,
      contentType: "image/png",
    });

    allowOwnerRead = true;
    await failure.getByRole("button", { name: "다시 시도" }).click();
    await expect(page.getByRole("button", { name: "+ 소유자 추가" })).toBeVisible();
    await expect(page.getByText("등록된 소유자가 없습니다.")).toBeVisible();
    expect(ownerReadCount).toBeGreaterThanOrEqual(3);
  });

  test("기존 계정 승격 재요청은 자격 증명과 프로필을 보내지 않는다", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubDevTenant(page);
    let promoted = false;
    const requestBodies: Array<Record<string, unknown>> = [];

    await page.route("**/api/v1/core/tenants/11/owners/", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(promoted ? [{
        tenantId: 11,
        tenantCode: "godmin",
        userId: 77,
        username: "existing-teacher",
        name: "Existing Teacher",
        phone: "01000000000",
        role: "owner",
      }] : []),
    }));
    await page.route("**/api/v1/core/tenants/11/owner/", async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      requestBodies.push(body);
      if (requestBodies.length === 1) {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            detail: "owner_promotion_confirmation_required",
            currentRole: "teacher",
          }),
        });
      }
      promoted = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tenantId: 11,
          tenantCode: "godmin",
          userId: 77,
          username: "existing-teacher",
          name: "Existing Teacher",
          role: "owner",
        }),
      });
    });

    await gotoAndSettle(page, `${BASE}/dev/tenants/11`);
    await page.getByRole("button", { name: "소유자", exact: true }).click();
    await page.getByRole("button", { name: "+ 소유자 추가" }).click();

    const inputs = page.locator("input");
    await inputs.nth(0).fill("existing-teacher");
    await inputs.nth(1).fill("temporary-e2e-password");
    await inputs.nth(2).fill("Must Not Replace");
    await inputs.nth(3).fill("01099999999");

    let dialogMessage = "";
    page.once("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });
    await page.getByRole("button", { name: "등록", exact: true }).click();

    await expect(page.getByText("existing-teacher", { exact: true }).first()).toBeVisible();
    expect(dialogMessage).toContain("기존 비밀번호·이름·전화번호는 그대로");
    expect(requestBodies).toHaveLength(2);
    expect(requestBodies[0]).toMatchObject({
      username: "existing-teacher",
      password: "temporary-e2e-password",
      name: "Must Not Replace",
      phone: "01099999999",
    });
    expect(requestBodies[1]).toEqual({
      username: "existing-teacher",
      promote_existing: true,
    });
    const successToast = page.getByRole("alert");
    await successToast.evaluate(async (element) => {
      await Promise.all(element.getAnimations().map((animation) => animation.finished));
    });
    await expect(successToast).toHaveCSS("opacity", "1");
    await expect(successToast).toHaveCSS("background-color", "rgb(6, 95, 70)");
    const mobileScreenshot = testInfo.outputPath("owner-promotion-mobile-390.png");
    await page.screenshot({ path: mobileScreenshot });
    await testInfo.attach("owner-promotion-mobile-390", {
      path: mobileScreenshot,
      contentType: "image/png",
    });

    const bodyWidth = await page.locator("body").evaluate((body) => ({
      clientWidth: body.clientWidth,
      scrollWidth: body.scrollWidth,
    }));
    expect(bodyWidth.scrollWidth).toBeLessThanOrEqual(bodyWidth.clientWidth);
  });

  test("활성 소유자의 임시 비밀번호만 전용 요청으로 초기화한다", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubDevTenant(page);
    let resetBody: Record<string, unknown> | null = null;
    await page.route("**/api/v1/core/tenants/11/owners/", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{
        tenantId: 11,
        tenantCode: "godmin",
        userId: 77,
        username: "existing-owner",
        name: "Existing Owner",
        phone: "01000000000",
        role: "owner",
        isActive: true,
      }]),
    }));
    await page.route("**/api/v1/core/tenants/11/owners/77/password/", async (route) => {
      resetBody = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          detail: "owner_password_reset",
          userId: 77,
          mustChangePassword: true,
        }),
      });
    });

    await gotoAndSettle(page, `${BASE}/dev/tenants/11`);
    await page.getByRole("button", { name: "소유자", exact: true }).click();
    await page.getByRole("button", { name: "비밀번호 초기화" }).click();

    await page.getByLabel("임시 비밀번호", { exact: true }).fill("temporary-owner-password");
    await page.getByLabel("임시 비밀번호 확인", { exact: true }).fill("temporary-owner-password");
    const mobileScreenshot = testInfo.outputPath("owner-password-reset-mobile-390.png");
    await page.screenshot({ path: mobileScreenshot, fullPage: true });
    await testInfo.attach("owner-password-reset-mobile-390", {
      path: mobileScreenshot,
      contentType: "image/png",
    });
    const bodyWidth = await page.locator("body").evaluate((body) => ({
      clientWidth: body.clientWidth,
      scrollWidth: body.scrollWidth,
    }));
    expect(bodyWidth.scrollWidth).toBeLessThanOrEqual(bodyWidth.clientWidth);
    await page.getByRole("button", { name: "임시 비밀번호 설정" }).click();

    expect(resetBody).toEqual({ password: "temporary-owner-password" });
    await expect(page.getByText("Existing Owner 임시 비밀번호 설정")).toHaveCount(0);
    await expect(page.getByRole("alert")).toContainText("첫 로그인에서 새 비밀번호로 변경");
  });
});
