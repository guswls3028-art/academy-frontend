import type { Locator, Page, TestInfo } from "@playwright/test";
import { expect } from "../fixtures/strictTest";
import { syntheticLongVideoAsset } from "../../scripts/run-development-release-canary.mjs";

type GestureRateAuditWindow = Window & { __qaGestureRateWrites: number[] };

type GestureScenario = {
  page: Page;
  info: TestInfo;
  speedLocked: boolean;
  base: string;
  viewport?: { width: number; height: number };
  installScenario: (page: Page) => Promise<{ videos: Array<Record<string, unknown>> }>;
  openPlayer: (page: Page) => Promise<void>;
};

async function openMonitoredHlsPlayer({ page, speedLocked, base, viewport, installScenario, openPlayer }: Omit<GestureScenario, "info">) {
  await page.setViewportSize(viewport ?? { width: 390, height: 844 });
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
  const writes = () => page.evaluate(() => (window as GestureRateAuditWindow).__qaGestureRateWrites);
  const clearWrites = () => page.evaluate(() => { (window as GestureRateAuditWindow).__qaGestureRateWrites = []; });
  return { video, state, writes, clearWrites };
}

export async function verifyMonitoredHlsGestures(scenario: GestureScenario) {
  const { page, info, speedLocked } = scenario;
  await page.clock.install();
  const { video, state, writes, clearWrites } = await openMonitoredHlsPlayer(scenario);
  const layer = page.locator(".svpGestureLayer");
  const box = (await layer.boundingBox())!;
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const right = { x: box.x + box.width * 0.75, y: center.y };
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


type FullscreenAuditWindow = Window & { __qaFullscreenInputs: Array<{
  type: string; trusted: boolean; pointerType: string; label: string;
}>; __qaFullscreenTransitions: boolean[] };

export async function verifyFullscreenControls(scenario: GestureScenario) {
  const { page, info } = scenario;
  await page.clock.install();
  await page.addInitScript(() => {
    const audit = window as FullscreenAuditWindow;
    audit.__qaFullscreenInputs = [];
    audit.__qaFullscreenTransitions = [];
    let previousFullscreen = false;
    new MutationObserver(() => {
      const active = !!document.querySelector(".svpPlayerWrap--fullscreen");
      if (active !== previousFullscreen) {
        previousFullscreen = active;
        audit.__qaFullscreenTransitions.push(active);
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["class"] });
    for (const type of ["pointerdown", "pointerup", "pointercancel", "click"]) {
      document.addEventListener(type, event => {
        const target = event.target instanceof Element ? event.target.closest("button") : null;
        audit.__qaFullscreenInputs.push({ type, trusted: event.isTrusted,
          pointerType: event instanceof PointerEvent ? event.pointerType : "",
          label: target?.getAttribute("aria-label") ?? "" });
      }, true);
    }
  });
  const { video, state, writes, clearWrites } = await openMonitoredHlsPlayer(scenario);
  await clearWrites();
  const wrap = page.locator(".svpPlayerWrap");
  const guide = page.getByRole("dialog", { name: "학생·학부모 가이드북", exact: true });
  const audit = () => page.evaluate(() => (window as FullscreenAuditWindow).__qaFullscreenInputs);
  const revealControls = async () => {
    if (await wrap.evaluate(node => node.classList.contains("svpPlayerWrap--controlsHidden"))) {
      const box = (await page.locator(".svpGestureLayer").boundingBox())!;
      await page.touchscreen.tap(box.x + box.width * 0.15, box.y + box.height / 2);
      await expect(wrap).not.toHaveClass(/svpPlayerWrap--controlsHidden/);
    }
  };
  const assertPlaying = async () => {
    const current = await video.evaluate((el: HTMLVideoElement) => el.currentTime);
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeGreaterThan(current);
    await expect(guide).toHaveCount(0);
  };
  let expectedPairs = 0;
  const verifyFocusedShortcuts = async (button: Locator) => {
    // Retain the fullscreen button focus that follows click/Enter/Space activation.
    await button.focus();
    await expect(button).toBeFocused();
    await page.keyboard.press("k");
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);
    const muted = await video.evaluate((el: HTMLVideoElement) => el.muted);
    await page.keyboard.press("m");
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.muted)).toBe(!muted);
    await page.keyboard.press("m");
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.muted)).toBe(muted);
    const playerRoot = page.locator(".svpRoot");
    await page.keyboard.press("t");
    await expect(playerRoot).toHaveClass(/svpTheater/);
    await page.keyboard.press("t");
    await expect(playerRoot).not.toHaveClass(/svpTheater/);
    await page.keyboard.press("f");
    await expect(wrap).toHaveClass(/svpPlayerWrap--fullscreen/);
    await button.focus();
    await page.keyboard.press("f");
    await expect(wrap).not.toHaveClass(/svpPlayerWrap--fullscreen/);
    expectedPairs++;
    // This fixture already allows free seek. Use the production shortcuts only;
    // never write currentTime directly or unlock a blocked policy for the test.
    const progress = page.getByRole("slider", { name: "진행 바", exact: true });
    for (const [key, delta] of [["l", 10], ["j", -10], ["ArrowRight", 5], ["ArrowLeft", -5]] as const) {
      await button.focus();
      await expect(button).toBeFocused();
      const before = await video.evaluate((el: HTMLVideoElement) => el.currentTime);
      await page.keyboard.press(key);
      const expected = Math.max(0, before + delta);
      await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeCloseTo(expected, 0);
      await expect.poll(async () => Number(await progress.inputValue())).toBeCloseTo(expected, 0);
    }
    await button.focus();
    await page.keyboard.press("k");
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(false);
    await assertPlaying();
  };
  const chromium = page.context().browser()?.browserType().name() === "chromium";
  const cdp = chromium ? await page.context().newCDPSession(page) : null;
  const layout = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    touchLayout: matchMedia("(max-width: 768px), (hover: none)").matches,
    hoverNone: matchMedia("(hover: none)").matches,
    topDisplay: getComputedStyle(document.querySelector(".svpFullscreenTopButton")!).display,
  }));
  const selectors = layout.touchLayout ? [".svpFullscreenTopButton", ".svpControls .svpFullscreenButton"]
    : [".svpControls .svpFullscreenButton"];
  if (layout.touchLayout) await expect(page.locator(".svpFullscreenTopButton")).toBeVisible();
  else await expect(page.locator(".svpFullscreenTopButton")).toBeHidden();
  const observations: unknown[] = [];
  const observe = async (stage: string) => {
    observations.push({ stage, state: { ...state, events: [...state.events] }, dom: await page.evaluate(() => {
      const media = document.querySelector("video.svpVideo") as HTMLVideoElement;
      return { at: performance.now(), wrapClass: document.querySelector(".svpPlayerWrap")?.className,
        fullscreen: document.fullscreenElement?.className ?? null, currentTime: media.currentTime, paused: media.paused,
        inputs: (window as FullscreenAuditWindow).__qaFullscreenInputs,
        transitions: (window as FullscreenAuditWindow).__qaFullscreenTransitions };
    }) });
  };
  try {
    for (const selector of selectors) {
      const button = page.locator(selector);
      await revealControls();
      // CDP provides trusted touchCancel/move; ordinary taps below also run in other engines.
      if (cdp) {
        for (const cancelledBy of ["cancel", "drag"]) {
          const box = (await button.boundingBox())!;
          const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
          await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
          await observe(`${selector}/${cancelledBy}/down`);
          // Activation must not begin at pointerdown, before cancellation or release.
          await expect(wrap).not.toHaveClass(/svpPlayerWrap--fullscreen/);
          if (cancelledBy === "cancel") {
            await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
          } else {
            await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...point, x: point.x - 90 }] });
            await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
          }
          await observe(`${selector}/${cancelledBy}/released`);
          await expect(wrap).not.toHaveClass(/svpPlayerWrap--fullscreen/);
          await assertPlaying();
        }
      }
      for (const input of ["touch", "mouse", "Enter", "Space"] as const) {
        const activate = async () => {
          await revealControls();
          if (input === "touch") await button.tap();
          else if (input === "mouse") await button.click();
          else {
            await button.focus();
            await page.keyboard.press(input);
          }
        };
        // Freeze only JS timers: trusted touch and native fullscreen remain real.
        // Exit before the old 350ms watchdog, then cross that boundary explicitly.
        const rapidTouch = input === "touch";
        if (rapidTouch) await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
        try {
          await activate();
          await observe(`${selector}/${input}/enter`);
          await expect(wrap).toHaveClass(/svpPlayerWrap--fullscreen/);
          if (rapidTouch && chromium) {
            await expect.poll(() => page.evaluate(() => document.fullscreenElement?.classList.contains("svpPlayerWrap") ?? false)).toBe(true);
          }
          await expect(button).toHaveAttribute("aria-label", "전체화면 종료");
          await activate();
          await observe(`${selector}/${input}/exit`);
          await expect(wrap).not.toHaveClass(/svpPlayerWrap--fullscreen/);
          await expect(button).toHaveAttribute("aria-label", "전체화면");
          if (rapidTouch) {
            const before = await page.evaluate(() => (window as FullscreenAuditWindow).__qaFullscreenTransitions);
            await page.clock.runFor(351);
            await expect(wrap).not.toHaveClass(/svpPlayerWrap--fullscreen/);
            expect(await page.evaluate(() => (window as FullscreenAuditWindow).__qaFullscreenTransitions)).toEqual(before);
            await observe(`${selector}/touch/past-350ms`);
          }
        } finally {
          if (rapidTouch) await page.clock.resume();
        }
        expectedPairs++;
        if (input !== "touch") await verifyFocusedShortcuts(button);
        await assertPlaying();
        expect((await audit()).filter(event => event.type === "click" && event.label === "가이드북")).toEqual([]);
      }
    }
  } finally {
    await observe("fullscreen-loop-finally");
    await info.attach("fullscreen-layout-input-observations", { contentType: "application/json", body: JSON.stringify({ layout, observations }) });
    await cdp?.detach();
  }
  const fullscreenEvents = () => state.events.filter(event => event.type.startsWith("FULLSCREEN_"));
  await expect.poll(() => fullscreenEvents().filter(event => event.type === "FULLSCREEN_ENTER").length).toBeGreaterThanOrEqual(expectedPairs);
  await expect.poll(() => fullscreenEvents().filter(event => event.type === "FULLSCREEN_EXIT").length).toBeGreaterThanOrEqual(expectedPairs);
  const transitions = await page.evaluate(() => (window as FullscreenAuditWindow).__qaFullscreenTransitions);
  expect(transitions).toEqual(Array.from({ length: expectedPairs }, () => [true, false]).flat());
  expect(state.events.filter(event => /ATTEMPT|PLAYER_ERROR/.test(event.type))).toEqual([]);
  expect(state.active).toBe(true);
  expect(state.grants).toBe(1);
  expect(state.receipts).toBeGreaterThan(0);
  expect(await writes()).toEqual([]);
  const inputs = await audit();
  expect(inputs.filter(event => event.type === "pointerdown" && event.pointerType === "touch").length).toBeGreaterThanOrEqual(selectors.length * 2);
  expect(inputs.every(event => event.trusted)).toBe(true);
  if (chromium) expect(inputs.filter(event => event.type === "pointercancel").length).toBeGreaterThanOrEqual(selectors.length);
  // A deliberate guide tap must still open the real popup after fullscreen exit.
  await page.getByRole("button", { name: "가이드북", exact: true }).tap();
  await expect(guide).toBeVisible();
  await info.attach("fullscreen-intentional-guide", { contentType: "image/png", body: await page.screenshot() });
  await guide.getByRole("button", { name: "가이드북 닫기", exact: true }).tap();
  await assertPlaying();
  await info.attach("fullscreen-pointer-monitoring", { contentType: "application/json", body: JSON.stringify({
    ...state, expectedPairs, transitions, trustedCancelEngine: chromium ? "chromium" : null, inputs: await audit(), rateWrites: await writes(),
  }) });
  await info.attach("fullscreen-pointer-return", { contentType: "image/png", body: await page.screenshot() });
}
