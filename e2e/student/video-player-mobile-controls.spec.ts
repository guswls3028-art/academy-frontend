import { expect, test } from "../fixtures/strictTest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const playerCss = readFileSync(resolve("src/app_student/domains/video/playback/player/player.css"), "utf8");
const uiCss = readFileSync(resolve("src/app_student/domains/video/playback/player/design/ui.css"), "utf8");

type MobileProfile = {
  name: string;
  viewport: { width: number; height: number };
  userAgent: string;
  deviceScaleFactor: number;
};

const profiles: MobileProfile[] = [
  {
    name: "Galaxy Samsung Internet",
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 3,
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36",
  },
  {
    name: "Android Chrome",
    viewport: { width: 393, height: 851 },
    deviceScaleFactor: 2.75,
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
  },
  {
    name: "iPhone Safari",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  },
  {
    name: "iPhone SE Safari",
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  },
];

function iconButton(icon: string, label: string, extraClass = "") {
  return `
    <button type="button" class="svpBtn svpBtn--${icon} ${extraClass}" data-svp-icon="${icon}" aria-label="${label}" title="${label}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4z" /></svg>
    </button>
  `;
}

function renderPlayerFixture() {
  return `
    <!doctype html>
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          *, *::before, *::after { box-sizing: border-box; }
          body { margin: 0; background: #f8fafc; }
          ${uiCss}
          ${playerCss}
        </style>
      </head>
      <body>
        <main class="vpp-root">
          <section class="vpp-player-section">
            <div class="svpRoot">
              <div class="svpLayout">
                <div class="svpPlayerCol">
                  <div class="svpPlayerWrap">
                    <div class="svpTopBar">
                      <div class="svpTopLeft">
                        <div class="svpTitle">모바일 전체화면 버튼 검증용 영상</div>
                      </div>
                      <div class="svpTopRight">
                        <div class="svpPills">
                          <span class="svpPill">복습 모드</span>
                        </div>
                        ${iconButton("fullscreen", "전체화면", "svpFullscreenTopButton")}
                        <button type="button" class="svpBtn svpBtnKebab" aria-label="메뉴"><span class="svpBtnIcon">⋮</span></button>
                      </div>
                    </div>
                    <div class="svpVideoStage">
                      <video class="svpVideo"></video>
                      <div class="svpControls">
                        <div class="svpProgressRow">
                          <input class="svpRange" type="range" min="0" max="100" value="33" aria-label="진행 바" />
                          <div class="svpTime"><span>0:33</span><span>/</span><span>2:00</span></div>
                        </div>
                        <div class="svpControlRow">
                          <div class="svpLeftControls">
                            ${iconButton("play", "재생")}
                            ${iconButton("replay10", "-10초")}
                            ${iconButton("forward10", "+10초")}
                            <div class="svpVolume">
                              ${iconButton("volume", "음소거")}
                              <div class="svpVolumeSlider"><input class="svpRange" type="range" min="0" max="1" value="1" /></div>
                            </div>
                          </div>
                          <div class="svpRightControls">
                            <button type="button" class="svpSpeedBtn svpQualityBtn svpSpeedBtn--disabled" disabled>Auto</button>
                            <button type="button" class="svpSpeedBtn svpPlaybackRateBtn">1x</button>
                            ${iconButton("fullscreen", "전체화면", "svpFullscreenButton")}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <aside class="svpSide"></aside>
              </div>
            </div>
          </section>
        </main>
      </body>
    </html>
  `;
}

for (const profile of profiles) {
  test(`student video fullscreen control is visible on ${profile.name}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: profile.viewport,
      userAgent: profile.userAgent,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: profile.deviceScaleFactor,
    });
    const page = await context.newPage();

    await page.setContent(renderPlayerFixture());
    const fullscreenButton = page.locator(".svpControls .svpBtn--fullscreen");

    await expect(fullscreenButton).toBeVisible();

    const metrics = await page.evaluate(() => {
      const wrap = document.querySelector<HTMLElement>(".svpPlayerWrap");
      const controls = document.querySelector<HTMLElement>(".svpControls");
      const row = document.querySelector<HTMLElement>(".svpControlRow");
      const bottomButton = document.querySelector<HTMLElement>(".svpControls .svpBtn--fullscreen");
      const topButton = document.querySelector<HTMLElement>(".svpFullscreenTopButton");
      const qualityButton = document.querySelector<HTMLElement>(".svpQualityBtn");

      if (!wrap || !controls || !row || !bottomButton || !topButton || !qualityButton) {
        throw new Error("player fixture missing expected elements");
      }

      const wrapRect = wrap.getBoundingClientRect();
      const controlsRect = controls.getBoundingClientRect();
      const bottomRect = bottomButton.getBoundingClientRect();
      const topRect = topButton.getBoundingClientRect();

      return {
        bottomButtonWithinPlayer:
          bottomRect.left >= wrapRect.left &&
          bottomRect.right <= wrapRect.right + 0.5 &&
          bottomRect.bottom <= wrapRect.bottom + 0.5,
        bottomButtonWithinControls:
          bottomRect.left >= controlsRect.left &&
          bottomRect.right <= controlsRect.right + 0.5 &&
          bottomRect.bottom <= controlsRect.bottom + 0.5,
        rowFits: row.scrollWidth <= row.clientWidth + 1,
        topButtonVisible: window.getComputedStyle(topButton).display !== "none" && topRect.width > 0 && topRect.height > 0,
        qualityButtonHidden: window.getComputedStyle(qualityButton).display === "none",
      };
    });

    expect(metrics.bottomButtonWithinPlayer).toBe(true);
    expect(metrics.bottomButtonWithinControls).toBe(true);
    expect(metrics.rowFits).toBe(true);
    expect(metrics.topButtonVisible).toBe(true);
    expect(metrics.qualityButtonHidden).toBe(true);

    await context.close();
  });
}
