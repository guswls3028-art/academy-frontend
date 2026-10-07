import type { VideoCommentItem } from "../../src/app_student/domains/video/api/video.api";
import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { guardUnmockedYouTubeRequests, installYouTubeSdkFixture } from "../helpers/youtubeSdkFixture";
import { installStudentYoutubeScenario, YOUTUBE_QA_VIDEO_ID } from "../helpers/studentYoutubeScenario";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const FIRST_TITLE = "통합과학 1강 · 원리를 연결하는 아주 긴 제목의 복습 영상";
const SECOND_TITLE = "통합과학 2강 · 적용 문제 해설";

async function installWatchScenario(page: Page, completed = false) {
  const vendorRequests = await guardUnmockedYouTubeRequests(page);
  const youtube = await installYouTubeSdkFixture(page);
  await installStudentYoutubeScenario(page);
  const state = { commentsFail: false, playlistFail: false, likeFail: false, liked: false,
    comments: [{ id: 701, content: "수업에서 이해한 개념을 다시 확인했습니다.", author_type: "student",
      author_name: "합성 학생", author_photo_url: null, is_edited: false, is_deleted: false,
      is_mine: true, created_at: "2026-10-01T03:00:00Z", reply_count: 0, replies: [] }] as VideoCommentItem[],
    progress: [] as Array<{ videoId: number; body: Record<string, unknown> }>,
  };
  const videos = [562, 563].map((id) => ({ id, session_id: 394, enrollment_id: 1304,
    title: id === 562 ? FIRST_TITLE : SECOND_TITLE, status: "READY", source_type: "youtube",
    youtube_video_id: YOUTUBE_QA_VIDEO_ID, duration: 600, progress: completed && id === 562 ? 100 : 0,
    completed: completed && id === 562, last_position: completed && id === 562 ? 30 : 0,
    allow_skip: true, max_speed: 2, show_watermark: false, access_mode: "FREE_REVIEW",
  }));
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({ json: body, status });
    if (path === "/student/video/sessions/394/videos/") {
      return state.playlistFail ? json({ detail: "합성 목록 조회 실패" }, 503) : json({
        session: { id: 394, title: "개념과 적용", order: 1 }, items: videos,
      });
    }
    const playback = path.match(/^\/student\/video\/videos\/(562|563)\/playback\/$/);
    if (playback) {
      if (url.searchParams.get("access_check") === "1") return json({
        ok: true, access_mode: "FREE_REVIEW", monitoring_enabled: false, policy_version: 1,
      });
      const video = videos.find((item) => item.id === Number(playback[1]))!;
      return json({ video: { ...video, is_liked: state.liked, like_count: state.liked ? 1 : 0,
        comment_count: state.comments.length, view_count: 12 },
        play_url: `https://www.youtube.com/embed/${YOUTUBE_QA_VIDEO_ID}`,
        playback_token: `synthetic-watch-${video.id}`, playback_session_id: null,
        playback_expires_at: Math.floor(Date.now() / 1000) + 900, policy_version: 1,
        policy: { access_mode: "FREE_REVIEW", monitoring_enabled: false, allow_seek: true,
          playback_rate: { max: 2, ui_control: true },
          source: { type: "youtube", provider: "youtube", youtube_video_id: YOUTUBE_QA_VIDEO_ID } },
      });
    }
    if (/^\/student\/video\/videos\/(562|563)\/comments\/$/.test(path)) {
      if (request.method() === "POST") {
        const body = request.postDataJSON();
        const comment = { ...state.comments[0], id: 702 + state.comments.length, content: body.content };
        state.comments.push(comment);
        return json(comment, 201);
      }
      return state.commentsFail ? json({ detail: "합성 댓글 조회 실패" }, 503)
        : json({ comments: state.comments, total: state.comments.length });
    }
    if (/^\/student\/video\/videos\/(562|563)\/like\/$/.test(path)) {
      if (state.likeFail) return json({ detail: "합성 좋아요 저장 실패" }, 503);
      state.liked = !state.liked;
      return json({ liked: state.liked, like_count: state.liked ? 1 : 0 });
    }
    const progress = path.match(/^\/student\/video\/videos\/(562|563)\/progress\/$/);
    if (progress) {
      const body = request.postDataJSON();
      state.progress.push({ videoId: Number(progress[1]), body });
      return json({ id: 1, video_id: Number(progress[1]), enrollment_id: 1304, ...body,
        progress_percent: body.progress });
    }
    return route.fallback();
  });
  return { state, youtube, vendorRequests, videos };
}

