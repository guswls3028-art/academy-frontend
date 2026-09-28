import type { Locator, Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

async function readClockMs(display: Locator) {
  const match = (await display.textContent())?.replace(/\s/g, "").match(/^(\d+):(\d+):(\d+)\.(\d{2})$/);
  expect(match, "time display should stay numeric").not.toBeNull();
  return ((Number(match![1]) * 60 + Number(match![2])) * 60 + Number(match![3])) * 1000 + Number(match![4]) * 10;
}

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
  await expect(installCard).toContainText("지금 보고 있는 화면이 공식 타이머입니다.", { timeout: 30_000 });
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

async function assertResponsiveTimerSurface(page: Page, mobileScreenshotPath: string) {
  const display = page.getByTestId("timer-display");
  await page.getByRole("button", { name: "Projector" }).click();
  const desktopBeforeResize = await readClockMs(display);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "메뉴 열기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "실행 방법 접기" })).toBeVisible();
  await page.getByRole("button", { name: "실행 방법 접기" }).click();
  await expect(page.getByRole("button", { name: "실행 방법 보기" })).toBeVisible();
  await expect(page.getByText("LAST MINUTE", { exact: true })).toBeVisible();
  const mobileAfterResize = await readClockMs(display);
  expect(mobileAfterResize).toBeGreaterThan(0);
  expect(mobileAfterResize).toBeLessThanOrEqual(desktopBeforeResize);
  await expect(display).toHaveCSS("color", "rgb(166, 27, 27)");
  const mobileBounds = await display.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const childRects = Array.from(element.children, (child) => child.getBoundingClientRect());
    let clipLeft = 0;
    let clipRight = window.innerWidth;
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const overflow = getComputedStyle(ancestor).overflowX;
      if (overflow === "hidden" || overflow === "clip") {
        const box = ancestor.getBoundingClientRect();
        clipLeft = Math.max(clipLeft, box.left);
        clipRight = Math.min(clipRight, box.right);
      }
    }
    return {
      left: Math.min(rect.left, ...childRects.map((child) => child.left)),
      right: Math.max(rect.right, ...childRects.map((child) => child.right)),
      clipLeft,
      clipRight,
    };
  });
  expect(mobileBounds.left).toBeGreaterThanOrEqual(mobileBounds.clipLeft);
  expect(mobileBounds.right).toBeLessThanOrEqual(mobileBounds.clipRight);
  const bottomBarTop = (await page.getByRole("navigation", { name: "하단 메뉴" }).boundingBox())!.y;
  const displayViewportBounds = await display.boundingBox();
  expect(displayViewportBounds).not.toBeNull();
  expect(displayViewportBounds!.y + displayViewportBounds!.height).toBeLessThanOrEqual(bottomBarTop);
  for (const name of ["타이머", "스톱워치", "Projector", "초기화", "+1분"]) {
    const button = page.getByRole("button", { name, exact: true });
    const bounds = await button.boundingBox();
    expect(bounds, `${name} button should be visible`).not.toBeNull();
    expect(bounds!.height, `${name} button should stay horizontal`).toBeLessThanOrEqual(60);
    expect(bounds!.x).toBeGreaterThanOrEqual(mobileBounds.clipLeft);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(mobileBounds.clipRight);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(bottomBarTop);
  }
  const mobileFontSize = Number.parseFloat(await display.evaluate((element) => getComputedStyle(element).fontSize));
  expect(mobileFontSize).toBeGreaterThanOrEqual(54);
  expect(mobileFontSize).toBeLessThanOrEqual(55);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: mobileScreenshotPath });
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await expect(page.getByText("PAUSED", { exact: true })).toBeVisible();
  const paused = await readClockMs(display);
  // The paused display must remain unchanged after real time passes.
  // eslint-disable-next-line no-restricted-syntax
  await page.waitForTimeout(300);
  expect(Math.abs((await readClockMs(display)) - paused)).toBeLessThanOrEqual(10);
  await page.getByRole("button", { name: "시작", exact: true }).click();
  await expect(page.getByText("LAST MINUTE", { exact: true })).toBeVisible();
  const mobileBeforeDesktop = await readClockMs(display);
  await page.setViewportSize({ width: 1366, height: 900 });
  await expect(page.getByRole("button", { name: "사이드바 토글" })).toBeVisible();
  await expect(display).toBeVisible();
  const desktopAfterResize = await readClockMs(display);
  expect(desktopAfterResize).toBeGreaterThan(0);
  expect(desktopAfterResize).toBeLessThanOrEqual(mobileBeforeDesktop);
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await expect(page.getByText("PAUSED", { exact: true })).toBeVisible();
  const desktopPaused = await readClockMs(display);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "메뉴 열기" })).toBeVisible();
  await expect(page.getByText("PAUSED", { exact: true })).toBeVisible();
  expect(Math.abs((await readClockMs(display)) - desktopPaused)).toBeLessThanOrEqual(10);
  await page.getByRole("button", { name: "시작", exact: true }).click();
  await expect(page.getByText("LAST MINUTE", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "초기화", exact: true }).click();
  await expect(page.getByText("SET TIME", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "실행 방법 보기" }).click();
  await expect(page.getByText("Smart App Control은 켠 상태로 유지하세요")).toBeVisible();
  await page.getByRole("button", { name: "실행 방법 접기" }).click();
  await expect(page.getByText("Smart App Control은 켠 상태로 유지하세요")).toHaveCount(0);
}

