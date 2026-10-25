import assert from 'node:assert/strict';
import test from 'node:test';
import { harness, settle, token } from './helpers/playback-lifecycle-harness.mjs';

const modulePath = 'src/app_student/domains/video/playback/player/headless/playbackEventBatches.ts';

const options = () => ({ eventProtocolVersion: 2, sessionId: 'session-a', expiresAt: Math.floor(Date.now() / 1000) + 600 });
function receipt(request) {
  const batches = request.body.batches ?? [request.body.batch];
  return { status: request.path.endsWith('/end/') ? 200 : 201, body: {
    protocol_version: 2, session_status: request.path.endsWith('/end/') ? 'ENDED' : 'ACTIVE',
    inserted_count: batches.reduce((n, batch) => n + batch.events.length, 0),
    acknowledgements: batches.map((batch) => ({ batch_id: batch.batch_id, event_count: batch.events.length, duplicate: false })),
  } };
}

test('final overtakes an in-flight batch and carries the identical payload and UUID', async () => {
  let release;
  const h = harness({ respond: (request) => request.path.endsWith('/events/')
    ? new Promise((resolve) => { release = () => resolve(receipt(request)); }) : receipt(request) });
  const controller = h.controller('hls', 'signed-playback-a', options());
  controller.queueFullscreenEvent(true);
  const flush = controller.flushEvents(); await settle();
  h.pagehide(false); await settle();
  assert.deepEqual(h.requests[1].body.batches[0], h.requests[0].body.batch);
  assert.equal(h.requests[1].path, '/api/v1/media/playback/v2/end/');
  release(); await flush; await settle();
  assert.equal(h.load(modulePath).getPlaybackSaveSnapshot().length, 0);
});

test('unload over 200 events never sends a partial or legacy end; a live document can still drain and finalize', async () => {
  const h = harness({ respond: receipt }); const controller = h.controller('hls', 'signed-playback-a', options());
  for (let index = 0; index < 201; index++) controller.queueFullscreenEvent(true);
  h.pagehide(false); await settle();
  assert.equal(h.requests.length, 0);
  assert.equal(h.load(modulePath).getPlaybackSaveSnapshot()[0].state, 'retry');
  h.window.dispatchEvent(new Event('pageshow'));
  h.load(modulePath).retryPlaybackSaves(); await settle();
  assert.equal(h.requests.at(-1).path, '/api/v1/media/playback/v2/end/');
  assert.equal(h.load(modulePath).getPlaybackSaveSnapshot().length, 0);
});

test('renewal changes only token and expiry, not the unacknowledged batch', async () => {
  let fail = true;
  const h = harness({ respond: (request) => { if (fail) throw new TypeError('closed'); return receipt(request); } });
  const controller = h.controller('youtube', 'signed-playback-a', options());
  controller.queueFullscreenEvent(true); await controller.flushEvents();
  controller.setToken('signed-playback-renewed', options().expiresAt + 600);
  fail = false; await controller.flushEvents();
  assert.equal(h.requests[1].body.token, 'signed-playback-renewed');
  assert.deepEqual(h.requests[0].body.batch, h.requests[1].body.batch);
  controller.dispose(); await settle();
});

test('new session owns a separate queue; React synchronous reattachment preserves the same session', async () => {
  const h = harness({ respond: receipt });
  const first = h.controller('hls', 'signed-playback-a', options());
  first.queueFullscreenEvent(true); first.dispose();
  const reattached = h.controller('hls', 'signed-playback-a', options());
  await settle();
  assert.equal(h.requests.length, 0);
  reattached.queueFullscreenEvent(false);
  const next = h.controller('hls', 'signed-playback-b', { ...options(), sessionId: 'session-b' });
  next.queueFullscreenEvent(true);
  reattached.dispose(); next.dispose(); await settle();
  const ends = h.requests.filter((request) => request.path.endsWith('/end/'));
  assert.deepEqual(ends.map((request) => [request.body.token, request.body.batches.flatMap((batch) => batch.events).length]), [
    ['signed-playback-a', 2], ['signed-playback-b', 1],
  ]);
});