async function openWatch(page: Page) {
  await page.goto(`${BASE}/student/video/play?video=562&enrollment=1304&session=394`);
  await expect(page.getByRole("heading", { name: FIRST_TITLE })).toBeVisible();
  await expect(page.getByText("재생 화면을 준비하고 있어요…")).toHaveCount(0);
}

test.use({ serviceWorkers: "block" });
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "Closed local route-mock only");

for (const width of [1366, 390]) {
  test(`watch actions, comments and playlist remain discoverable at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const { vendorRequests } = await installWatchScenario(page);
    await openWatch(page);
    await expect(page.getByRole("button", { name: "좋아요", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "댓글", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(SECOND_TITLE) })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`watch-${width}.png`), fullPage: true });
    const like = page.getByRole("button", { name: "좋아요", exact: true });
    await expect(like).toHaveCSS("min-height", "44px");
    expect(await like.evaluate((button) => getComputedStyle(button).backgroundImage)).not.toBe("none");
    const next = page.getByRole("link", { name: "다음 항목", exact: true });
    expect(await next.evaluate((link) => {
      const style = getComputedStyle(link);
      return style.color !== style.backgroundColor && style.color !== "rgb(15, 23, 42)";
    })).toBe(true);
    await page.getByRole("button", { name: "재생목록 닫기", exact: true }).click();
    await expect(page.locator("#video-playlist")).toBeHidden();
    await expect(page.getByRole("link", { name: new RegExp(SECOND_TITLE) })).toHaveCount(0);
    await page.getByRole("button", { name: "재생목록 열기", exact: true }).click();
    await expect(page.getByRole("link", { name: new RegExp(SECOND_TITLE) })).toBeVisible();
    await page.getByRole("button", { name: "댓글 보기", exact: true }).click();
    await expect(page.locator("#video-comments")).toBeFocused();
    await expect(page.getByRole("heading", { name: "댓글", exact: true })).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`comments-${width}.png`), fullPage: true });
    expect(vendorRequests).toEqual([]);
  });

  test(`next video returns to the session list at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installWatchScenario(page);
    await openWatch(page);
    await page.getByRole("link", { name: "다음 항목", exact: true }).click();
    await expect(page.getByRole("heading", { name: SECOND_TITLE })).toBeVisible();
    await page.getByRole("button", { name: "목록으로", exact: true }).click();
    await expect(page).toHaveURL(new RegExp("/student/video/sessions/394\\?enrollment=1304$"));
    await expect(page.getByRole("link", { name: new RegExp(FIRST_TITLE) })).toBeVisible();
  });
}

test("replaying a completed lesson does not auto-advance on background progress save", async ({ page }) => {
  const { state, youtube } = await installWatchScenario(page, true);
  await openWatch(page);
  await expect.poll(async () => (await youtube.snapshot()).players.some((player) => player.ready)).toBe(true);
  await page.evaluate(() => {
    const previous = Object.getOwnPropertyDescriptor(document, "hidden");
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
    if (previous) Object.defineProperty(document, "hidden", previous);
    else Reflect.deleteProperty(document, "hidden");
  });
  await expect.poll(() => state.progress.length).toBeGreaterThan(0);
  // Observe past the five-second automatic-next delay, without finishing this replay.
  // eslint-disable-next-line no-restricted-syntax -- Observe beyond the full automatic-next delay to prove no navigation.
  await page.waitForTimeout(6_000);
  expect(new URL(page.url()).searchParams.get("video")).toBe("562");
  await expect(page.getByRole("heading", { name: FIRST_TITLE })).toBeVisible();
});

test("playlist request failure is visible and retry restores next-video navigation", async ({ page }) => {
  const { state } = await installWatchScenario(page);
  state.playlistFail = true;
  await openWatch(page);
  await expect(page.getByText("재생목록을 불러오지 못했습니다.", { exact: true })).toBeVisible();
  state.playlistFail = false;
  await page.getByRole("button", { name: "재생목록 다시 불러오기" }).click();
  await expect(page.getByRole("link", { name: "다음 항목", exact: true })).toBeVisible();
});