async function assertResponsiveStopwatchSurface(page: Page, mobileScreenshotPath: string) {
  await page.setViewportSize({ width: 1366, height: 900 });
  await expect(page.getByRole("button", { name: "사이드바 토글" })).toBeVisible();
  await page.getByRole("button", { name: "스톱워치", exact: true }).click();
  const display = page.getByTestId("stopwatch-display");
  await expect(display).toBeVisible();
  await page.getByRole("button", { name: "시작", exact: true }).click();
  await expect(page.getByText("RUNNING", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lap", exact: true }).click();
  await expect(page.getByText("LAP 01", { exact: true })).toBeVisible();
  const desktopBeforeResize = await readClockMs(display);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "메뉴 열기" })).toBeVisible();
  await expect(page.getByText("RUNNING", { exact: true })).toBeVisible();
  await expect(page.getByText("LAP 01", { exact: true })).toBeVisible();
  const mobileAfterResize = await readClockMs(display);
  expect(mobileAfterResize).toBeGreaterThanOrEqual(desktopBeforeResize);
  const modeBounds = await page.getByRole("button", { name: "스톱워치", exact: true }).boundingBox();
  const projectorBounds = await page.getByRole("button", { name: "Projector", exact: true }).boundingBox();
  expect(modeBounds).not.toBeNull();
  expect(projectorBounds).not.toBeNull();
  const headerOverlaps = modeBounds!.x < projectorBounds!.x + projectorBounds!.width
    && modeBounds!.x + modeBounds!.width > projectorBounds!.x
    && modeBounds!.y < projectorBounds!.y + projectorBounds!.height
    && modeBounds!.y + modeBounds!.height > projectorBounds!.y;
  expect(headerOverlaps, `mode ${JSON.stringify(modeBounds)} overlaps projector ${JSON.stringify(projectorBounds)}`).toBe(false);
  const mobileDisplayBounds = await display.evaluate((element) => {
    const children = Array.from(element.children, (child) => child.getBoundingClientRect());
    return { left: Math.min(...children.map((child) => child.left)), right: Math.max(...children.map((child) => child.right)) };
  });
  expect(mobileDisplayBounds.left).toBeGreaterThanOrEqual(0);
  expect(mobileDisplayBounds.right).toBeLessThanOrEqual(390);
  const bottomBarTop = (await page.getByRole("navigation", { name: "하단 메뉴" }).boundingBox())!.y;
  const displayViewportBounds = await display.boundingBox();
  expect(displayViewportBounds).not.toBeNull();
  expect(displayViewportBounds!.y + displayViewportBounds!.height).toBeLessThanOrEqual(bottomBarTop);
  for (const name of ["Reset", "일시정지", "Lap"]) {
    const bounds = await page.getByRole("button", { name, exact: true }).boundingBox();
    expect(bounds, `${name} control should be visible`).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(bottomBarTop);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: mobileScreenshotPath });
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await expect(page.getByText("PAUSED", { exact: true })).toBeVisible();
  const paused = await readClockMs(display);
  // Verify pause across elapsed wall time as well as a responsive remount.
  // eslint-disable-next-line no-restricted-syntax
  await page.waitForTimeout(300);
  expect(Math.abs((await readClockMs(display)) - paused)).toBeLessThanOrEqual(10);
  await page.getByRole("button", { name: "시작", exact: true }).click();
  const mobileBeforeDesktop = await readClockMs(display);

  await page.setViewportSize({ width: 1366, height: 900 });
  await expect(page.getByRole("button", { name: "사이드바 토글" })).toBeVisible();
  await expect(page.getByText("RUNNING", { exact: true })).toBeVisible();
  await expect(page.getByText("LAP 01", { exact: true })).toBeVisible();
  expect(await readClockMs(display)).toBeGreaterThanOrEqual(mobileBeforeDesktop);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByText("READY", { exact: true })).toBeVisible();
  await expect(display).toHaveText("00:00:00.00");
  await expect(page.getByText("LAP 01", { exact: true })).toHaveCount(0);
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
  await page.goto(`${BASE}/workspace/tools/stopwatch`, { waitUntil: "commit", timeout: 60_000 });
  await assertDesktopTimerSurface(page);
  await page.screenshot({ path: testInfo.outputPath("admin-stopwatch.png"), fullPage: true });
  await assertResponsiveTimerSurface(page, testInfo.outputPath("admin-mobile-timer-running.png"));
  await page.screenshot({ path: testInfo.outputPath("admin-mobile-timer-viewport.png") });
  await assertResponsiveStopwatchSurface(page, testInfo.outputPath("admin-mobile-stopwatch-running.png"));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/workspace/mobile/tools/stopwatch`, { waitUntil: "commit", timeout: 60_000 });
  await assertMobileStopwatchSurface(page);
  await page.screenshot({ path: testInfo.outputPath("teacher-mobile-stopwatch.png"), fullPage: true });

  expect(externalFontRequests).toEqual([]);
});
