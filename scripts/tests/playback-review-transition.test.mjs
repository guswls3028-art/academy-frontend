import assert from 'node:assert/strict';
import test from 'node:test';
import { harness, settle } from './helpers/playback-lifecycle-harness.mjs';

for (const kind of ['hls', 'youtube']) {
  test(`${kind}: v2 review keeps the old receipt token through a failed final acknowledgement and retry`, async () => {
    let accepting = false;
    const h = harness({ respond: async (request) => {
      if (!accepting) return { status: 503, body: { detail: 'ack unavailable' } };
      return { status: 200, body: { protocol_version: 2, session_status: 'ENDED', inserted_count: 0,
        acknowledgements: request.body.batches.map((batch) => ({ batch_id: batch.batch_id,
          event_count: batch.events.length, duplicate: true })) } };
    } });
    const expiresAt = Math.floor(Date.now() / 1000) + 600;
    const controller = h.controller(kind, 'signed-playback-a', { eventProtocolVersion: 2,
      sessionId: 'first-watch', expiresAt });
    controller.queueEvent('FULLSCREEN_ENTER', {});
    controller.setPolicy({ access_mode: 'FREE_REVIEW', monitoring_enabled: false, allow_seek: true });
    controller.setToken('signed-review', expiresAt + 600);
    await settle();
    assert.equal(controller.disposed, false);
    const receipts = h.load('src/app_student/domains/video/playback/player/headless/playbackEventBatches.ts');
    assert.equal(receipts.getPlaybackSaveSnapshot()[0].state, 'retry');
    accepting = true;
    receipts.retryPlaybackSaves();
    await settle();
    assert.equal(h.requests.length, 2);
    assert.ok(h.requests.every((r) => r.path.endsWith('/v2/end/') && r.body.token === 'signed-playback-a'));
    assert.deepEqual(h.requests[0].body.batches, h.requests[1].body.batches);
    assert.equal(receipts.getPlaybackSaveSnapshot().length, 0);
    controller.dispose();
  });
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
