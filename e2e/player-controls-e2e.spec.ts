/**
 * E2E: 플레이어 외부 컨트롤바 UI/UX 검증
 * - 학생 로그인 → 영상 재생 → 외부 컨트롤바 확인
 * - 건너뛰기, 배속, 극장모드 동작 검증
 * - 플레이어 내부에는 재생/일시정지 + 볼륨 + 전체화면만 있는지 확인
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const SCREENSHOT_DIR = "e2e/screenshots/player-controls";

async function navigateToVideo(page: Page) {
  // 학생앱 → 영상 플레이어 직접 이동 (video 284)
  await page.goto("https://hakwonplus.com/student/video/play?video=284", {
    waitUntil: "load",
    timeout: 20000,
  });
  // HLS 로딩 + 플레이어 마운트 대기
  await page.waitForTimeout(5000);
}

test.describe("플레이어 외부 컨트롤바", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "student");
  });

  test("플레이어 컨트롤바 통합 레이아웃", async ({ page }) => {
    await navigateToVideo(page);

    const controls = page.locator(".svpControls");
    await expect(controls).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-controls-visible.png`, fullPage: false });

    // 재생/일시정지 버튼 있음
    const playBtn = controls.locator('button[aria-label="재생"], button[aria-label="일시정지"]');
    await expect(playBtn.first()).toBeVisible();

    // 10초 뒤로/앞으로 아이콘 버튼 있음 (플레이어 내부)
    const skipBack = controls.locator('button[aria-label="10초 뒤로"]');
    const skipFwd = controls.locator('button[aria-label="10초 앞으로"]');
    await expect(skipBack).toBeVisible();
    await expect(skipFwd).toBeVisible();

    // 전체화면 버튼 있음
    const fsBtn = controls.locator('button[aria-label*="전체화면"]');
    await expect(fsBtn.first()).toBeVisible();

    // 배속 팝오버 버튼 있음 (현재 배속만 표시)
    const speedBtn = controls.locator(".svpSpeedPopBtn");
    await expect(speedBtn).toBeVisible();
    await expect(speedBtn).toHaveText("1x");

    // 극장 모드 버튼 있음
    const theaterBtn = controls.locator('button[aria-label*="극장"]');
    await expect(theaterBtn.first()).toBeVisible();

    // 외부 바는 없어야 함
    const extBar = page.locator(".svpExtBar");
    await expect(extBar).toHaveCount(0);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-controls-layout.png`, fullPage: false });
  });

  test("건너뛰기 버튼 동작 확인", async ({ page }) => {
    await navigateToVideo(page);

    const video = page.locator("video.svpVideo");
    await video.waitFor({ state: "attached", timeout: 10000 });
    await page.waitForTimeout(2000);

    // 재생 시작
    const bigPlay = page.locator(".svpBigPlay");
    if (await bigPlay.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bigPlay.click();
      await page.waitForTimeout(1500);
    }

    // 컨트롤 표시 (마우스 이동)
    await page.locator(".svpVideoStage").hover();
    await page.waitForTimeout(500);

    const timeBefore = await video.evaluate((v: HTMLVideoElement) => v.currentTime);

    // +10초 앞으로 클릭 (플레이어 내부)
    const fwdBtn = page.locator('button[aria-label="10초 앞으로"]');
    await fwdBtn.click();
    await page.waitForTimeout(500);

    const timeAfter = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
    expect(timeAfter - timeBefore).toBeGreaterThanOrEqual(8);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-skip-forward-works.png`, fullPage: false });
  });

  test("배속 팝오버로 배속 변경", async ({ page }) => {
    await navigateToVideo(page);

    const video = page.locator("video.svpVideo");
    await video.waitFor({ state: "attached", timeout: 10000 });

    // 재생 시작
    const bigPlay = page.locator(".svpBigPlay");
    if (await bigPlay.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bigPlay.click();
      await page.waitForTimeout(1000);
    }

    // 컨트롤 표시
    await page.locator(".svpVideoStage").hover();
    await page.waitForTimeout(500);

    // 배속 버튼 클릭 → 팝오버 열기
    const speedBtn = page.locator(".svpSpeedPopBtn");
    await speedBtn.click();
    await page.waitForTimeout(300);

    // 팝오버 메뉴 보임
    const popMenu = page.locator(".svpSpeedPopMenu");
    await expect(popMenu).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-speed-popover-open.png`, fullPage: false });

    // 1.5x 선택
    const item15 = popMenu.locator("button").filter({ hasText: "1.5x" });
    await item15.click();
    await page.waitForTimeout(500);

    // 팝오버 닫힘 + 배속 변경 확인
    await expect(popMenu).not.toBeVisible();
    const rate = await video.evaluate((v: HTMLVideoElement) => v.playbackRate);
    expect(rate).toBeCloseTo(1.5, 1);

    // 버튼 텍스트가 1.5x로 변경
    await page.locator(".svpVideoStage").hover();
    await page.waitForTimeout(500);
    await expect(speedBtn).toHaveText("1.50x");

    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-speed-changed.png`, fullPage: false });
  });

  test("극장 모드 토글", async ({ page }) => {
    await navigateToVideo(page);

    // 컨트롤 표시
    await page.locator(".svpVideoStage").hover();
    await page.waitForTimeout(500);

    // 극장 버튼 클릭 (플레이어 내부)
    const theaterBtn = page.locator('button[aria-label*="극장"]').first();
    await theaterBtn.click();
    await page.waitForTimeout(500);

    const root = page.locator(".svpRoot");
    await expect(root).toHaveClass(/svpTheater/);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-theater-mode-on.png`, fullPage: false });

    // 다시 클릭 → 비활성
    await page.locator(".svpVideoStage").hover();
    await page.waitForTimeout(500);
    const basicBtn = page.locator('button[aria-label*="기본"]').first();
    await basicBtn.click();
    await page.waitForTimeout(500);
    await expect(root).not.toHaveClass(/svpTheater/);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-theater-mode-off.png`, fullPage: false });
  });

  test("모바일 뷰포트에서 컨트롤 레이아웃", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await navigateToVideo(page);

    // 컨트롤 표시
    await page.locator(".svpVideoStage").hover();
    await page.waitForTimeout(500);

    const controls = page.locator(".svpControls");
    await expect(controls).toBeVisible({ timeout: 10000 });

    // 배속 팝오버 버튼 보임
    const speedBtn = page.locator(".svpSpeedPopBtn");
    await expect(speedBtn).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/07-mobile-layout.png`, fullPage: true });
  });
});
