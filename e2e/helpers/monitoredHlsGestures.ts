import type { Page, TestInfo } from "@playwright/test";
import { expect } from "../fixtures/strictTest";
import { syntheticLongVideoAsset } from "../../scripts/run-development-release-canary.mjs";

type GestureRateAuditWindow = Window & { __qaGestureRateWrites: number[] };

type GestureScenario = {
  page: Page;
  info: TestInfo;
  speedLocked: boolean;
  base: string;
  installScenario: (page: Page) => Promise<{ videos: Array<Record<string, unknown>> }>;
  openPlayer: (page: Page) => Promise<void>;
};

export async function verifyMonitoredHlsGestures({ page, info, speedLocked, base, installScenario, openPlayer }: GestureScenario) {
  await page.clock.install();
  await page.setViewportSize({ width: 390, height: 844 });
  const { videos } = await installScenario(page);
  // Observe native rate writes without replacing playback or controller methods.
  await page.addInitScript(() => {
    const audit = window as GestureRateAuditWindow;
    audit.__qaGestureRateWrites = [];
    const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "playbackRate")!;
    Object.defineProperty(HTMLMediaElement.prototype, "playbackRate", {
      ...descriptor,
      set(this: HTMLMediaElement, value: number) {
        audit.__qaGestureRateWrites.push(value);
        descriptor.set!.call(this, value);
      },
    });
  });
  const state = { grants: 0, active: true, receipts: 0, events: [] as Array<{ type: string }> };
  const received = new Set<string>();
  await page.route("**/__qa__/video-long/**", route => {
    const asset = syntheticLongVideoAsset(new URL(route.request().url()).pathname);
    return route.fulfill({ body: asset.body, contentType: asset.contentType });
  });
  await page.route("**/api/v1/student/video/videos/562/playback/**", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: {
      ok: true, access_mode: "PROCTORED_CLASS", monitoring_enabled: true, policy_version: 1,
    } });
    state.grants++;
    return route.fulfill({ json: {
      video: { ...videos[0], source_type: "s3", youtube_video_id: null, access_mode: "PROCTORED_CLASS" },
      play_url: `${base}/__qa__/video-long/master.m3u8`,
      playback_token: "synthetic-gesture-token", playback_session_id: "synthetic-gesture-session",
      playback_expires_at: Math.floor(Date.now() / 1000) + 900, event_protocol_version: 2, policy_version: 1,
      policy: { access_mode: "PROCTORED_CLASS", monitoring_enabled: true, allow_seek: true,
        playback_rate: { max: speedLocked ? 1 : 2, ui_control: true }, source: { type: "s3", provider: "uploaded" } },
    } });
  });
  await page.route("**/api/v1/media/playback/v2/**", route => {
    const body = route.request().postDataJSON() as {
      token: string; batch?: { batch_id: string; events: Array<{ type: string }> };
      batches?: Array<{ batch_id: string; events: Array<{ type: string }> }>;
    };
    expect(body.token).toBe("synthetic-gesture-token");
    if (!state.active) return route.fulfill({ status: 409, json: { detail: "session_inactive" } });
    let inserted = 0;
    const acknowledgements = (body.batches ?? [body.batch!]).map(batch => {
      const duplicate = received.has(batch.batch_id);
      if (!duplicate) {
        received.add(batch.batch_id);
        state.events.push(...batch.events);
        inserted += batch.events.length;
      }
      return { batch_id: batch.batch_id, event_count: batch.events.length, duplicate };
    });
    state.receipts++;
    // Retain the offending event and ACK it; the next request sees revocation.
    if (state.events.some(event => event.type === "SPEED_CHANGE_ATTEMPT")) state.active = false;
    return route.fulfill({ status: body.batches ? 200 : 201, json: {
      protocol_version: 2, session_status: body.batches ? "ENDED" : "ACTIVE", inserted_count: inserted, acknowledgements,
    } });
  });
  await openPlayer(page);
  await page.locator("button.svpBigPlay").click();
  const video = page.locator("video.svpVideo");
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeGreaterThan(0);
  const layer = page.locator(".svpGestureLayer");
  const box = (await layer.boundingBox())!;
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const right = { x: box.x + box.width * 0.75, y: center.y };
  const writes = () => page.evaluate(() => (window as GestureRateAuditWindow).__qaGestureRateWrites);
  const clearWrites = () => page.evaluate(() => { (window as GestureRateAuditWindow).__qaGestureRateWrites = []; });
  const cancel = () => layer.dispatchEvent("pointercancel", { pointerId: 1, pointerType: "mouse", clientX: right.x, clientY: right.y });
  await clearWrites();
  if (speedLocked) {
    await page.mouse.click(center.x, center.y);
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);
    const pausedAt = await video.evaluate((el: HTMLVideoElement) => el.currentTime);
    await page.mouse.click(center.x, center.y);
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeGreaterThan(pausedAt);
  } else {
    await page.locator(".svpPlaybackRateBtn").click();
    await page.locator(".svpSpeedMenuItem").filter({ hasText: /^1\.5(?:0)?x$/ }).click();
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.playbackRate)).toBe(1.5);
    await clearWrites();
  }
  // Pause before pointer down, then run every callback past the cancelled 500ms deadline.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
  try {
    await page.mouse.move(right.x, right.y);
    await page.mouse.down();
    await cancel();
    await page.mouse.up();
    await cancel();
    await page.clock.runFor(501);
  } finally {
    await page.clock.resume();
  }
  if (!speedLocked) {
    expect(await writes()).toEqual([]);
    await page.mouse.down();
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.playbackRate)).toBe(2);
    await page.mouse.up();
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.playbackRate)).toBe(1.5);
    await cancel();
    await layer.dispatchEvent("pointerup", { pointerId: 1, pointerType: "mouse", clientX: right.x, clientY: right.y });
    expect(await writes()).toEqual([2, 1.5]);
    await page.mouse.down();
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.playbackRate)).toBe(2);
    await cancel();
    await page.mouse.up();
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.playbackRate)).toBe(1.5);
    await cancel();
    expect(await writes()).toEqual([2, 1.5, 2, 1.5]);
  }
  // Require an acknowledged monitoring batch so absence is not a disabled queue.
  await page.evaluate(() => { window.dispatchEvent(new Event("blur")); window.dispatchEvent(new Event("focus")); });
  await expect.poll(() => state.events.some(event => event.type === "FOCUS_GAINED")).toBe(true);
  await info.attach("gesture-monitoring", { contentType: "application/json", body: JSON.stringify({ ...state, rateWrites: await writes() }) });
  expect(state.events.filter(event => event.type === "SPEED_CHANGE_ATTEMPT")).toEqual([]);
  if (speedLocked) expect(await writes()).toEqual([]);
  expect(state.receipts).toBeGreaterThan(0);
  expect(state.active).toBe(true);
  expect(state.grants).toBe(1);
  await expect(page).toHaveURL(/student\/video\/play/);
  await expect(page.getByText("재생 세션이 종료되었습니다.", { exact: true })).toHaveCount(0);
  const current = await video.evaluate((el: HTMLVideoElement) => el.currentTime);
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeGreaterThan(current);
}
