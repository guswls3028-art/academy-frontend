import type { Page } from "@playwright/test";
import { expect } from "../fixtures/strictTest";

export const YOUTUBE_QA_VIDEO_ID = "VnqgmOJaMGc";
export const YOUTUBE_QA_TITLE = "YouTube SDK 합성 재생 검증";

/** App data is synthetic and every API request is fulfilled locally, including progress. */
export async function installStudentYoutubeScenario(page: Page) {
  const token = `e30.${Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "limglish", user_id: 1772,
  })).toString("base64url")}.sig`;
  await page.addInitScript(({ token }) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", token);
    localStorage.setItem("tenant_code", "limglish");
    sessionStorage.setItem("tenantCode", "limglish");
  }, { token });

  const video = {
    id: 562, session_id: 394, enrollment_id: 1304, title: YOUTUBE_QA_TITLE,
    status: "READY", source_type: "youtube", youtube_video_id: YOUTUBE_QA_VIDEO_ID,
    duration: 600, progress: 0, completed: false, last_position: 0,
    allow_skip: true, max_speed: 1, show_watermark: false, access_mode: "PROCTORED_CLASS",
  };
  const requests: Array<{ method: string; path: string }> = [];
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    requests.push({ method: route.request().method(), path });
    const json = (body: unknown) => route.fulfill({ json: body });
    if (path === "/core/program/") return json({
      tenantCode: "limglish", display_name: "YouTube 합성 QA", ui_config: {}, feature_flags: {}, is_active: true,
    });
    if (path === "/core/me/") return json({
      id: 1772, username: "synthetic-youtube-student", name: "합성 학생", is_staff: false,
      is_superuser: false, tenantRole: "student", linkedStudentId: 1,
      linkedStudentName: "합성 학생", must_change_password: false,
    });
    if (path === "/student/video/videos/562/playback/") {
      if (url.searchParams.get("access_check") === "1") return json({
        ok: true, access_mode: "PROCTORED_CLASS", monitoring_enabled: true, policy_version: 1,
      });
      return json({
        video, play_url: `https://www.youtube.com/embed/${YOUTUBE_QA_VIDEO_ID}`,
        playback_token: "student-youtube-sdk-qa", playback_session_id: "synthetic-youtube-session",
        playback_expires_at: Math.floor(Date.now() / 1000) + 600, policy_version: 1,
        policy: {
          access_mode: "PROCTORED_CLASS", monitoring_enabled: true, allow_seek: true,
          playback_rate: { max: 1, ui_control: true },
          source: { type: "youtube", provider: "youtube", youtube_video_id: YOUTUBE_QA_VIDEO_ID },
        },
      });
    }
    if (path === "/student/video/sessions/394/videos/") return json({ items: [video] });
    if (path === "/student/video/videos/562/comments/") return json({ count: 0, results: [] });
    return json({});
  });
  return requests;
}

export async function openStudentYoutubeScenario(page: Page, base: string) {
  expect(["127.0.0.1", "localhost"], "Synthetic API tests require an owned local frontend").toContain(new URL(base).hostname);
  await page.goto(`${base.replace(/\/$/, "")}/student/video/play?video=562&enrollment=1304&session=394`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { name: YOUTUBE_QA_TITLE })).toBeVisible();
}

function clockSeconds(text: string | null) {
  return (text || "0").trim().split(":").reduce((seconds, part) => seconds * 60 + Number(part), 0);
}

/** UI duration/time/state come from the production controller's SDK callbacks/polling. */
export async function assertYoutubeReadyPlayPause(page: Page) {
  await expect(page.getByText("재생 화면을 준비하고 있어요…")).toHaveCount(0, { timeout: 30_000 });
  await expect.poll(async () => clockSeconds(await page.locator(".svpTimeDur").textContent()), { timeout: 30_000 }).toBeGreaterThan(0);
  const initial = clockSeconds(await page.locator(".svpTimeCur").textContent());
  await page.getByRole("button", { name: "재생", exact: true }).click();
  await expect(page.getByRole("button", { name: "일시정지", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => clockSeconds(await page.locator(".svpTimeCur").textContent()), { timeout: 30_000 }).toBeGreaterThan(initial + 1);
  // Playback auto-hides controls after 3s. Reveal them with the real side-tap
  // interaction before clicking pause; never force a click through the gesture layer.
  await expect(page.locator(".svpPlayerWrap")).toHaveClass(/svpPlayerWrap--controlsHidden/);
  await page.locator(".svpGestureLayer").click({ position: { x: 24, y: 24 } });
  await expect(page.locator(".svpPlayerWrap")).not.toHaveClass(/svpPlayerWrap--controlsHidden/);
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await expect(page.getByRole("button", { name: "재생", exact: true })).toBeVisible();
  // Observe more than two controller polling intervals; paused playback must not advance.
  await page.evaluate(() => new Promise<void>((resolve) => window.setTimeout(resolve, 600)));
  const paused = clockSeconds(await page.locator(".svpTimeCur").textContent());
  await page.evaluate(() => new Promise<void>((resolve) => window.setTimeout(resolve, 1200)));
  expect(clockSeconds(await page.locator(".svpTimeCur").textContent())).toBe(paused);
  return { initial, paused, duration: clockSeconds(await page.locator(".svpTimeDur").textContent()) };
}
