import { expect, test } from '../fixtures/strictTest';
import { guardUnmockedYouTubeRequests, installYouTubeSdkFixture } from '../helpers/youtubeSdkFixture';
import { installStudentYoutubeScenario, YOUTUBE_QA_VIDEO_ID } from '../helpers/studentYoutubeScenario';

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:5174';
test.describe('completed first watch remains playing in review', () => {
  test.skip(!['localhost', '127.0.0.1'].includes(new URL(BASE).hostname), 'Closed local API/SDK fixture only');
  test.use({ serviceWorkers: 'block' });

  for (const width of [390, 1366]) test(`review transition retains the playing SDK and seek controls at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const unexpected = await guardUnmockedYouTubeRequests(page);
    const youtube = await installYouTubeSdkFixture(page);
    await installStudentYoutubeScenario(page);
    let releaseAccess!: () => void;
    let releaseBootstrap!: () => void;
    const accessGate = new Promise<void>((resolve) => { releaseAccess = resolve; });
    const bootstrapGate = new Promise<void>((resolve) => { releaseBootstrap = resolve; });
    let bootstraps = 0;
    const ended: string[] = [];
    await page.route('**/api/v1/media/playback/end/', async (route) => {
      ended.push(route.request().postDataJSON().token);
      await route.fulfill({ json: { ok: true } });
    });
    await page.route('**/api/v1/student/video/videos/562/playback/**', async (route) => {
      if (new URL(route.request().url()).searchParams.get('access_check') === '1') {
        await accessGate;
        return route.fulfill({ json: { ok: true, access_mode: 'FREE_REVIEW', monitoring_enabled: false, policy_version: 1 } });
      }
      const review = ++bootstraps > 1;
      if (review) await bootstrapGate;
      return route.fulfill({ json: {
        video: { id: 562, session_id: 394, enrollment_id: 1304, title: 'YouTube 합성 재생 검증',
          status: 'READY', source_type: 'youtube', youtube_video_id: YOUTUBE_QA_VIDEO_ID,
          duration: 600, progress: review ? 100 : 0, completed: review, last_position: 0,
          allow_skip: false, max_speed: 1, show_watermark: false },
        play_url: `https://www.youtube.com/embed/${YOUTUBE_QA_VIDEO_ID}`,
        playback_token: review ? 'signed-review-token' : 'signed-monitored-token',
        playback_session_id: review ? null : 'monitored-session',
        playback_expires_at: Math.floor(Date.now() / 1000) + 3600, policy_version: 1,
        policy: { access_mode: review ? 'FREE_REVIEW' : 'PROCTORED_CLASS', monitoring_enabled: !review,
          allow_seek: true, seek: { mode: review ? 'free' : 'budgeted_forward', grace_seconds: 3 },
          playback_rate: { max: 1, ui_control: true },
          source: { type: 'youtube', youtube_video_id: YOUTUBE_QA_VIDEO_ID } },
      } });
    });
    // The SDK is a fixture; this proves renderer/lifecycle, not a physical phone or live API.
    await page.goto(`${BASE}/student/video/play?video=562&enrollment=1304&session=394`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await expect(page.getByRole('button', { name: '재생', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '재생', exact: true }).click();
    await expect.poll(async () => (await youtube.snapshot()).players[0]?.state).toBe(1);
    releaseAccess();
    await expect.poll(() => bootstraps).toBe(2);
    expect((await youtube.snapshot()).players[0]?.destroyed).toBe(false);
    await expect(page.getByRole('heading', { name: 'YouTube 합성 재생 검증' })).toBeVisible();
    releaseBootstrap();
    const slider = page.getByRole('slider', { name: '진행 바' });
    await expect.poll(() => ended).toEqual(['signed-monitored-token']);
    const snapshot = await youtube.snapshot();
    expect(snapshot.players).toHaveLength(1);
    expect(snapshot.players[0]).toMatchObject({ destroyed: false, state: 1 });
    await expect(page.locator('.svpPlayerWrap')).toHaveClass(/svpPlayerWrap--controlsHidden/);
    await page.locator('.svpGestureLayer').click({ position: { x: 24, y: 24 } });
    await expect(slider).toBeVisible();
    await expect(slider).toBeEnabled();
    const bounds = await slider.boundingBox();
    expect(bounds).not.toBeNull();
    await slider.click({ position: { x: bounds!.width * 0.8, y: bounds!.height / 2 } });
    await expect.poll(async () => (await youtube.snapshot()).players[0]?.current).toBeGreaterThan(400);
    await page.getByRole('button', { name: '일시정지', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(unexpected).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`review-${width}.png`) });
  });
});
