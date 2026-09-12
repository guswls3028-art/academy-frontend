import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { gotoAndSettle } from "../helpers/wait";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");

function textContrast(foreground: number[], background: number[]) {
  const luminance = (rgb: number[]) => rgb.slice(0, 3).reduce((sum, value, index) => {
    const channel = value / 255;
    const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
  const values = [luminance(foreground), luminance(background)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

function rgbValues(color: string) {
  return color.match(/[\d.]+/g)!.map(Number);
}

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

async function openFilledSignup(page: Page) {
  await stubLoginBootstrap(page, "hakwonplus");
  await page.route("**/api/v1/students/registration_requests/check_duplicate/", (route) =>
    route.fulfill({ json: { username: { available: true }, phone: { available: true } } }),
  );
  await gotoAndSettle(page, `${BASE}/login/hakwonplus`, { timeout: 20_000 });
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "학생 회원가입" });
  await dialog.locator("#signup-name").fill("가입검증학생");
  await dialog.getByRole("button", { name: "남", exact: true }).click();
  await dialog.locator("#signup-username").fill("signup-feedback-mock");
  await dialog.locator("#signup-pw").fill("Local-mock-only-0913!");
  await dialog.locator("#signup-pw-confirm").fill("Local-mock-only-0913!");
  await dialog.getByLabel("휴대전화 앞 4자리").fill("0000");
  await dialog.getByLabel("휴대전화 뒤 4자리").fill("0913");
  await dialog.getByLabel("학부모 연락처 앞 4자리").fill("0000");
  await dialog.getByLabel("학부모 연락처 뒤 4자리").fill("0914");
  await dialog.locator("#signup-high").fill("검증고등학교");
  await dialog.locator("#signup-grade").selectOption("1");
  if (await dialog.locator("#signup-origin").isVisible()) {
    await dialog.locator("#signup-origin").fill("검증중학교");
  }
  await dialog.locator("#signup-address").fill("로컬 모의 검증 주소");
  return dialog;
}

for (const width of [390, 1366]) {
  for (const outcome of ["approved", "pending"] as const) {
    test(`가입 결과 ${outcome} 안내와 로그인 복귀를 구분한다 (${width}px)`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      const unexpectedApiPaths: string[] = [];
      await page.route("**/api/v1/**", (route) => {
        unexpectedApiPaths.push(new URL(route.request().url()).pathname);
        return route.fulfill({ status: 500, json: { detail: "Unexpected mock API request" } });
      });
      let submissions = 0;
      await page.route("**/api/v1/students/registration_requests/", async (route) => {
        submissions += 1;
        expect(route.request().method()).toBe("POST");
        expect(route.request().headers()["x-tenant-code"]).toBe("hakwonplus");
        expect(route.request().headers()["authorization"]).toBeUndefined();
        const payload = route.request().postDataJSON();
        expect(payload.password_confirmation === payload.initial_password).toBe(true);
        await route.fulfill({
          status: outcome === "approved" ? 200 : 201,
          json: outcome === "approved" ? { id: 913, name: "가입검증학생" } : { id: 914, status: "pending" },
        });
      });
      const dialog = await openFilledSignup(page);
      await dialog.getByRole("button", { name: "가입 신청", exact: true }).click();
      const message = outcome === "approved"
        ? "가입이 완료되었습니다. 지금 로그인할 수 있습니다."
        : "신청이 완료되었습니다. 승인 후 로그인해 주세요.";
      const status = dialog.getByText(message, { exact: true });
      await expect(status).toBeVisible();
      await expect(dialog.locator("form")).toHaveCount(0);
      const confirmation = dialog.getByRole("button", {
        name: outcome === "approved" ? "로그인하기" : "확인", exact: true,
      });
      await expect(confirmation).toBeVisible();
      const colors = await dialog.evaluate((element) => {
        const card = getComputedStyle(element.firstElementChild!);
        return {
          surface: card.backgroundColor,
          title: getComputedStyle(element.querySelector("#signup-modal-title")!).color,
          status: getComputedStyle(element.querySelector('[role="status"]')!).color,
        };
      });
      const buttonColors = await confirmation.evaluate((button) => {
        const style = getComputedStyle(button);
        return { text: style.color, background: style.backgroundImage, filter: style.filter };
      });
      const gradientColors = [...buttonColors.background.matchAll(/rgba?\(([^)]+)\)/g)]
        .map((match) => rgbValues(match[1]));
      expect(gradientColors.length).toBeGreaterThanOrEqual(2);
      // The signup-only contrast layer is a uniform translucent first gradient.
      const overlay = gradientColors[0].length === 4 ? gradientColors[0] : null;
      if (overlay) expect(gradientColors[1]).toEqual(overlay);
      const stops = overlay ? gradientColors.slice(2) : gradientColors;
      expect(stops.length).toBeGreaterThanOrEqual(2);
      const brightness = Number(buttonColors.filter.match(/brightness\(([\d.]+)\)/)?.[1] ?? 1);
      const contrast = {
        title: textContrast(rgbValues(colors.title), rgbValues(colors.surface)),
        status: textContrast(rgbValues(colors.status), rgbValues(colors.surface)),
        button: Math.min(...stops.map((stop) => textContrast(rgbValues(buttonColors.text),
          stop.slice(0, 3).map((channel, index) => Math.min(255, brightness * (overlay
            ? overlay[index] * overlay[3] + channel * (1 - overlay[3])
            : channel))),
        ))),
      };
      for (const [target, ratio] of Object.entries(contrast)) {
        expect(ratio, `${target} text contrast`).toBeGreaterThanOrEqual(4.5);
      }
      if (outcome === "approved") {
        await expect(dialog.getByText(/승인 후 로그인|승인까지 기다려/)).toHaveCount(0);
      }
      const bounds = { status: await status.boundingBox(), confirmation: await confirmation.boundingBox() };
      for (const box of Object.values(bounds)) {
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.y + box!.height).toBeLessThanOrEqual(width === 390 ? 844 : 900);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`signup-${outcome}-${width}.png`), fullPage: true });
      await testInfo.attach("signup-result-dom", {
        body: JSON.stringify({ outcome, width, message, bounds, colors, buttonColors, contrast, submissions, evidence: "local route mock; no server persistence" }),
        contentType: "application/json",
      });
      await confirmation.click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByTestId("login-username")).toBeVisible();
      await expect(page.getByTestId("login-password")).toBeVisible();
      await page.getByRole("button", { name: "회원가입", exact: true }).click();
      await expect(dialog.locator("#signup-name")).toHaveValue("");
      await expect(dialog.getByText(message, { exact: true })).toHaveCount(0);
      expect(submissions).toBe(1);
      expect(unexpectedApiPaths).toEqual([]);
    });
  }
}

