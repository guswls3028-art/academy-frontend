import assert from 'node:assert/strict';
import test from 'node:test';
import axios from 'axios';
import { harness, token, settle } from './helpers/playback-lifecycle-harness.mjs';

const end = (h, config = { playbackUnload: true }) => h.studentApi.post('/media/playback/end/', { token: 'signed-playback-a' }, config);

for (const seconds of [120, 20]) test(`unload uses current valid JWT (${seconds}s) with scoped keepalive and no refresh`, async () => {
  const h = harness({ expiresIn: seconds, parentId: 41 });
  const current = h.envelope().access;
  await end(h);
  assert.equal(h.counts.refresh, 0);
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].keepalive, true);
  assert.equal(h.requests[0].headers.get('authorization'), `Bearer ${current}`);
  assert.equal(h.requests[0].headers.get('x-tenant-code'), 'unit-tenant');
  assert.equal(h.requests[0].headers.get('x-student-id'), '41');
});

test('unload does not join an already pending refresh, while ordinary calls still do', async () => {
  let release;
  const h = harness({ expiresIn: 20, refresh: () => new Promise((resolve) => { release = resolve; }) });
  const ordinary = h.studentApi.post('/media/playback/heartbeat/', { token: 'signed-playback-a' });
  await settle();
  assert.equal(h.counts.refresh, 1);
  let ended = false;
  const ending = end(h).then(() => { ended = true; });
  await settle();
  const endedBeforeRefresh = ended;
  release({ data: { access: token(120), refresh: 'rotated-refresh' } });
  await Promise.all([ordinary, ending]);
  assert.equal(endedBeforeRefresh, true);
  assert.equal(h.counts.refresh, 1);
});

for (const seconds of [0, -10]) test(`expired unload JWT (${seconds}s) is refused without refresh, request or logout`, async () => {
  const h = harness({ expiresIn: seconds });
  await assert.rejects(end(h));
  assert.deepEqual([h.counts.refresh, h.requests.length, h.counts.clear], [0, 0, 0]);
});

for (const override of [
  { url: '/media/playback/heartbeat/' }, { method: 'get' }, { url: '/media/playback/end/?extra=1' },
  { url: 'https://other.invalid/api/v1/media/playback/end/' }, { baseURL: 'https://other.invalid/api/v1' },
  { skipAuth: true }, { params: { extra: 1 } },
]) test(`unload option rejects non-exact request ${JSON.stringify(override)}`, async () => {
  const h = harness();
  await assert.rejects(h.api.request({ method: 'post', url: '/media/playback/end/', data: { token: 'signed' }, playbackUnload: true, ...override }));
  assert.equal(h.requests.length, 0);
});

test('unload keeps request and response generation fences', async () => {
  const h = harness();
  await assert.rejects(end(h, { playbackUnload: true, _authGeneration: 'generation-old' }));
  assert.equal(h.requests.length, 0);
  let release;
  const delayed = harness({ respond: () => new Promise((resolve) => { release = resolve; }) });
  const request = end(delayed);
  await settle();
  delayed.replaceEnvelope({ access: token(), refresh: 'other', generation: 'generation-b' });
  release({ status: 200, body: { ok: true } });
  await assert.rejects(request, (error) => axios.isCancel(error));
  assert.equal(delayed.counts.clear, 0);
});

test('unload config captures generation before the interceptor starts, but accepts same-generation token rotation', async () => {
  const h = harness();
  const config = h.exports.createPlaybackUnloadConfig();
  const request = end(h, config);
  h.replaceEnvelope({ access: token(), refresh: 'other', generation: 'generation-b' });
  await assert.rejects(request, (error) => axios.isCancel(error));
  assert.equal(h.requests.length, 0);
  const rotated = token(180);
  const next = h.exports.createPlaybackUnloadConfig();
  h.replaceEnvelope({ access: rotated, refresh: 'rotated', generation: 'generation-b' });
  await end(h, next);
  assert.equal(h.requests[0].headers.get('authorization'), `Bearer ${rotated}`);
});

for (const access of [null, 'malformed', `unit.${Buffer.from('{"exp":1e400}').toString('base64url')}.signature`]) {
  test(`unload refuses missing/malformed/non-finite JWT (${access === null ? 'missing' : access === 'malformed' ? 'malformed' : 'non-finite'})`, async () => {
    const h = harness();
    h.replaceEnvelope(access === null ? null : { ...h.envelope(), access });
    await assert.rejects(end(h, h.exports.createPlaybackUnloadConfig()));
    assert.deepEqual([h.counts.refresh, h.requests.length, h.counts.clear], [0, 0, 0]);
  });
}

test('unload transport failure is not retried or converted to success', async () => {
  const h = harness({ respond: () => { throw new TypeError('Closed unit transport'); } });
  await assert.rejects(end(h));
  assert.deepEqual([h.requests.length, h.counts.refresh, h.counts.clear], [1, 0, 0]);
});

