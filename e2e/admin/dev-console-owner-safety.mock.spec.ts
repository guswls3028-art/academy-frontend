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
  test("기본 테넌트 생성과 소유자 등록을 분리해 부분 성공을 만들지 않는다", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubDevTenant(page);
    let createBody: Record<string, unknown> | null = null;
    let ownerWriteCount = 0;
    let releaseCreate: (() => void) | undefined;

    await page.route("**/api/v1/core/tenants/", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    }));
    await page.route("**/api/v1/core/tenants/create/", async (route) => {
      createBody = route.request().postDataJSON() as Record<string, unknown>;
      await new Promise<void>((resolve) => { releaseCreate = resolve; });
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: 101,
          code: "qa-academy",
          name: "QA 학원",
          isActive: true,
          primaryDomain: "qa.example.com",
          domains: ["qa-academy", "qa.example.com"],
        }),
      });
    });
    await page.route("**/api/v1/core/tenants/101/", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 101,
        code: "qa-academy",
        name: "QA 학원",
        isActive: true,
        primaryDomain: "qa.example.com",
        domains: [
          { host: "qa-academy", isPrimary: false },
          { host: "qa.example.com", isPrimary: true },
        ],
        hasProgram: true,
        featureFlags: {},
      }),
    }));
    await page.route("**/api/v1/core/tenants/*/owner/", (route) => {
      ownerWriteCount += 1;
      return route.fulfill({ status: 500, body: "unexpected owner write" });
    });

    await gotoAndSettle(page, `${BASE}/dev/tenants`);
    await page.getByRole("button", { name: "+ 새 테넌트" }).click();

    const dialog = page.getByRole("dialog", { name: "개발·QA 테넌트 기본 생성" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("운영 신규 테넌트는 이 폼으로 만들지 않습니다.");
    await expect(dialog.getByText("Owner 계정 함께 생성")).toHaveCount(0);
    await dialog.getByLabel("코드 *").fill("qa-academy");
    await dialog.getByLabel("이름 *").fill("QA 학원");
    await dialog.getByLabel("도메인").fill("qa.example.com");
    const formScreenshot = testInfo.outputPath("tenant-create-form-mobile-390.png");
    await page.screenshot({ path: formScreenshot, fullPage: true });
    await testInfo.attach("tenant-create-form-mobile-390", {
      path: formScreenshot,
      contentType: "image/png",
    });

    const submit = dialog.getByRole("button", { name: "기본 레코드 생성" });
    await submit.click();
    await expect(dialog.getByRole("button", { name: "기본 레코드 생성 중..." })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "취소" })).toBeDisabled();
    await dialog.evaluate((element) => element.parentElement?.click());
    await expect(dialog).toBeVisible();

    releaseCreate?.();
    await page.waitForURL("**/dev/tenants/101");
    expect(createBody).toEqual({
      code: "qa-academy",
      name: "QA 학원",
      domain: "qa.example.com",
    });
    expect(ownerWriteCount).toBe(0);

    const bodyWidth = await page.locator("body").evaluate((body) => ({
      clientWidth: body.clientWidth,
      scrollWidth: body.scrollWidth,
    }));
    expect(bodyWidth.scrollWidth).toBeLessThanOrEqual(bodyWidth.clientWidth);
    const screenshot = testInfo.outputPath("tenant-create-order-mobile-390.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    await testInfo.attach("tenant-create-order-mobile-390", {
      path: screenshot,
      contentType: "image/png",
    });
  });

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
    const ownersTab = page.getByRole("button", { name: "소유자", exact: true });
    await expect(ownersTab).toBeVisible({ timeout: 60_000 });
    await ownersTab.click();

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

  test("브랜딩 조회 실패 중 편집·업로드·저장을 숨기고 성공 재조회 뒤에만 연다", async ({ page }) => {
    await stubDevTenant(page);
    let brandingAvailable = false;
    let brandingReadCount = 0;
    const brandingWrites: string[] = [];
    await page.route("**/api/v1/core/tenant-branding/11/**", async (route) => {
      const request = route.request();
      brandingReadCount += request.method() === "GET" ? 1 : 0;
      if (request.method() !== "GET") {
        brandingWrites.push(request.method());
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ detail: "unexpected_branding_write" }),
        });
      }
      if (!brandingAvailable) {
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ detail: "temporary_branding_failure" }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tenantId: 11,
          displayName: "신과함께 학원",
          windowTitle: "신과함께",
          loginTitle: "신과함께 로그인",
          loginSubtitle: "안전한 학습 공간",
        }),
      });
    });

    await gotoAndSettle(page, `${BASE}/dev/tenants/11`);
    const brandingTab = page.getByRole("button", { name: "브랜딩", exact: true });
    await expect(brandingTab).toBeVisible({ timeout: 60_000 });
    await brandingTab.click();

    const failure = page.getByRole("alert");
    await expect(failure).toContainText("브랜딩 정보를 불러오지 못했습니다");
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await expect(page.getByPlaceholder("헤더에 표시될 이름")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "저장", exact: true })).toHaveCount(0);
    expect(brandingWrites).toEqual([]);

    brandingAvailable = true;
    await failure.getByRole("button", { name: "다시 시도" }).click();
    await expect(page.getByPlaceholder("헤더에 표시될 이름")).toHaveValue("신과함께 학원");
    await expect(page.locator('input[type="file"]')).toHaveCount(1);
    expect(brandingReadCount).toBeGreaterThan(1);
    expect(brandingWrites).toEqual([]);
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
        isActive: true,
        hasUsablePassword: true,
        mustChangePassword: false,
        handoffStatus: "complete",
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
          hasUsablePassword: true,
          mustChangePassword: false,
          handoffStatus: "complete",
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
    let ownerReadCount = 0;
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
        hasUsablePassword: true,
        mustChangePassword: true,
        handoffStatus: "first_login_pending",
      }]),
    }).then(() => { ownerReadCount += 1; }));
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
    await expect(page.getByRole("heading", { name: "인계 대기 1명" })).toBeVisible();
    await expect(page.getByLabel("인계 1/2단계 완료")).toBeVisible();
    await expect(page.getByRole("link", { name: "대표자 로그인 열기 ↗" })).toHaveAttribute(
      "href",
      "https://godmin.kr/login",
    );
    await expect(page.getByText("최초 로그인 대기", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "비밀번호 재설정" }).click();

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
    expect(ownerReadCount).toBeGreaterThanOrEqual(2);
  });

  test("소유자 인계 완료와 비밀번호 설정 필요 상태를 구분한다", async ({ page }, testInfo) => {
    await stubDevTenant(page);
    await page.route("**/api/v1/core/tenants/11/owners/", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          userId: 76,
          username: "waiting-owner",
          name: "Waiting Owner",
          role: "owner",
          isActive: true,
          hasUsablePassword: true,
          mustChangePassword: true,
          handoffStatus: "first_login_pending",
        },
        {
          userId: 77,
          username: "ready-owner",
          name: "Ready Owner",
          role: "owner",
          isActive: true,
          hasUsablePassword: true,
          mustChangePassword: false,
          handoffStatus: "complete",
        },
        {
          userId: 78,
          username: "blocked-owner",
          name: "Blocked Owner",
          role: "owner",
          isActive: true,
          hasUsablePassword: false,
          mustChangePassword: true,
          handoffStatus: "password_setup_required",
        },
      ]),
    }));

    await gotoAndSettle(page, `${BASE}/dev/tenants/11`);
    await page.getByRole("button", { name: "소유자", exact: true }).click();

    await expect(page.getByText("인계 완료", { exact: true })).toBeVisible();
    await expect(page.getByText("비밀번호 설정 필요", { exact: true })).toBeVisible();
    await expect(page.getByText("최초 로그인 대기", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "인계 대기 2명" })).toBeVisible();
    await expect(page.getByText(/Blocked Owner: 임시 비밀번호를 설정해야/)).toBeVisible();
    await expect(page.getByLabel("인계 0/2단계 완료")).toBeVisible();
    const desktopScreenshot = testInfo.outputPath("owner-handoff-checkpoint-desktop.png");
    await page.screenshot({ path: desktopScreenshot, fullPage: true });
    await testInfo.attach("owner-handoff-checkpoint-desktop", {
      path: desktopScreenshot,
      contentType: "image/png",
    });
    await page.getByRole("button", { name: "임시 비밀번호 설정" }).click();
    await expect(page.getByRole("heading", { name: "Blocked Owner 임시 비밀번호 설정" })).toBeVisible();
  });
});