for (const response of [
  { name: "승인 실패", status: 503, json: { detail: "가입 승인 처리를 완료하지 못했습니다." }, error: "가입 승인 처리를 완료하지 못했습니다." },
  { name: "불완전한 성공 응답", status: 200, json: {}, error: "가입 처리 결과를 확인하지 못했습니다." },
]) {
  test(`${response.name} 시 완료 안내 없이 입력을 보존하고 재시도할 수 있다`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    let submissions = 0;
    await page.route("**/api/v1/**", (route) => route.fulfill({ status: 500, json: { detail: "Unexpected mock API request" } }));
    await page.route("**/api/v1/students/registration_requests/", (route) => {
      submissions += 1;
      return route.fulfill(submissions === 1
        ? { status: response.status, json: response.json }
        : { status: 200, json: { id: 913, name: "가입검증학생" } });
    });
    const dialog = await openFilledSignup(page);
    await dialog.getByRole("button", { name: "가입 신청", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText(response.error);
    await expect(dialog.getByText(/완료되었습니다/)).toHaveCount(0);
    await expect(dialog.locator("#signup-username")).toHaveValue("signup-feedback-mock");
    await expect(dialog.locator("#signup-high")).toHaveValue("검증고등학교");
    await expect(dialog.getByRole("button", { name: "가입 신청", exact: true })).toBeEnabled();
    expect(submissions).toBe(1);
    await dialog.getByRole("button", { name: "가입 신청", exact: true }).click();
    await expect(dialog.getByText("가입이 완료되었습니다. 지금 로그인할 수 있습니다.", { exact: true })).toBeVisible();
    expect(submissions).toBe(2);
  });
}