test('support window unload uses only its valid scoped token and never parent administrator refresh', async () => {
  const h = harness({ support: true, expiresIn: 20, parentId: 41 });
  const supportAccess = token(25); h.setSupportAccess(supportAccess);
  await end(h);
  assert.equal(h.requests[0].headers.get('authorization'), `Bearer ${supportAccess}`);
  assert.equal(h.requests[0].headers.get('x-student-id'), '41');
  assert.equal(h.requests[0].keepalive, true);
  assert.equal(h.counts.refresh, 0);
  h.setSupportAccess(token(-1));
  await assert.rejects(end(h));
  assert.equal(h.requests.length, 1);
  assert.equal(h.counts.supportEnd, 0);
});

test('unload server401 is retained as failure without refresh/replay/logout', async () => {
  const h = harness({ respond: () => ({ status: 401, body: { detail: 'expired' } }) });
  await assert.rejects(end(h));
  assert.deepEqual([h.requests.length, h.counts.refresh, h.counts.clear], [1, 0, 0]);
  const support = harness({ support: true, respond: () => ({ status: 401, body: { detail: 'expired' } }) });
  await assert.rejects(end(support));
  assert.equal(support.counts.supportEnd, 0);
});

for (const kind of ['hls', 'youtube']) {
  test(`${kind}: hard pagehide ends latest token exactly once; subsequent SPA dispose adds no request`, async () => {
    const h = harness(); const controller = h.controller(kind);
    controller.setToken('signed-playback-rotated');
    h.pagehide(false); await settle();
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].body.token, 'signed-playback-rotated');
    assert.equal(h.requests[0].keepalive, true);
    controller.dispose(); h.pagehide(false); h.fireTimers(); await settle();
    assert.equal(h.requests.length, 1);
  });
  test(`${kind}: background visibility and BFCache do not end playback; other tab is untouched`, async () => {
    const h = harness(); const controller = h.controller(kind);
    const other = harness(); const sibling = other.controller(kind, 'other-tab-playback');
    h.document.hidden = true; h.document.dispatchEvent(new Event('visibilitychange'));
    h.pagehide(true); await settle();
    assert.equal(h.requests.length, 0);
    h.pagehide(false); await settle();
    assert.equal(h.requests.length, 1);
    assert.equal(other.requests.length, 0);
    controller.dispose(); sibling.dispose(); await settle();
  });
  test(`${kind}: ordinary SPA teardown preserves accepted events before one end and removes pagehide listener`, async () => {
    const sequence = [];
    const h = harness({ respond: (request) => {
      sequence.push(request.path);
      return { status: request.path.endsWith('/events/') ? 201 : 200,
        body: request.path.endsWith('/events/') ? { stored: request.body.events.length } : { ok: true } };
    } });
    const controller = h.controller(kind);
    controller.queueFullscreenEvent(true); controller.dispose();
    await settle(); h.fireTimers(); h.pagehide(false); await settle();
    assert.deepEqual(sequence, ['/api/v1/media/playback/events/', '/api/v1/media/playback/end/']);
    assert.equal(h.requests[1].keepalive, false);
  });
  test(`${kind}: hard navigation during a pending SPA flush starts one keepalive end without waiting`, async () => {
    let release;
    const h = harness({ respond: (request) => request.path.endsWith('/events/')
      ? new Promise((resolve) => { release = resolve; }) : { status: 200, body: { ok: true } } });
    const controller = h.controller(kind);
    controller.queueFullscreenEvent(true); controller.dispose(); await settle();
    h.pagehide(false); await settle();
    assert.equal(h.requests.length, 2);
    assert.equal(h.requests[1].path, '/api/v1/media/playback/end/');
    assert.equal(h.requests[1].keepalive, true);
    release({ status: 201, body: { stored: 1 } });
    await settle(); h.fireTimers(); h.pagehide(false); await settle();
    assert.equal(h.requests.length, 2);
  });
  test(`${kind}: pagehide during a pending SPA flush ends the token pinned at dispose, not one rotated afterward`, async () => {
    let release;
    const h = harness({ respond: (request) => request.path.endsWith('/events/')
      ? new Promise((resolve) => { release = resolve; }) : { status: 200, body: { ok: true } } });
    const controller = h.controller(kind);
    controller.queueFullscreenEvent(true); controller.dispose(); await settle();
    // A token rotation landing between dispose()'s scheduled flush and the
    // actual pagehide (e.g. a reload mid-renewal) must not redirect the
    // terminal end() call to the new session's token.
    controller.setToken('signed-playback-rotated-after-dispose');
    h.pagehide(false); await settle();
    assert.equal(h.requests.length, 2);
    assert.equal(h.requests[1].path, '/api/v1/media/playback/end/');
    assert.equal(h.requests[1].body.token, 'signed-playback-a');
    assert.equal(h.requests[1].keepalive, true);
    release({ status: 201, body: { stored: 1 } });
    await settle();
  });
  test(`${kind}: synthetic client token and unmonitored playback never send a session end`, async () => {
    const h = harness();
    const controller = h.controller(kind, 'student-client-only');
    h.pagehide(false); controller.dispose(); await settle();
    const unmonitored = h.controller(kind);
    unmonitored.policy.monitoring_enabled = false;
    h.pagehide(false); unmonitored.dispose(); await settle(); h.fireTimers();
    assert.equal(h.requests.length, 0);
  });
}