test("comment failure is not presented as zero and retry preserves the draft", async ({ page }) => {
  const { state } = await installWatchScenario(page);
  state.commentsFail = true;
  await openWatch(page);
  await expect(page.getByText("댓글을 불러오지 못했습니다.", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("아직 댓글이 없습니다. 첫 댓글을 남겨보세요.")).toHaveCount(0);
  await page.getByPlaceholder("댓글을 입력하세요...").fill("새로 읽으며 작성한 댓글");
  state.commentsFail = false;
  await page.getByRole("button", { name: "댓글 다시 불러오기" }).click();
  await expect(page.getByText(state.comments[0].content, { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("댓글을 입력하세요...")).toHaveValue("새로 읽으며 작성한 댓글");
  await page.getByRole("button", { name: "등록", exact: true }).click();
  await expect(page.getByText("새로 읽으며 작성한 댓글", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("새로 읽으며 작성한 댓글", { exact: true })).toBeVisible();
});

test("like failure rolls back visibly and a retry persists through reload", async ({ page }) => {
  const { state } = await installWatchScenario(page);
  state.likeFail = true;
  await openWatch(page);
  await page.getByRole("button", { name: "좋아요", exact: true }).click();
  await expect(page.getByText("좋아요를 저장하지 못했습니다. 다시 시도해 주세요.", { exact: true })).toBeVisible();
  await expect(page.locator(".vpp-like-btn")).toHaveAttribute("aria-pressed", "false");
  state.likeFail = false;
  await page.locator(".vpp-like-btn").click();
  await expect(page.locator(".vpp-like-btn")).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.locator(".vpp-like-btn")).toHaveAttribute("aria-pressed", "true");
});


test("a new playback end saves completion immediately, supports cancel, and advances after a later end", async ({ page }) => {
  const { state, youtube } = await installWatchScenario(page);
  await openWatch(page);
  await expect.poll(async () => (await youtube.snapshot()).players.some((player) => player.ready)).toBe(true);
  await youtube.finish();
  await expect.poll(() => state.progress.some((entry) => entry.videoId === 562 && entry.body.completed === true)).toBe(true);
  await page.getByRole("button", { name: /다음 항목.*취소/ }).click();
  // eslint-disable-next-line no-restricted-syntax -- Observe beyond the full automatic-next delay to prove no navigation.
  await page.waitForTimeout(6_000);
  await expect(page.getByRole("heading", { name: FIRST_TITLE })).toBeVisible();
  await youtube.finish();
  await expect(page.getByRole("heading", { name: SECOND_TITLE })).toBeVisible({ timeout: 10_000 });
});

test("deleting the root preserves an existing teacher reply without showing deleted content", async ({ page }) => {
  const { state } = await installWatchScenario(page);
  state.comments[0] = { ...state.comments[0], is_deleted: true, content: "숨겨야 하는 삭제 내용", reply_count: 1,
    replies: [{ ...state.comments[0], id: 702, author_type: "teacher", author_name: "합성 선생님",
      is_mine: false, content: "기존 선생님 답변은 계속 읽을 수 있습니다.", replies: [] }] };
  await openWatch(page);
  await expect(page.getByText("삭제된 댓글입니다.", { exact: true })).toBeVisible();
  await expect(page.getByText("숨겨야 하는 삭제 내용", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "답글 1개", exact: true }).click();
  await expect(page.getByText("기존 선생님 답변은 계속 읽을 수 있습니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "답글", exact: true })).toHaveCount(0);
});

for (const width of [1366, 390]) {
  test(`a long playlist keeps its last video reachable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const { videos } = await installWatchScenario(page);
    for (let index = 0; index < 16; index++) videos.push({ ...videos[1], id: 600 + index, title: `추가 강의 ${index + 1}` });
    await openWatch(page);
    const last = page.getByRole("link", { name: /추가 강의 16/ });
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    const box = await last.boundingBox();
    expect(box).not.toBeNull();
    expect(await last.evaluate((link) => {
      const box = link.getBoundingClientRect();
      return link.contains(document.elementFromPoint(box.left + box.width / 2, box.bottom - 3));
    })).toBe(true);
  });
}
