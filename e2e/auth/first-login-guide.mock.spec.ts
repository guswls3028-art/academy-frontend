import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { gotoAndSettle } from "../helpers/wait";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");

type TenantRole = "owner" | "admin" | "teacher" | "staff" | "student" | "parent";

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