for (const change of ['generation', 'tenant', 'logout', 'support']) test(`${change} invalidation never sends old records under a different identity`, async () => {
  const h = harness({ respond: receipt, support: change === 'support' });
  const controller = h.controller('hls', 'signed-playback-a', options());
  controller.queueFullscreenEvent(true);
  if (change === 'generation') h.replaceEnvelope({ access: token(), refresh: 'other', generation: 'generation-b' });
  if (change === 'logout') h.replaceEnvelope(null);
  if (change === 'tenant') h.setTenant('different-tenant');
  if (change === 'support') h.setSupportSessionId('other-support-session');
  controller.dispose(); await settle(); h.fireTimers(30_000); await settle();
  assert.equal(h.requests.length, 0);
  assert.equal(h.load(modulePath).getPlaybackSaveSnapshot().length, 0);
});

test('parent child switch completes only the already-owned old child and does not show its notice to the new child', async () => {
  let fail = true;
  const h = harness({ parentId: 41, respond: (request) => { if (fail) throw new TypeError('closed'); return receipt(request); } });
  const controller = h.controller('hls', 'signed-playback-a', options());
  controller.queueFullscreenEvent(true); await controller.flushEvents();
  h.setParentId(42); h.load(modulePath).syncPlaybackSaveScope();
  assert.equal(h.load(modulePath).getPlaybackSaveSnapshot().length, 0);
  fail = false; controller.dispose(); await settle();
  assert.ok(h.requests.every((request) => request.headers.get('x-student-id') === '41'));
});

test('null child never inherits a new global child, even after asynchronous auth refresh', async () => {
  let completeRefresh;
  const h = harness({ expiresIn: 20, refresh: () => new Promise((resolve) => { completeRefresh = resolve; }), respond: receipt });
  const controller = h.controller('hls', 'signed-playback-a', options());
  controller.queueFullscreenEvent(true); const flush = controller.flushEvents(); await settle();
  h.setParentId(42);
  completeRefresh({ data: { access: token(), refresh: 'rotated' } }); await flush;
  assert.equal(h.requests[0].headers.get('x-student-id'), null);
  controller.dispose(); await settle();
});

for (const kind of ['missing', 'wrong-id', 'wrong-count', 'wrong-inserted', 'active-end']) {
  test(`malformed acknowledgement ${kind} retains all events and exposes retry`, async () => {
    let invalid = true;
    const h = harness({ respond: (request) => {
      const result = receipt(request);
      if (invalid) {
        if (kind === 'missing') result.body.acknowledgements = [];
        if (kind === 'wrong-id') result.body.acknowledgements[0].batch_id = 'wrong-id';
        if (kind === 'wrong-count') result.body.acknowledgements[0].event_count++;
        if (kind === 'wrong-inserted') result.body.inserted_count++;
        if (kind === 'active-end') result.body.session_status = 'ACTIVE';
      }
      return result;
    } });
    const controller = h.controller('hls', 'signed-playback-a', options());
    controller.queueFullscreenEvent(true); controller.dispose(); await settle();
    assert.deepEqual(Array.from(h.load(modulePath).getPlaybackSaveSnapshot(), (notice) => [notice.state, notice.count]), [['retry', 1]]);
    invalid = false; h.load(modulePath).retryPlaybackSaves(); await settle();
    assert.deepEqual(h.requests[0].body.batches, h.requests[1].body.batches);
    assert.equal(h.load(modulePath).getPlaybackSaveSnapshot().length, 0);
  });
}

test('soft memory pressure pauses only after many packets, then preserves all 3900 events through retry', async () => {
  let fail = true; let paused = 0;
  const h = harness({ respond: (request) => { if (fail) throw new TypeError('offline'); return receipt(request); } });
  const controller = h.controller('hls', 'signed-playback-a', options());
  controller.pause = () => { paused++; };
  for (let index = 0; index < 350; index++) controller.queueFullscreenEvent(true);
  assert.equal(paused, 0);
  for (let index = 350; index < 3900; index++) controller.queueFullscreenEvent(true);
  assert.ok(paused > 0);
  assert.equal(h.load(modulePath).getPlaybackSaveSnapshot()[0].state, 'capacity');
  fail = false; controller.dispose(); await settle();
  const unique = new Map(h.requests.flatMap((request) => request.body.batches ?? [request.body.batch]).map((batch) => [batch.batch_id, batch]));
  assert.equal([...unique.values()].reduce((n, batch) => n + batch.events.length, 0), 3900);
  assert.equal(h.requests.at(-1).path, '/api/v1/media/playback/v2/end/');
  assert.equal(h.load(modulePath).getPlaybackSaveSnapshot().length, 0);
});

