import assert from 'node:assert/strict';
import test from 'node:test';
import { harness, token, settle } from './helpers/playback-lifecycle-harness.mjs';

const required = { is_authenticated: true, is_superuser: false, is_staff: true,
  is_owner: true, is_payroll_manager: true, owner_setup_required: true };
const ready = { ...required, owner_setup_required: false, staff_id: 101 };
const fetcher = h => h.load('src/shared/staff/api.ts').fetchStaffMe;
function barrier() {
  let release;
  const reached = new Promise(resolve => { release = resolve; });
  return { reached, release };
}
const writes = h => h.requests.filter(record => record.body !== null);

for (const data of [ready, { is_owner: false, staff_id: 102 }, { is_owner: true, staff_id: 103 }]) {
  test(`ready/non-owner/older snapshot ${data.staff_id} keeps one GET`, async () => {
    const h = harness({ respond: () => ({ status: 200, body: data }) });
    assert.equal((await fetcher(h)()).staff_id, data.staff_id);
    assert.equal(h.requests.length, 1);
    assert.equal(writes(h).length, 0);
  });
}

test('parallel owner consumers share one setup and reload uses only GET', async () => {
  const posted = barrier(), finish = barrier();
  let persisted = false;
  const h = harness({ parentId: 41, respond: async record => {
    if (record.body === null) return { status: 200, body: persisted ? ready : required };
    posted.release();
    await finish.reached;
    persisted = true;
    return { status: 200, body: ready };
  } });
  const fetch = fetcher(h);
  const pending = Promise.all([fetch(), fetch()]);
  try {
    await posted.reached;
    await settle();
    assert.equal(writes(h).length, 1);
  } finally { finish.release(); }
  assert.ok((await pending).every(row => row.staff_id === 101));
  assert.equal((await fetch()).staff_id, 101);
  assert.equal(h.requests.length, 4); // two GET + shared POST + persisted GET
  assert.equal(writes(h).length, 1);
  assert.equal(writes(h)[0].headers.has('x-student-id'), false);
});

test('failed setup preserves observed permissions with a visible error and later retry succeeds', async () => {
  let posts = 0;
  const h = harness({ respond: record => record.body === null
    ? { status: 200, body: required }
    : { status: ++posts === 1 ? 503 : 200, body: posts === 1 ? {} : ready } });
  const fetch = fetcher(h);
  const pending = await fetch();
  assert.equal(pending.ownerSetupError, 'retry');
  assert.equal(pending.is_payroll_manager, true);
  assert.equal(pending.owner_setup_required, true);
  assert.equal((await fetch()).staff_id, 101);
  assert.equal(posts, 2);
});

test('stored setup with lost reply is recovered by GET without a second POST', async () => {
  let persisted = false;
  const h = harness({ respond: record => {
    if (record.body === null) return { status: 200, body: persisted ? ready : required };
    persisted = true;
    throw new TypeError('synthetic response lost after commit');
  } });
  const fetch = fetcher(h);
  assert.equal((await fetch()).ownerSetupError, 'retry');
  assert.equal((await fetch()).staff_id, 101);
  assert.equal(writes(h).length, 1);
});

for (const boundary of ['account', 'tenant', 'logout']) {
  test(`late identity read cannot provision across ${boundary}`, async () => {
    const arrived = barrier(), finish = barrier();
    const h = harness({ respond: async () => {
      arrived.release(); await finish.reached;
      return { status: 200, body: required };
    } });
    const pending = fetcher(h)().then(() => null, error => error);
    await arrived.reached;
    if (boundary === 'account') h.replaceEnvelope({ access: token(241), refresh: 'account-b', generation: 'generation-b' });
    if (boundary === 'tenant') h.setTenant('another-tenant');
    if (boundary === 'logout') h.replaceEnvelope(null);
    finish.release();
    assert.equal((await pending)?.code, 'ERR_CANCELED');
    assert.equal(writes(h).length, 0);
  });
}

test('a session switch queued immediately before POST prevents its dispatch', async () => {
  const h = harness({ respond: () => ({ status: 200, body: required }) });
  const originalPost = h.api.post.bind(h.api);
  h.api.post = (...args) => {
    h.replaceEnvelope({ access: token(241), refresh: 'account-b', generation: 'generation-b' });
    return originalPost(...args);
  };
  await assert.rejects(fetcher(h)(), error => error.code === 'ERR_CANCELED');
  assert.equal(writes(h).length, 0);
});

