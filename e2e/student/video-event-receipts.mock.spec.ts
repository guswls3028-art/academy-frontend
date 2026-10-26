import { expect, test } from "../fixtures/strictTest";
import { guardUnmockedYouTubeRequests, installYouTubeSdkFixture } from "../helpers/youtubeSdkFixture";
import { installStudentYoutubeScenario, openStudentYoutubeScenario, YOUTUBE_QA_TITLE, YOUTUBE_QA_VIDEO_ID } from "../helpers/studentYoutubeScenario";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
type EventBatch = { batch_id: string; events: Array<{ type: string; occurred_at: number; payload: object }> };

for (const width of [390, 1366]) for (const role of ["student", "parent"]) {
  test(`v2 ${role} ${width}: normal playback, retained SPA retry and confirmed final records`, async ({ page }, testInfo) => {
    expect(["localhost", "127.0.0.1"]).toContain(new URL(BASE).hostname);
    await page.setViewportSize({ width, height: 900 });
    const unexpected = await guardUnmockedYouTubeRequests(page);
    const youtube = await installYouTubeSdkFixture(page);
    await installStudentYoutubeScenario(page);
    let accepting = false;
    let grants = 0;
    const receipts = new Map<string, EventBatch>();
    const bodies: Array<{ token: string; batch?: EventBatch; batches?: EventBatch[] }> = [];
    const headers: Array<string | undefined> = [];
    let finalized = false;
    await page.route("**/api/v1/core/me/", (route) => route.fulfill({ json: {
      id: 1772, username: "synthetic-receipt-owner", name: "합성 사용자", is_staff: false, is_superuser: false,
      tenantRole: role, must_change_password: false,
      ...(role === "parent" ? { linkedStudents: [{ id: 41, name: "합성 자녀" }] } : {}),
    } }));
    await page.route("**/api/v1/student/video/videos/562/playback/**", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: {
        ok: true, access_mode: "PROCTORED_CLASS", monitoring_enabled: true, policy_version: 1,
      } });
      expect(route.request().postDataJSON()).toEqual({ event_protocol_version: 2 });
      grants++;
      return route.fulfill({ json: {
        video: { id: 562, session_id: 394, enrollment_id: 1304, title: YOUTUBE_QA_TITLE,
          status: "READY", source_type: "youtube", youtube_video_id: YOUTUBE_QA_VIDEO_ID,
          duration: 600, progress: 0, last_position: 0, completed: false },
        play_url: `https://www.youtube.com/embed/${YOUTUBE_QA_VIDEO_ID}`,
        playback_token: "signed-local-receipt-token", playback_session_id: "local-receipt-session",
        playback_expires_at: Math.floor(Date.now() / 1000) + 600, event_protocol_version: 2, policy_version: 1,
        policy: { access_mode: "PROCTORED_CLASS", monitoring_enabled: true, allow_seek: true,
          playback_rate: { max: 1, ui_control: true }, source: { type: "youtube", youtube_video_id: YOUTUBE_QA_VIDEO_ID } },
      } });
    });
    await page.route("**/api/v1/media/playback/v2/**", (route) => {
      const body = route.request().postDataJSON() as typeof bodies[number];
      bodies.push(body);
      headers.push(route.request().headers()["x-student-id"]);
      const batches = body.batches ?? [body.batch!];
      let inserted = 0;
      const acknowledgements = batches.map((batch) => {
        const previous = receipts.get(batch.batch_id);
        if (previous) expect(batch).toEqual(previous);
        else { receipts.set(batch.batch_id, batch); inserted += batch.events.length; }
        return { batch_id: batch.batch_id, event_count: batch.events.length, duplicate: !!previous };
      });
      // Model a committed batch whose acknowledgement was lost at transport.
      // No successful response is fabricated until the visible retry is enabled.
      if (!accepting) return route.fulfill({ status: 503, json: { detail: "synthetic_ack_unavailable" } });
      finalized ||= Array.isArray(body.batches);
      return route.fulfill({ status: body.batches ? 200 : 201, json: {
        protocol_version: 2, session_status: finalized ? "ENDED" : "ACTIVE",
        inserted_count: inserted, acknowledgements,
      } });
    });
    await openStudentYoutubeScenario(page, BASE);
    await expect(page.getByText("재생 화면을 준비하고 있어요…")).toHaveCount(0);
    await expect(page.locator("[data-youtube-sdk-fixture]")).toBeVisible();
    await expect.poll(async () => (await youtube.snapshot()).players.some((player) => !player.destroyed && player.ready)).toBe(true);
    await page.getByRole("button", { name: "재생", exact: true }).click();
    await expect.poll(async () => (await youtube.snapshot()).players.some((player) => !player.destroyed && player.state === 1)).toBe(true);
    // Genuine focus events exercise the production controller queue, not a test-only save API.
    await page.evaluate(() => { window.dispatchEvent(new Event("blur")); window.dispatchEvent(new Event("focus")); });
    const notice = page.getByRole("status", { name: "시청 기록 저장" });
    await expect(notice).toContainText("저장을 확인하지 못했어요");
    expect(finalized).toBe(false);
    await page.getByRole("button", { name: "목록으로", exact: true }).click();
    await expect(page).not.toHaveURL(/\/video\/play/);
    await expect(notice).toContainText("저장을 확인하지 못했어요");
    await expect(notice.getByRole("button", { name: "저장 다시 시도" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`receipt-${role}-${width}-pending.png`), fullPage: true });
    const beforeRetry = bodies.length;
    accepting = true;
    await notice.getByRole("button", { name: "저장 다시 시도" }).click();
    await expect.poll(() => finalized).toBe(true);
    await expect(notice).toHaveCount(0);
    expect(bodies.length).toBeGreaterThan(beforeRetry);
    expect([...receipts.values()].flatMap((batch) => batch.events).map((event) => event.type)).toEqual(expect.arrayContaining(["FOCUS_LOST", "FOCUS_GAINED"]));
    expect(headers.every((id) => role === "parent" ? id === "41" : id === undefined)).toBe(true);
    const storedBeforeReload = JSON.stringify([...receipts]);
    await page.reload();
    await expect(page.getByRole("status", { name: "시청 기록 저장" })).toHaveCount(0);
    expect(JSON.stringify([...receipts])).toBe(storedBeforeReload);
    expect(grants).toBeGreaterThan(0);
    expect(unexpected).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