test('real collection overflow drains retained data but cannot become a falsely complete end', async () => {
  const h = harness({ respond: receipt }); const controller = h.controller('hls', 'signed-playback-a', options());
  for (let index = 0; index < 4100; index++) controller.queueFullscreenEvent(true);
  assert.equal(h.load(modulePath).getPlaybackSaveSnapshot()[0].state, 'incomplete');
  controller.dispose(); await settle();
  assert.equal(h.requests.some((request) => request.path.endsWith('/end/')), false);
  assert.equal(h.requests.flatMap((request) => request.body.batch.events).length, 4096);
  assert.equal(h.load(modulePath).getPlaybackSaveSnapshot()[0].state, 'incomplete');
});

test('BFCache and other tabs remain independent; root layout disposal retries without its UI host', async () => {
  let fail = true;
  const h = harness({ respond: (request) => { if (fail) throw new TypeError('offline'); return receipt(request); } });
  const sibling = harness({ respond: receipt }); sibling.controller('hls', 'sibling', options());
  const controller = h.controller('hls', 'signed-playback-a', options()); controller.queueFullscreenEvent(true);
  h.pagehide(true); await settle(); assert.equal(h.requests.length, 0);
  h.window.dispatchEvent(new Event('pageshow'));
  h.load(modulePath).finishPlaybackSaves(); await settle();
  assert.equal(h.load(modulePath).getPlaybackSaveSnapshot()[0].state, 'retry');
  fail = false; h.window.dispatchEvent(new Event('online')); await settle();
  assert.equal(h.load(modulePath).getPlaybackSaveSnapshot().length, 0);
  assert.equal(sibling.requests.length, 0);
});

test('current-player expiry preserves pending records for an already-issued same-session renewal', async () => {
  const h = harness({ respond: receipt });
  const expiry = Math.floor(Date.now() / 1000) + 1;
  const controller = h.controller('hls', 'signed-playback-a', { ...options(), expiresAt: expiry });
  controller.queueFullscreenEvent(true);
  h.advance(2000); h.fireTimers(2000);
  assert.equal(h.load(modulePath).getPlaybackSaveSnapshot()[0].count, 1);
  assert.equal(h.load(modulePath).getPlaybackSaveSnapshot()[0].state, 'expired');
  controller.setToken('signed-renewal', expiry + 600); await settle();
  assert.equal(h.requests[0].body.batch.events.length, 1);
  assert.equal(h.requests[0].body.token, 'signed-renewal');
  controller.dispose(); await settle();
  assert.equal(h.load(modulePath).getPlaybackSaveSnapshot().length, 0);
});

test('detached expiry clears credentials and cannot replay into a new playback session', async () => {
  const h = harness({ respond: () => { throw new TypeError('offline'); } });
  const controller = h.controller('hls', 'signed-playback-a', { ...options(), expiresAt: Math.floor(Date.now() / 1000) + 1 });
  controller.queueFullscreenEvent(true); controller.dispose(); await settle();
  const attempted = h.requests.length;
  h.advance(2000); h.fireTimers(3000); await settle();
  h.load(modulePath).retryPlaybackSaves(); await settle();
  assert.equal(h.requests.length, attempted);
  const notice = h.load(modulePath).getPlaybackSaveSnapshot()[0];
  assert.equal(notice.state, 'expired'); assert.equal(notice.terminal, true);
  h.load(modulePath).dismissPlaybackSave(notice.key);
  assert.equal(h.load(modulePath).getPlaybackSaveSnapshot().length, 0);
});

