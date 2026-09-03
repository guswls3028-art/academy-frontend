import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function seed(page: Page) {
  test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "타이머 시각 회귀는 로컬 route-mock 전용");
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
    localStorage.setItem("teacher:preferAdmin", "false");
  }, localJwt());
}

async function installApi(page: Page) {
  await page.route("**/api/v1/**", async (route: Route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") {
      return json({
        tenantCode: "hakwonplus",
        isPlatformAdmin: true,
        display_name: "학원플러스",
        feature_flags: {},
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      return json({
        id: 12,
        username: "visual_admin",
        name: "관리자",
        is_staff: true,
        is_superuser: true,
        tenantRole: "admin",
        must_change_password: false,
      });
    }
    return json({ count: 0, results: [] });
  });
}

async function assertDesktopTimerSurface(page: Page) {
  const installCard = page.getByRole("region", { name: "안전한 PC 타이머" });
  await expect(installCard).toContainText("지금 보고 있는 화면이 공식 타이머입니다.");
  await expect(installCard).toContainText("Smart App Control은 켠 상태로 유지하세요");
  await expect(installCard).toContainText("English_Timer (1).exe");
  await expect(page.getByRole("button", { name: "Windows용 다운로드" })).toHaveCount(0);
  await expect(page.getByText("추가 정보", { exact: true })).toHaveCount(0);

  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted" }>;
    };
    Object.defineProperty(event, "prompt", {
      value: async () => {
        document.body.dataset.pwaPrompted = "true";
      },
    });
    Object.defineProperty(event, "userChoice", {
      value: Promise.resolve({ outcome: "accepted" as const }),
    });
    window.dispatchEvent(event);
  });
  const installButton = page.getByRole("button", { name: "이 PC에 앱으로 설치" });
  await expect(installButton).toBeVisible();
  await installButton.click();
  await expect(page.locator("body")).toHaveAttribute("data-pwa-prompted", "true");
  await expect(page.getByRole("button", { name: "앱으로 실행 중" })).toBeDisabled();

  await page.getByRole("button", { name: "1분", exact: true }).click();
  const display = page.getByTestId("timer-display");
  await expect(display).toBeVisible();
  const fontFamily = await display.evaluate((element) => getComputedStyle(element).fontFamily);
  expect(fontFamily).toContain("ui-monospace");
  expect(fontFamily).not.toContain("JetBrains Mono");
  await expect(page.getByRole("button", { name: "타이머", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "스톱워치", exact: true })).toBeVisible();

  await page.keyboard.press("Space");
  await expect(page.getByText("LAST MINUTE", { exact: true })).toBeVisible();
  await expect(display).toHaveCSS("color", "rgb(166, 27, 27)");
  expect(Number.parseFloat(await display.evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(176);

  await page.getByRole("button", { name: "Projector" }).click();
  await expect(display).toHaveCSS("color", "rgb(255, 255, 255)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

async function assertMobileStopwatchSurface(page: Page) {
  await expect(page.getByTestId("mobile-stopwatch-display")).toHaveText("00:00.00");
  await expect(page.getByRole("button", { name: "시작", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "리셋", exact: true })).toBeVisible();
  await expect(page.getByText("PC에서 안전하게 사용", { exact: true })).toBeVisible();
  await expect(page.getByText("Smart App Control을 끄거나 기존 English_Timer 실행 파일을 열 필요가 없습니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /PC 타이머.*받기/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test("타이머는 외부 글꼴 없이 관리자·강사 화면에서 안정적으로 렌더된다", async ({ page }, testInfo) => {
  await seed(page);
  await installApi(page);
  const externalFontRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("fonts.googleapis.com")) externalFontRequests.push(request.url());
  });

  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${BASE}/workspace/tools/stopwatch`);
  await assertDesktopTimerSurface(page);
  await page.screenshot({ path: testInfo.outputPath("admin-stopwatch.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/workspace/mobile/tools/stopwatch`);
  await assertMobileStopwatchSurface(page);
  await page.screenshot({ path: testInfo.outputPath("teacher-mobile-stopwatch.png"), fullPage: true });

  expect(externalFontRequests).toEqual([]);
});