test('completed identity read cannot be delivered after a queued tenant switch', async () => {
  const h = harness({ respond: () => ({ status: 200, body: ready }) });
  const originalGet = h.api.get.bind(h.api);
  h.api.get = (...args) => originalGet(...args).then(response => {
    h.setTenant('another-tenant');
    return response;
  });
  await assert.rejects(fetcher(h)(), error => error.code === 'ERR_CANCELED');
  assert.equal(writes(h).length, 0);
});

test('completed owner setup cannot be delivered after a queued tenant switch', async () => {
  const h = harness({ respond: record => ({ status: 200,
    body: record.body === null ? required : ready }) });
  const originalPost = h.api.post.bind(h.api);
  h.api.post = (...args) => originalPost(...args).then(response => {
    queueMicrotask(() => queueMicrotask(() => h.setTenant('another-tenant')));
    return response;
  });
  await assert.rejects(fetcher(h)(), error => error.code === 'ERR_CANCELED');
  assert.equal(writes(h).length, 1);
});

test('late setup response cannot become another account identity', async () => {
  const posted = barrier(), finish = barrier();
  const h = harness({ respond: async record => {
    if (record.body === null) return { status: 200, body: required };
    posted.release(); await finish.reached;
    return { status: 200, body: ready };
  } });
  const pending = fetcher(h)().then(() => null, error => error);
  await posted.reached;
  h.replaceEnvelope({ access: token(241), refresh: 'account-b', generation: 'generation-b' });
  finish.release();
  assert.equal((await pending)?.code, 'ERR_CANCELED');
  assert.equal(writes(h).length, 1);
});

test('malformed setup success preserves known permissions and never claims ready', async () => {
  const h = harness({ respond: record => ({ status: 200, body: record.body === null
    ? required : { is_owner: true, owner_setup_required: false } }) });
  const row = await fetcher(h)();
  assert.equal(row.ownerSetupError, 'retry');
  assert.equal(row.is_owner, true);
  assert.equal(row.is_payroll_manager, true);
  assert.equal(row.owner_setup_required, true);
  assert.equal(row.staff_id, undefined);
});

for (const missingField of ['is_payroll_manager', 'owner_setup_required', 'is_staff']) {
  test(`setup missing ${missingField} cannot erase successful identity permissions`, async () => {
    const malformed = { ...ready };
    delete malformed[missingField];
    const h = harness({ respond: record => ({ status: 200,
      body: record.body === null ? required : malformed }) });
    const row = await fetcher(h)();
    assert.equal(row.ownerSetupError, 'retry');
    assert.equal(row.is_payroll_manager, true);
    assert.equal(row.owner_setup_required, true);
    assert.equal(row.staff_id, undefined);
  });
}

test('ambiguous stored staff preserves payroll access and reports the conflict', async () => {
  const h = harness({ respond: record => ({ status: record.body === null ? 200 : 409,
    body: record.body === null ? required : { detail: 'synthetic ambiguous staff' } }) });
  const row = await fetcher(h)();
  assert.equal(row.ownerSetupError, 'conflict');
  assert.equal(row.is_payroll_manager, true);
  assert.equal(row.owner_setup_required, true);
});

test('revoked owner permission is not replaced with the earlier authorized snapshot', async () => {
  const h = harness({ respond: record => ({ status: record.body === null ? 200 : 403,
    body: record.body === null ? required : {} }) });
  await assert.rejects(fetcher(h)(), error => error.response?.status === 403);
});

for (const change of [
  { url: '/staffs/', method: 'post' },
  { url: '/staffs/me/', method: 'delete' },
  { url: '/staffs/me/', method: 'post', skipAuth: true },
]) {
  test(`staff continuation stays limited to authenticated me GET/POST: ${JSON.stringify(change)}`, async () => {
    const h = harness({ respond: () => ({ status: 200, body: required }) });
    h.api.interceptors.request.use(config => {
      if (config.method === 'post') Object.assign(config, change);
      return config;
    });
    await assert.rejects(fetcher(h)(), error => error.code === 'ERR_CANCELED');
    assert.equal(writes(h).length, 0);
  });
}

test('token refresh within one login keeps the owner continuation valid', async () => {
  const h = harness({ expiresIn: -1, respond: record => ({ status: 200,
    body: record.body === null ? required : ready }) });
  assert.equal((await fetcher(h)()).staff_id, 101);
  assert.equal(h.counts.refresh, 1);
  assert.equal(writes(h).length, 1);
});