test('UTF8 batches stay below8KiB and concurrent owned keepalive bodies stay below48KiB', async () => {
  let release;
  const h = harness({ respond: (request) => new Promise((resolve) => { release = () => resolve(receipt(request)); }) });
  const first = h.controller('hls', 'signed-a', options());
  const second = h.controller('youtube', 'signed-b', { ...options(), sessionId: 'session-b' });
  for (const controller of [first, second]) for (let index = 0; index < 18; index++) {
    controller.queueEvent('PLAYER_ERROR', { detail: '가'.repeat(700), index });
  }
  h.pagehide(false); await settle();
  assert.equal(h.requests.length, 1);
  assert.ok(Buffer.byteLength(JSON.stringify(h.requests[0].body)) <= 48 * 1024);
  assert.ok(h.requests[0].body.batches.every((batch) => Buffer.byteLength(JSON.stringify(batch)) <= 8 * 1024));
  assert.equal(h.load(modulePath).getPlaybackSaveSnapshot().some((notice) => notice.state === 'retry'), true);
  release(); await settle();
});

test('duplicate receipts acknowledge all events with inserted_count0 instead of duplicating local evidence', async () => {
  const h = harness({ respond: (request) => {
    const response = receipt(request);
    response.body.inserted_count = 0;
    response.body.acknowledgements.forEach((ack) => { ack.duplicate = true; });
    return response;
  } });
  const controller = h.controller('hls', 'signed-a', options());
  controller.queueFullscreenEvent(true); controller.dispose(); await settle();
  assert.equal(h.load(modulePath).getPlaybackSaveSnapshot().length, 0);
});

for (const status of [403, 409]) test(`explicit server ${status} is a terminal denial, not a retry or successful save`, async () => {
  let fatal = 0;
  const h = harness({ respond: () => ({ status, body: { detail: 'session_inactive' } }) });
  const controller = h.controller('hls', 'signed-a', { ...options(), onFatal: () => { fatal++; } });
  controller.queueFullscreenEvent(true); await controller.flushEvents();
  assert.equal(fatal, 1);
  assert.equal(h.load(modulePath).getPlaybackSaveSnapshot()[0].state, 'expired');
  h.load(modulePath).retryPlaybackSaves(); await settle();
  assert.equal(h.requests.length, 1);
});

for (const kind of ['hls', 'youtube']) {
  test(`${kind} v2 pagehide atomically sends all pending events, not a token-only end`, async () => {
    const h = harness({ respond: receipt });
    const controller = h.controller(kind, 'signed-playback-a', options());
    controller.queueFullscreenEvent(true);
    h.pagehide(false); await settle();
    assert.equal(h.requests[0]?.path, '/api/v1/media/playback/v2/end/');
    assert.equal(h.requests[0].keepalive, true);
    assert.equal(h.requests[0].body.batches.flatMap((batch) => batch.events).length, 1);
    controller.dispose(); await settle();
    assert.equal(h.requests.length, 1);
  });

  test(`${kind} v2 lost acknowledgement is retried with the same immutable batch`, async () => {
    let fail = true;
    const h = harness({ respond: (request) => { if (fail) throw new TypeError('closed test transport'); return receipt(request); } });
    const controller = h.controller(kind, 'signed-playback-a', options());
    controller.queueFullscreenEvent(true);
    await controller.flushEvents(); await settle();
    fail = false;
    await controller.flushEvents(); await settle();
    assert.equal(h.requests.filter((request) => request.path.endsWith('/v2/events/')).length, 2);
    assert.deepEqual(h.requests[1].body.batch, h.requests[0].body.batch);
    controller.dispose(); await settle();
  });

  test(`${kind} v2 more than 200 events drains bounded packets before final end without truncation`, async () => {
    const h = harness({ respond: receipt });
    const controller = h.controller(kind, 'signed-playback-a', options());
    for (let index = 0; index < 350; index++) controller.queueFullscreenEvent(index % 2 === 0);
    controller.dispose(); await settle();
    const requests = h.requests.filter((request) => request.path.includes('/v2/'));
    const unique = new Map(requests.flatMap((request) => request.body.batches ?? [request.body.batch]).map((batch) => [batch.batch_id, batch]));
    assert.equal([...unique.values()].reduce((n, batch) => n + batch.events.length, 0), 350);
    assert.equal(requests.at(-1).path, '/api/v1/media/playback/v2/end/');
    assert.ok(requests.every((request) => Buffer.byteLength(JSON.stringify(request.body), 'utf8') <= 48 * 1024));
  });
}
