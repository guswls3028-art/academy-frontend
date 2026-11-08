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
  const inputTargets: unknown[] = [];
  const chooseGesturePoint = async (fraction: number) => {
    const target = await layer.evaluate((node, fraction) => {
      const box = node.getBoundingClientRect();
      const read = (y: number) => {
        const x = box.x + box.width * fraction;
        const hit = document.elementFromPoint(x, y);
        return { x, y, ownsLayer: !!hit && node.contains(hit), hitClass: hit?.getAttribute("class"),
          hitLabel: hit?.closest("button, input")?.getAttribute("aria-label") };
      };
      return { fraction, legacy: read(box.y + box.height / 2), exposed: [0.5, 0.2, 0.8, 0.1, 0.9]
        .map(ratio => read(box.y + box.height * ratio)).find(point => point.ownsLayer) };
    }, fraction);
    inputTargets.push(target);
    await info.attach("gesture-input-targets", { contentType: "application/json", body: JSON.stringify(inputTargets) });
    expect(target.exposed, `${fraction} zone has an exposed gesture target`).toBeDefined();
    return target.exposed!;
  };
  let right = await chooseGesturePoint(0.75);
  const clickCenter = async () => {
    const center = await chooseGesturePoint(0.5);
    await page.mouse.click(center.x, center.y);
  };
  const moveToRight = async () => {
    right = await chooseGesturePoint(0.75);
    await page.mouse.move(right.x, right.y);
  };
  const cancel = () => layer.dispatchEvent("pointercancel", { pointerId: 1, pointerType: "mouse", clientX: right.x, clientY: right.y });
  await clearWrites();
  if (speedLocked) {
    await clickCenter();
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);
    const pausedAt = await video.evaluate((el: HTMLVideoElement) => el.currentTime);
    await clickCenter();
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
    await moveToRight();
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
    await moveToRight();
    await page.mouse.down();
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.playbackRate)).toBe(2);
    await page.mouse.up();
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.playbackRate)).toBe(1.5);
    await cancel();
    await layer.dispatchEvent("pointerup", { pointerId: 1, pointerType: "mouse", clientX: right.x, clientY: right.y });
    expect(await writes()).toEqual([2, 1.5]);
    await moveToRight();
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
  // iOS WebKit uses native video fullscreen; this regression requires Chromium's native wrapper.
  if (!speedLocked && page.context().browser()?.browserType().name() === "chromium") {
    const receiptsBefore = state.receipts, eventsBefore = state.events.length;
    try {
      await verifyActiveSpeedFullscreenMenus(page, info, video);
      await expect.poll(() => state.receipts).toBeGreaterThan(receiptsBefore);
      for (const type of ["FULLSCREEN_ENTER", "FULLSCREEN_EXIT"]) {
        await expect.poll(() => state.events.slice(eventsBefore).filter(event => event.type === type).length).toBeGreaterThanOrEqual(2);
      }
      expect(state.events.filter(event => /ATTEMPT|PLAYER_ERROR/.test(event.type))).toEqual([]);
      expect(state.active).toBe(true);
      expect(state.grants).toBe(1);
      expect(await writes()).toEqual([2, 1.5, 2, 1.5, 1, 2, 1.5, 1, 2, 1.5]);
    } finally {
      await info.attach("active-speed-menu-monitoring", { contentType: "application/json", body: JSON.stringify({ ...state, rateWrites: await writes() }) });
    }
  }
}


