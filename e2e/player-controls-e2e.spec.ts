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
  // 학생앱 → 전체공개영상 or 첫번째 세션의 비디오로 이동
  // Tenant 1의 video 284가 유일하게 남아있음
  await page.goto("https://hakwonplus.com/student", { waitUntil: "load" });
  await page.waitForTimeout(2000);

  // 세션 목록에서 영상이 있는 세션 클릭
  const sessionLink = page.locator("a[href*='/student/sessions/'], a[href*='/student/video']").first();
  if (await sessionLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await sessionLink.click();
    await page.waitForTimeout(2000);
  }

  // 영상 링크 클릭 (video player 페이지로 이동)
  const videoLink = page.locator("a[href*='/student/video/'], a[href*='video']").first();
  if (await videoLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await videoLink.click();
    await page.waitForTimeout(3000);
  }
}

test.describe("플레이어 외부 컨트롤바", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "student");
  });

  test("외부 컨트롤바가 플레이어 아래에 렌더링됨", async ({ page }) => {
    await navigateToVideo(page);

    // 외부 컨트롤바 존재 확인
    const extBar = page.locator(".svpExtBar");
    await expect(extBar).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-ext-bar-visible.png`, fullPage: false });

    // 건너뛰기 버튼 2개 확인
    const skipBtns = extBar.locator("button.svpExtBtn").filter({ hasText: /뒤로|앞으로/ });
    await expect(skipBtns).toHaveCount(2);

    // 배속 pill 버튼 확인
    const speedPills = extBar.locator("button.svpExtSpeedPill");
    const pillCount = await speedPills.count();
    expect(pillCount).toBeGreaterThanOrEqual(3); // 최소 0.5, 1, 2

    // 극장 버튼 확인
    const theaterBtn = extBar.locator("button.svpExtTheater");
    await expect(theaterBtn).toBeVisible();

    // 1x가 기본 활성 상태
    const activePill = extBar.locator(".svpExtSpeedPill--active");
    await expect(activePill).toHaveText("1x");
  });

  test("플레이어 내부에서 건너뛰기/배속/극장 버튼이 제거됨", async ({ page }) => {
    await navigateToVideo(page);

    const controls = page.locator(".svpControls");
    await expect(controls).toBeVisible({ timeout: 10000 });

    // 내부에 재생/일시정지 버튼 있음
    const playBtn = controls.locator('button[aria-label="재생"], button[aria-label="일시정지"]');
    await expect(playBtn.first()).toBeVisible();

    // 내부에 전체화면 버튼 있음
    const fsBtn = controls.locator('button[aria-label*="전체화면"]');
    await expect(fsBtn.first()).toBeVisible();

    // 내부에 음소거 버튼 있음
    const muteBtn = controls.locator('button[aria-label="음소거"]');
    await expect(muteBtn.first()).toBeVisible();

    // 내부에 -10초/+10초 버튼 없음 (외부로 이동됨)
    const skip10 = controls.locator('button[aria-label="-10초"], button[aria-label="+10초"]');
    await expect(skip10).toHaveCount(0);

    // 내부에 배속 메뉴 없음 (외부로 이동됨)
    const rateMenu = controls.locator(".svpRate");
    await expect(rateMenu).toHaveCount(0);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-internal-controls-minimal.png`, fullPage: false });
  });

  test("건너뛰기 버튼 동작 확인", async ({ page }) => {
    await navigateToVideo(page);

    // 영상 재생 대기
    const video = page.locator("video.svpVideo");
    await video.waitFor({ state: "attached", timeout: 10000 });
    await page.waitForTimeout(2000);

    // 재생 시작
    const bigPlay = page.locator(".svpBigPlay");
    if (await bigPlay.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bigPlay.click();
      await page.waitForTimeout(1500);
    }

    // 현재 시간 기록
    const timeBefore = await video.evaluate((v: HTMLVideoElement) => v.currentTime);

    // +10초 앞으로 클릭
    const fwdBtn = page.locator('.svpExtBtn[aria-label="10초 앞으로"]');
    await fwdBtn.click();
    await page.waitForTimeout(500);

    const timeAfter = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
    // 10초 앞으로 이동했는지 확인 (오차 허용)
    expect(timeAfter - timeBefore).toBeGreaterThanOrEqual(8);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-skip-forward-works.png`, fullPage: false });
  });

  test("배속 pill 클릭으로 배속 변경", async ({ page }) => {
    await navigateToVideo(page);

    const video = page.locator("video.svpVideo");
    await video.waitFor({ state: "attached", timeout: 10000 });

    // 재생 시작
    const bigPlay = page.locator(".svpBigPlay");
    if (await bigPlay.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bigPlay.click();
      await page.waitForTimeout(1000);
    }

    // 1.5x pill 클릭
    const pill15 = page.locator(".svpExtSpeedPill").filter({ hasText: "1.5x" });
    await pill15.click();
    await page.waitForTimeout(500);

    // 활성 pill 확인
    const activePill = page.locator(".svpExtSpeedPill--active");
    await expect(activePill).toHaveText("1.5x");

    // 실제 playbackRate 확인
    const rate = await video.evaluate((v: HTMLVideoElement) => v.playbackRate);
    expect(rate).toBeCloseTo(1.5, 1);

    // 2x pill 클릭
    const pill2 = page.locator(".svpExtSpeedPill").filter({ hasText: "2x" });
    await pill2.click();
    await page.waitForTimeout(500);

    const rate2 = await video.evaluate((v: HTMLVideoElement) => v.playbackRate);
    expect(rate2).toBeCloseTo(2, 1);

    // 1x로 복귀
    const pill1 = page.locator(".svpExtSpeedPill").filter({ hasText: "1x" });
    await pill1.click();
    await page.waitForTimeout(500);

    const rate3 = await video.evaluate((v: HTMLVideoElement) => v.playbackRate);
    expect(rate3).toBeCloseTo(1, 1);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-speed-change-works.png`, fullPage: false });
  });

  test("극장 모드 토글", async ({ page }) => {
    await navigateToVideo(page);
    await page.waitForTimeout(2000);

    // 극장 버튼 클릭
    const theaterBtn = page.locator("button.svpExtTheater");
    await theaterBtn.click();
    await page.waitForTimeout(500);

    // svpTheater 클래스 활성 확인
    const root = page.locator(".svpRoot");
    await expect(root).toHaveClass(/svpTheater/);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-theater-mode-on.png`, fullPage: false });

    // 다시 클릭 → 비활성
    await theaterBtn.click();
    await page.waitForTimeout(500);
    await expect(root).not.toHaveClass(/svpTheater/);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-theater-mode-off.png`, fullPage: false });
  });

  test("모바일 뷰포트에서 외부 컨트롤바 레이아웃", async ({ page }) => {
    // 모바일 뷰포트 설정
    await page.setViewportSize({ width: 375, height: 812 });
    await navigateToVideo(page);

    const extBar = page.locator(".svpExtBar");
    await expect(extBar).toBeVisible({ timeout: 10000 });

    // 배속 pill이 여전히 보이는지
    const speedPills = extBar.locator("button.svpExtSpeedPill");
    const pillCount = await speedPills.count();
    expect(pillCount).toBeGreaterThanOrEqual(3);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/07-mobile-layout.png`, fullPage: false });
  });
});
