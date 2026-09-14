import assert from 'node:assert/strict';
import test from 'node:test';
import { harness, settle } from './helpers/playback-lifecycle-harness.mjs';

for (const kind of ['hls', 'youtube']) {
  test(`${kind}: hard unload during review transition closes the captured old grant before its pending event flush`, async () => {
    let release;
    const h = harness({ respond: async (request) => {
      if (request.path.endsWith('/events/')) await new Promise((resolve) => { release = resolve; });
      return { status: 200, body: { ok: true } };
    } });
    const controller = h.controller(kind);
    controller.queueEvent('FULLSCREEN_ENTER', {});
    controller.setPolicy({ access_mode: 'FREE_REVIEW', monitoring_enabled: false, allow_seek: true });
    controller.setToken('signed-review');
    await settle();
    h.pagehide(false);
    await settle();
    assert.deepEqual(h.requests.filter((r) => r.path.endsWith('/end/')).map((r) => [r.body.token, r.keepalive]), [
      ['signed-playback-a', true],
    ]);
    release();
    await settle();
    controller.dispose();
    await settle();
    assert.equal(h.requests.filter((r) => r.path.endsWith('/end/')).length, 1);
  });
  test(`${kind}: confirmed review updates policy without disposing media and ends only the old monitored token`, async () => {
    const h = harness();
    const controller = h.controller(kind);
    controller.setPolicy({ access_mode: 'FREE_REVIEW', monitoring_enabled: false,
      allow_seek: true, seek: { mode: 'free' } });
    controller.setToken('signed-review');
    await settle();
    assert.equal(controller.disposed, false);
    assert.equal(controller.policy.allow_seek, true);
    assert.equal(controller.policy.monitoring_enabled, false);
    assert.deepEqual(h.requests.map((r) => [r.path, r.body.token]), [
      ['/api/v1/media/playback/end/', 'signed-playback-a'],
    ]);
    controller.queueEvent('SEEK_ATTEMPT', { target: 500 });
    assert.equal(controller.eventQueue.length, 0);
    controller.dispose();
    h.pagehide(false);
    await settle();
    assert.equal(h.requests.length, 1);
  });
}

test('HLS seeking listener reads the newly confirmed policy, not the first-watch closure', () => {
  const h = harness();
  const controller = h.controller('hls');
  const el = new EventTarget();
  Object.assign(el, { currentTime: 10, duration: 600, playbackRate: 1 });
  controller.el = el;
  controller.policy = { access_mode: 'PROCTORED_CLASS', monitoring_enabled: true,
    allow_seek: true, seek: { mode: 'budgeted_forward', grace_seconds: 3 } };
  controller.maxWatchedRef = 10;
  controller.bindVideoEvents();
  el.currentTime = 500;
  el.dispatchEvent(new Event('seeking'));
  assert.equal(el.currentTime, 13);
  controller.setPolicy({ access_mode: 'FREE_REVIEW', monitoring_enabled: false,
    allow_seek: true, seek: { mode: 'free' } });
  el.currentTime = 500;
  el.dispatchEvent(new Event('seeking'));
  assert.equal(el.currentTime, 500);
});