async function verifyActiveSpeedFullscreenMenus(page: Page, info: TestInfo, video: Locator) {
  const wrap = page.locator(".svpPlayerWrap");
  const controls = page.locator(".svpControls");
  const speed = controls.locator(".svpPlaybackRateBtn");
  const menu = page.locator(".svpSpeedMenu");
  const originalMedia = await video.elementHandle();
  const observations: unknown[] = [];
  const revealControls = async (advanceGestureClock = false) => {
    if (await wrap.evaluate(node => node.classList.contains("svpPlayerWrap--controlsHidden"))) {
      const layer = page.locator(".svpGestureLayer");
      const point = await layer.evaluate(node => {
        const r = node.getBoundingClientRect(), x = r.left + r.width * 0.15, y = r.top + r.height / 2;
        const hit = document.elementFromPoint(x, y);
        return { x, y, owned: !!hit && node.contains(hit) };
      });
      expect(point.owned).toBe(true);
      await page.mouse.click(point.x, point.y);
      if (advanceGestureClock) await page.clock.runFor(351);
      await expect(wrap).not.toHaveClass(/svpPlayerWrap--controlsHidden/);
    }
    await expect(controls).toHaveCSS("opacity", "1");
  };
  const clickOwned = async (target: Locator, revealAfterHide?: () => Promise<void>) => {
    const sample = () => target.evaluate(node => {
      const r = node.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      return {
        owned: !!hit && node.contains(hit),
        controlsHidden: !!node.closest(".svpPlayerWrap--controlsHidden"),
        hitTag: hit?.tagName,
        hitClass: hit?.getAttribute("class"),
      };
    });
    let point = await sample();
    // The existing hide deadline can fire between revealing the controls and sampling the button.
    if (!point.owned && point.controlsHidden && revealAfterHide) {
      await revealAfterHide();
      point = await sample();
    }
    expect(point.owned, `menu input belongs to its visible target (hit: ${point.hitTag ?? "none"} ${point.hitClass ?? ""})`).toBe(true);
    await target.click();
  };
  const assertRate = async (rate: number) => {
    await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.playbackRate)).toBe(rate);
    await expect(speed).toHaveText(rate % 1 === 0 ? `${rate}x` : `${rate.toFixed(2)}x`);
  };
  const openMenu = async (width: number, phase: string, native: boolean) => {
    await revealControls();
    await expect(speed).toBeEnabled();
    await clickOwned(speed, revealControls);
    await expect(menu).toBeVisible();
    const geometry = await menu.evaluate(node => {
      const fullscreen = document.fullscreenElement;
      return { parent: node.parentElement?.tagName, insideFullscreen: !!fullscreen && fullscreen.contains(node),
        fullscreenClass: fullscreen?.className ?? null,
        items: Array.from(node.querySelectorAll("button")).map(button => {
          const { left, top, width, height } = button.getBoundingClientRect();
          return { label: button.textContent?.trim(), rect: { left, top, width, height },
            hits: [0.25, 0.5, 0.75].map(fraction => {
              const x = left + width * fraction, y = top + height / 2, hit = document.elementFromPoint(x, y);
              return { x, y, owned: !!hit && button.contains(hit), hitClass: hit?.getAttribute("class") };
            }) };
        }) };
    });
    observations.push({ width, phase, ...geometry });
    if (phase === "native-selection") {
      await info.attach(`active-speed-menu-native-${width}`, { contentType: "image/png", body: await page.screenshot() });
    }
    expect(geometry.insideFullscreen).toBe(native);
    if (!native) expect(geometry.parent).toBe("BODY");
    expect(geometry.items.length).toBeGreaterThan(1);
    for (const item of geometry.items) {
      expect(item.hits.every(hit => hit.owned), `${phase}/${item.label}: 25/50/75% menu hits`).toBe(true);
    }
  };
  const selectRate = async (rate: number) => {
    await clickOwned(menu.locator(".svpSpeedMenuItem").filter({ has: page.getByText(`${rate}x`, { exact: true }) }));
    await expect(menu).toHaveCount(0);
    await assertRate(rate);
  };
  const closeOutside = async () => {
    const rate = await video.evaluate((node: HTMLVideoElement) => node.playbackRate);
    const point = await wrap.evaluate(node => {
      const r = node.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + 2;
      const hit = document.elementFromPoint(x, y);
      return { x, y, safe: !!hit && node.contains(hit) && !hit.closest("button, input, a, .svpSpeedMenu, .svpGestureLayer") };
    });
    expect(point.safe, "outside click uses the player header without activating another control").toBe(true);
    await expect(menu).toHaveCount(1);
    await page.mouse.click(point.x, point.y);
    await expect(menu).toHaveCount(0);
    await assertRate(rate);
  };
  const toggleWhileOpen = async (native: boolean) => {
    await expect(menu).toHaveCount(1);
    await expect(speed).toBeFocused();
    // The keyboard shortcut changes actual fullscreen without an outside pointer closing the menu first.
    await page.keyboard.press("f");
    await expect.poll(() => wrap.evaluate((node, active) => active
      ? document.fullscreenElement === node : document.fullscreenElement === null, native)).toBe(true);
    if (native) await expect(wrap).toHaveClass(/svpPlayerWrap--fullscreen/);
    else await expect(wrap).not.toHaveClass(/svpPlayerWrap--fullscreen/);
    await expect(menu).toHaveCount(0);
  };
  try {
    for (const width of [390, 1366]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await openMenu(width, "normal-selection", false);
      await selectRate(1);
      await openMenu(width, "normal-outside-close", false);
      await closeOutside();
      if (width === 390) {
        // Enter near the old 3s deadline; check visibility before a later click can recover it.
        await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
        try {
          await page.clock.runFor(3_001);
          await expect(wrap).toHaveClass(/svpPlayerWrap--controlsHidden/);
          await revealControls(true);
          await page.clock.runFor(2_600);
          await expect(wrap).not.toHaveClass(/svpPlayerWrap--controlsHidden/);
          await openMenu(width, "before-native-enter", false);
          await toggleWhileOpen(true);
          await page.clock.runFor(500);
          await expect(wrap).not.toHaveClass(/svpPlayerWrap--controlsHidden/);
          await expect(controls).toHaveCSS("opacity", "1");
          observations.push({ width, phase: "native-past-previous-controls-deadline",
            gestureClockMs: 351, beforeEnterClockMs: 2_600, afterEnterClockMs: 500,
            fullscreen: await wrap.evaluate(node => document.fullscreenElement === node),
            controlsVisible: await controls.evaluate(node => getComputedStyle(node).opacity === "1") });
        } finally {
          await page.clock.resume();
        }
      } else {
        await openMenu(width, "before-native-enter", false);
        await toggleWhileOpen(true);
      }
      await openMenu(width, "native-selection", true);
      await selectRate(2);
      await openMenu(width, "native-outside-close", true);
      await closeOutside();
      await openMenu(width, "before-native-exit", true);
      await toggleWhileOpen(false);
      await openMenu(width, "normal-return-selection", false);
      await selectRate(1.5);
      expect(await video.evaluate((node, original) => node === original, originalMedia)).toBe(true);
      const current = await video.evaluate((node: HTMLVideoElement) => node.currentTime);
      await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(current);
      observations.push({ width, phase: "normal-return-playing", rate: await video.evaluate((node: HTMLVideoElement) => node.playbackRate) });
      await info.attach(`active-speed-menu-return-${width}`, { contentType: "image/png", body: await page.screenshot() });
    }
  } finally {
    await info.attach("active-speed-menu-observations", { contentType: "application/json", body: JSON.stringify(observations) });
    await originalMedia?.dispose();
  }
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
  // Check playing and paused controls without repeating fullscreen journeys.
  const controls = page.locator(".svpControls");
  const originalMedia = await video.elementHandle();
  const readRegions = () => wrap.evaluate(root => {
    const rect = (selector: string) => {
      const { left, top, right, bottom, width, height } = root.querySelector(selector)!.getBoundingClientRect();
      return { left, top, right, bottom, width, height };
    };
    return { stage: rect(".svpVideoStage"), media: rect(".svpVideo"), controls: rect(".svpControls"),
      viewport: { width: innerWidth, height: innerHeight }, scrollWidth: document.documentElement.scrollWidth };
  });
  const assertSeparatedRegions = async () => {
    const regions = await readRegions();
    expect(regions.stage.bottom).toBeLessThanOrEqual(regions.controls.top + 0.5);
    expect(regions.media.bottom).toBeLessThanOrEqual(regions.stage.bottom + 0.5);
    expect(regions.media.right).toBeLessThanOrEqual(regions.viewport.width + 0.5);
    expect(regions.controls.bottom).toBeLessThanOrEqual(regions.viewport.height + 0.5);
    expect(regions.scrollWidth).toBeLessThanOrEqual(regions.viewport.width + 0.5);
    expect(await video.evaluate((node, original) => node === original, originalMedia)).toBe(true);
    return regions;
  };
  const verifyGeometry = async (width: number, height: number, phase: "playing" | "paused") => {
    await revealControls();
    await expect(controls).toHaveCSS("opacity", "1");
    await expect(controls.locator(".svpVolume button")).toBeVisible();
    await expect(controls.locator(".svpQualityBtn")).toBeVisible();
    await expect(controls.locator(".svpQualityBtn")).toBeDisabled();
    const regions = await assertSeparatedRegions();
    expect(regions.media.width / regions.media.height).toBeCloseTo(16 / 9, 2);
    const targets = await wrap.evaluate(root => Array.from(root.querySelectorAll<HTMLButtonElement | HTMLInputElement>(".svpControls button, .svpControls input[type='range'], .svpBigPlay"))
      .filter(node => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden")
      .map(node => {
        const { left, top, right, bottom, width, height } = node.getBoundingClientRect();
        const hits = [0.25, 0.5, 0.75].map(fraction => {
          const x = left + width * fraction, y = top + height / 2;
          const hit = document.elementFromPoint(x, y);
          return { x, y, ownsTarget: !!hit && node.contains(hit),
            hitLabel: hit?.closest("button, input")?.getAttribute("aria-label") ?? hit?.tagName };
        });
        return { label: node.getAttribute("aria-label") ?? node.textContent?.trim(), disabled: node.disabled,
          rect: { left, top, right, bottom, width, height }, display: getComputedStyle(node).display,
          pointerEvents: getComputedStyle(node).pointerEvents, ownsCenter: hits[1].ownsTarget, hits };
      }));
    await info.attach(`player-control-geometry-${width}-${phase}`, { contentType: "application/json", body: JSON.stringify({ width, height, phase, regions, targets }) });
    await info.attach(`player-controls-${width}-${phase}`, { contentType: "image/png", body: await page.screenshot() });
    expect(targets.length).toBeGreaterThan(0);
    for (const [index, target] of targets.entries()) {
      const label = `${width}px ${phase} ${target.label}`;
      expect(target.rect.left, label).toBeGreaterThanOrEqual(-0.5);
      expect(target.rect.top, label).toBeGreaterThanOrEqual(-0.5);
      expect(target.rect.right, label).toBeLessThanOrEqual(width + 0.5);
      expect(target.rect.bottom, label).toBeLessThanOrEqual(height + 0.5);
      expect(target.hits.every(hit => hit.ownsTarget), `${label}: all sampled points belong to target`).toBe(true);
      for (const other of targets.slice(index + 1)) {
        const overlapX = Math.min(target.rect.right, other.rect.right) - Math.max(target.rect.left, other.rect.left);
        const overlapY = Math.min(target.rect.bottom, other.rect.bottom) - Math.max(target.rect.top, other.rect.top);
        expect(overlapX > 0.5 && overlapY > 0.5, `${label} overlaps ${other.label}`).toBe(false);
      }
    }
  };
  const assertPaused = (paused: boolean) => expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(paused);
  const progressSlider = controls.getByRole("slider", { name: "진행 바", exact: true });
  const controlPoint = async (target: Locator, fraction = 0.5) => {
    const read = () => target.evaluate((node, fraction) => {
      const rect = node.getBoundingClientRect();
      const x = rect.left + Math.max(1, rect.width * fraction), y = rect.top + rect.height / 2;
      return { x, y, ownsTarget: node.contains(document.elementFromPoint(x, y)),
        controlsHidden: node.closest(".svpPlayerWrap")!.classList.contains("svpPlayerWrap--controlsHidden") };
    }, fraction);
    const before = await read();
    let point = before;
    // Auto-hide can occur after the earlier visibility check. Reveal by real input only.
    if (!point.ownsTarget && point.controlsHidden) {
      await revealControls();
      await expect(controls).toHaveCSS("opacity", "1");
      point = await read();
    }
    await info.attach("control-input-readiness", { contentType: "application/json", body: JSON.stringify({ fraction, before, point }) });
    expect(point.ownsTarget, "normal control input owns its position").toBe(true);
    return point;
  };
  const clickControl = async (target: Locator, fraction = 0.5) => {
    await revealControls();
    await expect(controls).toHaveCSS("opacity", "1");
    await expect(target).toBeEnabled();
    const point = await controlPoint(target, fraction);
    await page.mouse.click(point.x, point.y);
  };
  for (const width of scenario.viewport?.width === 1366 ? [1100, 1366] : [390]) {
    const height = scenario.viewport?.height ?? 844;
    await page.setViewportSize({ width, height });
    const playPause = controls.locator(".svpLeftControls button").first();
    for (const phase of ["playing", "paused"] as const) {
      if (phase === "paused") await clickControl(playPause);
      await assertPaused(phase === "paused");
      await verifyGeometry(width, height, phase);
      const muted = await video.evaluate((node: HTMLVideoElement) => node.muted);
      for (const expected of [!muted, muted]) {
        await clickControl(controls.locator(".svpVolume button"));
        await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.muted)).toBe(expected);
        await assertPaused(phase === "paused");
      }
      // The fixture permits free seek. Use real range input, then restore near start.
      const duration = await video.evaluate((node: HTMLVideoElement) => node.duration);
      await clickControl(progressSlider, 0.75);
      await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(duration * 0.6);
      // currentTime changes before seek completion and the controlled thumb renders.
      await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.seeking)).toBe(false);
      await expect.poll(async () => Number(await progressSlider.inputValue())).toBeGreaterThan(duration * 0.6);
      await assertPaused(phase === "paused");
      await clickControl(progressSlider, 0);
      await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeLessThan(duration * 0.05);
      await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.seeking)).toBe(false);
      await expect.poll(async () => Number(await progressSlider.inputValue())).toBeLessThan(duration * 0.05);
      await assertPaused(phase === "paused");
    }
    await page.locator(".svpBigPlay").click();
    await assertPaused(false);
    await clickControl(playPause);
    await assertPaused(true);
    await clickControl(playPause);
    await assertPaused(false);
    const current = await video.evaluate((node: HTMLVideoElement) => node.currentTime);
    await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(current);
    await assertSeparatedRegions();
  }
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
          else if (input === "mouse") await clickControl(button);
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
          await assertSeparatedRegions();
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
