/**
 * E2E: 플레이어 컨트롤 UI/UX 검증 (재설계 후)
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const SCREENSHOT_DIR = "e2e/screenshots/player-controls";

async function navigateToVideo(page: Page) {
  await page.goto("https://hakwonplus.com/student/video/play?video=284", {
    waitUntil: "load",
    timeout: 20000,
  });
  await page.waitForTimeout(5000);
}

/** 영상 일시정지 + 컨트롤 표시 (pause 상태에서는 컨트롤이 항상 보임) */
async function pauseAndShowControls(page: Page) {
  // 재생 중이면 Space로 일시정지 → 컨트롤 자동 표시
  await page.keyboard.press("Space");
  await page.waitForTimeout(500);
}

test.describe("플레이어 컨트롤 바", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "student");
  });

  test("컨트롤 바 레이아웃 + SVG 아이콘", async ({ page }) => {
    await navigateToVideo(page);
    await pauseAndShowControls(page);

    const controls = page.locator(".svpControls");

    // 재생/일시정지 버튼 — SVG 아이콘
    const playBtn = controls.locator('button[aria-label="재생"], button[aria-label="일시정지"]');
    await expect(playBtn.first()).toBeVisible({ timeout: 5000 });

    // SVG가 렌더링되는지 확인
    const hasSvg = await playBtn.first().locator("svg").count();
    expect(hasSvg).toBeGreaterThan(0);

    // 10초 뒤로/앞으로 — SVG 아이콘
    await expect(controls.locator('button[aria-label="10초 뒤로"]')).toBeVisible();
    await expect(controls.locator('button[aria-label="10초 앞으로"]')).toBeVisible();

    // 전체화면
    await expect(controls.locator('button[aria-label*="전체화면"]').first()).toBeVisible();

    // 배속 버튼 (현재값만 표시)
    const speedBtn = controls.locator(".svpSpeedPopBtn");
    await expect(speedBtn).toBeVisible();

    // 외부 바 없음
    await expect(page.locator(".svpExtBar")).toHaveCount(0);

    // 디버그 정보 없음
    const pageText = await page.locator(".svpTopBar").textContent() || "";
    expect(pageText).not.toContain("video#");
    expect(pageText).not.toContain("enrollment#");

    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-controls-layout.png`, fullPage: false });
  });

  test("건너뛰기: 키보드 L키로 +10초", async ({ page }) => {
    await navigateToVideo(page);

    const video = page.locator("video.svpVideo");
    await video.waitFor({ state: "attached", timeout: 10000 });
    await page.waitForTimeout(1000);

    // 재생 시작
    await page.keyboard.press("Space");
    await page.waitForTimeout(1000);

    const timeBefore = await video.evaluate((v: HTMLVideoElement) => v.currentTime);

    // L키 = +10초
    await page.keyboard.press("l");
    await page.waitForTimeout(500);

    const timeAfter = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
    expect(timeAfter - timeBefore).toBeGreaterThanOrEqual(8);

    await pauseAndShowControls(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-skip-works.png`, fullPage: false });
  });

  test("배속: 키보드 >키로 변경 + 팝오버 확인", async ({ page }) => {
    await navigateToVideo(page);

    const video = page.locator("video.svpVideo");
    await video.waitFor({ state: "attached", timeout: 10000 });

    // 재생
    await page.keyboard.press("Space");
    await page.waitForTimeout(1000);

    // > 키로 배속 업
    await page.keyboard.press(">");
    await page.waitForTimeout(300);
    await page.keyboard.press(">");
    await page.waitForTimeout(300);

    const rate = await video.evaluate((v: HTMLVideoElement) => v.playbackRate);
    expect(rate).toBeGreaterThan(1);

    // 일시정지 → 컨트롤 표시
    await pauseAndShowControls(page);

    // 배속 버튼 텍스트가 1x가 아님
    const speedBtn = page.locator(".svpSpeedPopBtn");
    const btnText = await speedBtn.textContent();
    expect(btnText).not.toBe("1x");

    // 배속 버튼 클릭 → 팝오버
    await speedBtn.click();
    await page.waitForTimeout(300);

    const popMenu = page.locator(".svpSpeedPopMenu");
    await expect(popMenu).toBeVisible({ timeout: 3000 });

    // 활성 항목에 체크 표시
    const activeItem = popMenu.locator(".svpSpeedPopItem--active");
    await expect(activeItem).toBeVisible();
    const checkMark = activeItem.locator(".svpSpeedPopCheck");
    await expect(checkMark).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-speed-popover.png`, fullPage: false });

    // 1x 선택하여 복귀
    await popMenu.locator("button").filter({ hasText: /^1x$/ }).click();
    await page.waitForTimeout(300);

    const rateAfter = await video.evaluate((v: HTMLVideoElement) => v.playbackRate);
    expect(rateAfter).toBeCloseTo(1, 1);
  });

  test("모바일 레이아웃", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await navigateToVideo(page);
    await pauseAndShowControls(page);

    await expect(page.locator(".svpControls")).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".svpSpeedPopBtn")).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-mobile.png`, fullPage: true });
  });
});
