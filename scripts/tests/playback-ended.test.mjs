import assert from 'node:assert/strict';
import test from 'node:test';
import { harness, settle } from './helpers/playback-lifecycle-harness.mjs';

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
