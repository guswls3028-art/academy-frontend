import assert from 'node:assert/strict';
import test from 'node:test';
import { harness, settle } from './helpers/playback-lifecycle-harness.mjs';

test('native HLS restores playback after a network error and saves the resumed position', async () => {
  const h = harness();
  const saved = [];
  const errors = [];
  const controller = h.controller('hls', 'student-fixture', {
    playUrl: 'https://unit.invalid/master.m3u8', policy: { monitoring_enabled: false },
    onFatal: (error) => errors.push(error), onLeaveProgress: (progress) => saved.push(progress),
  });
  let loads = 0;
  const el = Object.assign(new EventTarget(), {
    currentTime: 0, duration: 600, readyState: 4, HAVE_FUTURE_DATA: 3,
    paused: true, playbackRate: 1, volume: 0.5, muted: false, error: null,
    canPlayType: () => 'probably',
    async play() { this.paused = false; this.dispatchEvent(new Event('play')); },
    pause() { this.paused = true; },
    removeAttribute() {},
    load() { loads++; this.currentTime = 0; this.error = null; },
  });
  await controller.attach(el);
  el.dispatchEvent(new Event('loadedmetadata'));
  await el.play();
  el.currentTime = 123;
  el.dispatchEvent(new Event('timeupdate'));
  el.error = { code: 2 };
  el.paused = true;
  el.dispatchEvent(new Event('error'));
  assert.equal(loads, 1);
  assert.equal(controller.getState().reconnecting, true);
  assert.deepEqual(errors, []);

  el.dispatchEvent(new Event('loadedmetadata'));
  assert.equal(el.currentTime, 123);
  assert.equal(el.paused, false);
  el.currentTime = 124;
  el.dispatchEvent(new Event('timeupdate'));
  h.fireTimers();
  assert.equal(controller.getState().reconnecting, false);
  assert.deepEqual(errors, []);

  el.error = { code: 2 };
  el.dispatchEvent(new Event('error'));
  h.fireTimers();
  assert.equal(loads, 2, 'a second source load is not attempted when the retry itself stalls');
  assert.equal(errors.length, 1);
  controller.dispose();
  assert.equal(saved.at(-1)?.last_position, 124);
});

test('a native source error that clears media metadata does not erase the saved playhead', async () => {
  const h = harness();
  const saved = [];
  const errors = [];
  const controller = h.controller('hls', 'student-fixture', {
    playUrl: 'https://unit.invalid/master.m3u8', policy: { monitoring_enabled: false },
    onFatal: (error) => errors.push(error), onLeaveProgress: (progress) => saved.push(progress),
  });
  const el = Object.assign(new EventTarget(), {
    currentTime: 0, duration: 600, paused: true, playbackRate: 1, error: null,
    canPlayType: () => 'probably', pause() {}, removeAttribute() {}, load() {},
  });
  await controller.attach(el);
  el.dispatchEvent(new Event('loadedmetadata'));
  el.currentTime = 123;
  el.dispatchEvent(new Event('timeupdate'));
  Object.assign(el, { currentTime: 0, duration: NaN, error: { code: 4 } });
  el.dispatchEvent(new Event('error'));
  assert.equal(errors.length, 1);
  controller.dispose();
  assert.equal(saved.at(-1)?.last_position, 123);
  assert.equal(saved.at(-1)?.completed, false);
});

for (const kind of ['hls', 'youtube']) {
  test(`${kind}: completed replay progress and disposal never announce a new playback end`, async () => {
    const h = harness();
    const controller = h.controller(kind);
    const saved = [];
    let ended = 0;
    Object.assign(controller.opts, { initialProgress: 100,
      onLeaveProgress: (value) => saved.push(value), onEnded: () => ended++ });
    if (kind === 'hls') {
      controller.el = Object.assign(new EventTarget(), { currentTime: 30, duration: 600, playbackRate: 1,
        pause() {}, removeAttribute() {}, load() {} });
    } else {
      controller.player = { getCurrentTime: () => 30, getDuration: () => 600, destroy() {} };
    }
    controller.maxWatchedRef = 30;
    h.document.hidden = true;
    h.document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(saved.at(-1).completed, true);
    assert.equal(saved.at(-1).last_position, 30);
    assert.equal(ended, 0);
    controller.dispose();
    await settle();
    assert.equal(ended, 0);
  });

  test(`${kind}: actual media end immediately saves completion and announces next-video eligibility`, async () => {
    const h = harness();
    const controller = h.controller(kind);
    const saved = [];
    let ended = 0;
    Object.assign(controller.opts, { onLeaveProgress: (value) => saved.push(value), onEnded: () => ended++ });
    let el;
    if (kind === 'hls') {
      el = Object.assign(new EventTarget(), { currentTime: 600, duration: 600, playbackRate: 1,
        pause() {}, removeAttribute() {}, load() {} });
      controller.el = el;
      controller.bindVideoEvents();
      el.dispatchEvent(new Event('ended'));
    } else {
      controller.player = { getCurrentTime: () => 600, getDuration: () => 600, destroy() {} };
      controller.onStateChange(0);
    }
    assert.equal(saved.at(-1)?.completed, true);
    assert.equal(saved.at(-1)?.last_position, 600);
    assert.equal(ended, 1);
    controller.dispose();
    await settle();
    if (kind === 'hls') el.dispatchEvent(new Event('ended'));
    else controller.onStateChange(0);
    assert.equal(ended, 1, 'disposed playback must never advance the next video');
  });
}
