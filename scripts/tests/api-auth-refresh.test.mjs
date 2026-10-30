import assert from 'node:assert/strict';
import test from 'node:test';
import axios from 'axios';
import { harness, token } from './helpers/playback-lifecycle-harness.mjs';

function barrier() {
  let release;
  const reached = new Promise(resolve => { release = resolve; });
  return { reached, release };
}

for (const replayStatus of [200, 401]) {
  test(`late old-access 401 reuses the completed rotation; replay ${replayStatus}`, { timeout: 5000 }, async () => {
    const bothOriginals = barrier();
    const firstReplay = barrier();
    const bothReplays = barrier();
    const releaseReplayResponses = barrier();
    const rotatedAccess = token(240);
    let originals = 0;
    let replays = 0;
    const h = harness({
      refresh: () => ({ data: { access: rotatedAccess, refresh: 'rotated-refresh' } }),
      respond: async record => {
        const isRotated = record.headers.get('authorization') === `Bearer ${rotatedAccess}`;
        if (!isRotated) {
          originals++;
          if (originals === 1) await bothOriginals.reached;
          else {
            bothOriginals.release();
            // The first replay proves refresh publication and promise cleanup completed.
            await firstReplay.reached;
          }
          return { status: 401, body: { detail: 'old access rejected' } };
        }
        replays++;
        firstReplay.release();
        if (replays === 2) bothReplays.release();
        await releaseReplayResponses.reached;
        return { status: replayStatus, body: { ok: replayStatus === 200 } };
      },
    });
    const results = Promise.allSettled([h.api.get('/first/'), h.api.get('/late/')]);
    try {
      await bothReplays.reached;
      assert.equal(h.counts.refresh, 1, 'a delayed old-token 401 must not rotate the new refresh token');
      assert.equal(originals, 2);
      assert.equal(replays, 2);
    } finally {
      releaseReplayResponses.release();
      bothOriginals.release();
      firstReplay.release();
    }
    const settled = await results;
    if (replayStatus === 200) {
      assert.ok(settled.every(result => result.status === 'fulfilled'));
      assert.equal(h.envelope()?.access === rotatedAccess, true);
      assert.equal(h.counts.clear, 0);
    } else {
      assert.equal(settled.filter(result => result.status === 'rejected' && result.reason.response?.status === 401).length, 1);
      assert.equal(settled.filter(result => result.status === 'rejected' && result.reason.code === 'ERR_CANCELED').length, 1,
        'the other replay is fenced after the first terminal 401 removes the envelope');
      assert.equal(h.envelope(), null);
      assert.equal(h.counts.clear, 1, 'terminal replay 401 ends the session once');
    }
    assert.equal(h.counts.refresh, 1);
  });
}

for (const boundary of ['account-switch', 'logout', 'tenant-switch']) {
  test(`late 401 never replays credentials across ${boundary}`, { timeout: 5000 }, async () => {
    const arrived = barrier();
    const release = barrier();
    const h = harness({ respond: async () => {
      arrived.release();
      await release.reached;
      return { status: 401, body: {} };
    } });
    const result = h.api.get('/late/').then(() => null, error => error);
    await arrived.reached;
    const initial = h.envelope();
    if (boundary === 'account-switch') h.replaceEnvelope({ access: token(240), refresh: 'account-b-refresh', generation: 'generation-b' });
    if (boundary === 'logout') h.replaceEnvelope(null);
    if (boundary === 'tenant-switch') {
      h.replaceEnvelope({ ...initial, access: token(240), refresh: 'rotated-refresh' });
      h.setTenant('another-tenant');
    }
    const expected = h.envelope();
    release.release();
    assert.equal((await result)?.code, 'ERR_CANCELED');
    assert.equal(h.counts.refresh, 0);
    assert.equal(h.requests.length, 1);
    assert.equal(h.counts.clear, 0);
    assert.equal(h.envelope(), expected);
  });
}

for (const replacement of ['expired', 'malformed']) {
  test(`late 401 does not reuse ${replacement} current access`, { timeout: 5000 }, async () => {
    const arrived = barrier();
    const release = barrier();
    const fresh = token(300);
    let requests = 0;
    const h = harness({
      refresh: () => ({ data: { access: fresh, refresh: 'fresh-refresh' } }),
      respond: async record => {
        if (++requests === 1) {
          arrived.release();
          await release.reached;
          return { status: 401, body: {} };
        }
        assert.equal(record.headers.get('authorization') === `Bearer ${fresh}`, true);
        return { status: 200, body: {} };
      },
    });
    const result = h.api.get('/late/');
    await arrived.reached;
    h.replaceEnvelope({ ...h.envelope(), access: replacement === 'expired' ? token(-60) : 'malformed', refresh: 'replacement-refresh' });
    release.release();
    assert.equal((await result).status, 200);
    assert.equal(h.counts.refresh, 1);
    assert.equal(h.counts.clear, 0);
  });
}

test('proactive refresh still precedes an expired-token request', async () => {
  const h = harness({ expiresIn: -60 });
  assert.equal((await h.api.get('/proactive/')).status, 200);
  assert.equal(h.counts.refresh, 1);
  assert.equal(h.requests.length, 1);
  assert.equal(h.counts.clear, 0);
});

test('an untracked 401 cannot reuse a current-generation credential', async () => {
  const h = harness();
  const initial = h.envelope();
  h.replaceEnvelope({ ...initial, access: token(240), refresh: 'rotated-refresh' });
  const config = { url: '/untracked/', method: 'get', headers: new axios.AxiosHeaders({
    Authorization: `Bearer ${initial.access}`, 'X-Tenant-Code': 'unit-tenant',
  }) };
  const error = new axios.AxiosError('unit unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
    status: 401, statusText: 'Unauthorized', headers: {}, data: {}, config,
  });
  await assert.rejects(h.api.interceptors.response.handlers[0].rejected(error), result => result === error);
  assert.equal(h.counts.refresh, 1, 'untracked requests must not take the same-generation reuse shortcut');
  assert.equal(h.requests.length, 0, 'generation validation still refuses to replay the untracked request');
  assert.equal(h.counts.clear, 0);
});

test('reused access remains tenant-bound while its replay is queued', async () => {
  const arrived = barrier();
  const release = barrier();
  const h = harness({ respond: async () => {
    arrived.release();
    await release.reached;
    return { status: 401, body: {} };
  } });
  h.api.interceptors.request.use(config => {
    if (config._retry) h.setTenant('another-tenant');
    return config;
  });
  const result = h.api.get('/late/').then(() => null, error => error);
  await arrived.reached;
  h.replaceEnvelope({ ...h.envelope(), access: token(240), refresh: 'rotated-refresh' });
  release.release();
  assert.equal((await result)?.code, 'ERR_CANCELED');
  assert.equal(h.counts.refresh, 0);
  assert.equal(h.requests.length, 1);
  assert.equal(h.counts.clear, 0);
});
