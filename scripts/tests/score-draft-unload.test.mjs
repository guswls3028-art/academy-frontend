import assert from 'node:assert/strict';
import test from 'node:test';
import { harness, token, settle } from './helpers/playback-lifecycle-harness.mjs';

const release = (h, sessionId = 9002, clientId = 'document-a') =>
  h.exports.releaseEmptyScoreDraftOnPageExit(sessionId, clientId);

test('empty score exit dispatches synchronously with exact JWT tenant client and body while refresh is pending', async () => {
  let finish;
  const h = harness({ expiresIn: 20, refresh: () => new Promise((resolve) => { finish = resolve; }) });
  const ordinary = h.api.put('/results/admin/sessions/9002/score-draft/', { changes: [] });
  await settle();
  assert.equal(h.counts.refresh, 1);
  const exiting = release(h);
  // This assertion deliberately precedes any await: pagehide cannot wait for dispatch.
  assert.equal(h.requests.length, 1);
  const request = h.requests[0];
  assert.equal(request.path, '/api/v1/results/admin/sessions/9002/score-draft/commit/');
  assert.equal(request.keepalive, true);
  assert.equal(request.credentials, 'omit');
  assert.equal(request.redirect, 'error');
  assert.deepEqual(JSON.parse(JSON.stringify(request.body)), { release_lease: true, release_if_empty: true });
  assert.equal(request.headers.get('x-score-editor-client'), 'document-a');
  assert.equal(request.headers.get('x-tenant-code'), 'unit-tenant');
  assert.equal(request.headers.get('authorization'), `Bearer ${h.envelope().access}`);
  await exiting;
  finish({ data: { access: token(120), refresh: 'rotated' } });
  await ordinary;
  assert.equal(h.requests[1].keepalive, false);
});

for (const sessionId of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, '9002?extra=1']) {
  test(`empty score exit rejects non-exact session ${sessionId}`, async () => {
    const h = harness();
    await assert.rejects(release(h, sessionId));
    assert.deepEqual([h.requests.length, h.counts.refresh, h.counts.clear], [0, 0, 0]);
  });
}
for (const clientId of ['', 'a b', 'a\r\nb', 'a'.repeat(129)]) {
  test(`empty score exit rejects invalid document id of length ${clientId.length}`, async () => {
    const h = harness();
    await assert.rejects(release(h, 9002, clientId));
    assert.equal(h.requests.length, 0);
  });
}
for (const options of [{ expiresIn: -1 }, { tenant: '' }, { tenant: null }, { support: true }]) {
  test(`empty score exit fails closed without current staff scope ${JSON.stringify(options)}`, async () => {
    const h = harness(options);
    await assert.rejects(release(h));
    assert.deepEqual([h.requests.length, h.counts.refresh, h.counts.clear], [0, 0, 0]);
  });
}
for (const access of [null, 'malformed', `unit.${Buffer.from('{"exp":1e400}').toString('base64url')}.signature`]) {
  test(`empty score exit refuses invalid auth ${access === null ? 'missing' : access === 'malformed' ? 'malformed' : 'non-finite'}`, async () => {
    const h = harness();
    h.replaceEnvelope(access === null ? null : { ...h.envelope(), access });
    await assert.rejects(release(h));
    assert.deepEqual([h.requests.length, h.counts.refresh, h.counts.clear], [0, 0, 0]);
  });
}
for (const status of [401, 403, 404, 500]) {
  test(`empty score exit ${status} remains failure with no refresh retry or logout`, async () => {
    const h = harness({ respond: () => ({ status, body: {} }) });
    await assert.rejects(release(h));
    assert.deepEqual([h.requests.length, h.counts.refresh, h.counts.clear], [1, 0, 0]);
  });
}
test('empty score exit transport failure preserves the account and never retries', async () => {
  const h = harness({ respond: () => { throw new TypeError('closed fixture transport'); } });
  await assert.rejects(release(h));
  assert.deepEqual([h.requests.length, h.counts.refresh, h.counts.clear], [1, 0, 0]);
});
