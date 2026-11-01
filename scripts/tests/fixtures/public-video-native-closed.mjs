import http from 'node:http';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { chromium } from '@playwright/test';
import { installNativeFixtureController, installNativeResponseGuard, childEndpoint } from '../../public-video-native-diagnostic.mjs';
const waitFor = async (predicate, ms = 3000) => {
  const end = Date.now() + ms;
  while (!predicate()) { if (Date.now() >= end) throw new Error('fixture-observation-deadline'); await new Promise(resolve => setTimeout(resolve, 10)); }
};
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const closeServer = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });

export async function runClosedFixtures() {
  const results = [];
  let current;
  let forbiddenHits = 0;
  const forbidden = http.createServer((_req, res) => { forbiddenHits++; res.end('denied'); });
  await listen(forbidden);
  const provider = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost:' + provider.address().port);
    current.hits[url.pathname] = (current.hits[url.pathname] || 0) + 1;
    res.setHeader('Cache-Control', 'no-store');
    if (url.pathname === '/embed') {
      if (current.name === 'embed-redirect') { res.writeHead(302, { Location: '/secret' }); res.end(); return; }
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Set-Cookie', 'synthetic=fixture; Path=/; Secure; SameSite=None; Partitioned');
      if (current.name === 'nested') { res.end('<iframe src="http://nested.localhost:' + provider.address().port + '/nested"></iframe>'); return; }
      res.end('<!doctype html><body><button id="start">Start</button><script>document.querySelector("#start").onclick=async()=>{try{const response=await fetch("/asset?hop=0",'
        + (current.name === 'post-redirect' ? '{method:"POST",body:"fixture"}' : current.name.includes('credentials') ? '{headers:{Authorization:"synthetic-fixture"}}' : '{}')
        + ');await response.text();document.body.dataset.done="yes"}catch{document.body.dataset.done="failed"}};</script></body>');
    } else if (url.pathname === '/nested') {
      res.setHeader('Content-Type', 'text/html');
      res.end('<body><button id="start">Start</button><script>document.querySelector("#start").onclick=async()=>{await fetch("/asset");document.body.dataset.done="yes"}</script>');
    } else if (url.pathname === '/asset') {
      current.cookiePresent ||= /(?:^|;\s*)synthetic=fixture(?:;|$)/.test(req.headers.cookie || '');
      const hop = Number(url.searchParams.get('hop'));
      const send = () => {
        if (res.destroyed) return;
        if (current.name === 'origin-redirect') res.writeHead(302, { Location: 'http://127.0.0.1:' + forbidden.address().port + '/secret' });
        else if (['path-redirect', 'post-redirect'].includes(current.name)) res.writeHead(302, { Location: '/secret' });
        else if (['three-hops', 'four-hops', 'total-budget'].includes(current.name) && hop < (current.name === 'three-hops' ? 3 : 6)) res.writeHead(302, { Location: '/asset?hop=' + (hop + 1) });
        res.end('ok'); current.finished++;
      };
      if (current.name === 'close-drain') setTimeout(send, 180);
      else if (current.name === 'total-budget') setTimeout(send, 1000);
      else send();
    } else if (url.pathname === '/leave') {
      res.setHeader('Content-Type', 'text/html');
      res.end('<script>fetch("/secret").catch(()=>document.body.dataset.done="rejected")</script>');
    } else { res.end('unexpected'); }
  });
  await listen(provider);
  const app = http.createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html'); res.setHeader('Cache-Control', 'no-store');
    res.end('<!doctype html><iframe src="' + current.embedUrl + '"></iframe>');
  });
  await listen(app);
  const appOrigin = 'http://127.0.0.1:' + app.address().port;
  const providerOrigin = 'http://localhost:' + provider.address().port;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--site-per-process', '--disable-background-networking', '--host-resolver-rules=MAP *.localhost 127.0.0.1'] });
    const selected = [];
    for (const name of ['allowed', 'nested', 'adapter', 'adapter-credentials', 'three-hops', 'four-hops', 'origin-redirect', 'path-redirect', 'embed-redirect',
      'post-redirect', 'credentials', 'sibling', 'frame-leave', 'close-drain', 'total-budget'].filter(name => !selected.length || selected.includes(name))) {
      current = { name, embedUrl: providerOrigin + '/embed?case=' + name, hits: {}, finished: 0, cookiePresent: false };
      const context = await browser.newContext({ serviceWorkers: 'block' });
      const page = await context.newPage();
      let guard;
      const local = current;
      try {
        if (name.startsWith('adapter')) {
          local.admissionRejects = 0;
          await context.route('**/*', async route => {
            const request = route.request(); const target = new URL(request.url()); const headers = await request.allHeaders();
            if (headers.authorization || headers['x-tenant-code'] || headers['x-csrftoken']
              || ![appOrigin, providerOrigin].includes(target.origin)) { local.admissionRejects++; await route.abort('blockedbyclient'); return; }
            await route.continue();
          });
          guard = await installNativeResponseGuard(context, page, { webOrigin: appOrigin, fixedEmbedUrl: local.embedUrl,
            admissionGuardInstalled: true, deadlineMs: 7000, commandMs: 1000, responseUrlPatterns: [providerOrigin + '/*'],
            classify: (url, method, type, trusted) => url === local.embedUrl && method === 'GET' && type === 'document' ? 'embed'
              : trusted && new URL(url).origin === providerOrigin ? 'player' : null });
        } else guard = await installNativeFixtureController(context, page, { appOrigin, providerOrigin,
          providerOrigins: [providerOrigin, 'http://nested.localhost:' + provider.address().port], embedUrl: local.embedUrl,
          totalMs: name === 'total-budget' ? 3500 : 7000, commandMs: 1000 });
        await page.goto(appOrigin, { waitUntil: 'domcontentloaded', timeout: 5000 });
        if (name === 'embed-redirect') {
          await waitFor(() => guard.state.failures.includes('redirect'));
        } else {
          const frame = name === 'nested' ? page.frameLocator('iframe').frameLocator('iframe') : page.frameLocator('iframe');
          await frame.locator('#start').waitFor({ timeout: 5000 });
          if (name === 'sibling') {
            await page.evaluate(origin => { const sibling = document.createElement('iframe'); sibling.src = origin + '/secret'; document.body.append(sibling); }, providerOrigin);
            await waitFor(() => guard.state.failures.includes('admission'));
          } else if (name === 'frame-leave') {
            await frame.locator('#start').evaluate(button => { button.ownerDocument.defaultView.location.href = '/leave'; });
            await waitFor(() => guard.state.failures.includes('admission') || guard.state.failures.includes('response-frame'));
          } else {
            await frame.locator('#start').click();
            if (name === 'close-drain') {
              await waitFor(() => local.hits['/asset'] === 1);
              const closing = guard.beginClose();
              await page.evaluate(url => { void fetch(url).catch(() => {}); }, providerOrigin + '/secret').catch(() => {});
              await closing;
              assert.equal(local.finished, 1);
            } else if (name === 'total-budget') {
              await waitFor(() => guard.state.closed, 4500);
              assert.ok((local.hits['/asset'] || 0) >= 1, 'The deadline must cover a real started response');
              assert.ok((local.hits['/asset'] || 0) < 7);
            } else if (['four-hops', 'origin-redirect', 'path-redirect', 'post-redirect'].includes(name)) {
              await waitFor(() => guard.state.failures.includes('redirect'));
            } else if (name === 'adapter-credentials') {
              await waitFor(() => local.admissionRejects === 1);
            } else if (name === 'credentials') {
              await waitFor(() => guard.state.failures.includes('credentials'));
            } else {
              await frame.locator('body[data-done=yes]').waitFor({ timeout: 5000 });
              if (name !== 'nested') {
                assert.equal(local.cookiePresent, true);
                assert.ok((await context.cookies()).some(cookie => cookie.name === 'synthetic' && cookie.partitionKey === appOrigin.replace(/:\d+$/, '')));
              }
            }
          }
        }
        assert.equal(local.hits['/secret'] || 0, 0);
        if (name.includes('credentials')) assert.equal(local.hits['/asset'] || 0, 0);
        if (name === 'three-hops') assert.equal(local.hits['/asset'], 4);
        if (name === 'four-hops') assert.equal(local.hits['/asset'], 4);
        if (['allowed', 'nested', 'adapter', 'three-hops', 'close-drain'].includes(name)) assert.deepEqual(guard.state.failures, []);
        await guard.beginClose();
        const snapshot = guard.snapshot();
        assert.equal(snapshot.pendingCommands, 0);
        assert.equal(snapshot.activeHandlers, 0);
        assert.equal(snapshot.activeRequests, 0);
        assert.equal(snapshot.closed, true);
        if (name !== 'embed-redirect') assert.ok(snapshot.armedChildren >= 1, 'Actual OOPIF child must be armed');
        if (name === 'nested') assert.ok(snapshot.armedChildren >= 2, 'Recursive OOPIF target must be armed');
        results.push({ name, passed: true, ...snapshot, hits: local.hits, completedResponses: local.finished, cookiePresent: local.cookiePresent });
        process.stdout.write(name + ': PASS\n');
      } catch (error) {
        results.push({ name, passed: false, code: error.code || error.name, message: String(error.message).slice(0,350), snapshot: guard?.snapshot(), hits: local.hits });
        process.stdout.write(name + ': FAIL ' + String(error.message).slice(0,150) + '\n');
      } finally { if (guard) await guard.beginClose(); else await context.close(); }
    }
    const parent = new EventEmitter(); parent.send = async () => ({});
    const child = childEndpoint(parent, 'fixture-session', 100, { fail() {} });
    const pending = child.send('Runtime.evaluate').then(() => 'resolved', error => error.message);
    parent.emit('Target.detachedFromTarget', { sessionId: 'fixture-session' });
    assert.equal(await pending, 'child-detached'); assert.equal(child.pendingCount(), 0);
    assert.equal(parent.listenerCount('Target.receivedMessageFromTarget'), 0);
    assert.equal(parent.listenerCount('Target.detachedFromTarget'), 0);
    results.push({ name: 'child-detach-settlement', passed: true, pendingCommands: 0, remainingParentListeners: 0 });
    const stalledChild = childEndpoint(parent, 'stalled-session', 50, { fail() {} });
    assert.equal(await stalledChild.send('Runtime.evaluate').then(() => 'resolved', error => error.message), 'child-deadline');
    assert.equal(stalledChild.pendingCount(), 0); stalledChild.dispose();
    assert.equal(parent.listenerCount('Target.receivedMessageFromTarget'), 0);
    results.push({ name: 'child-command-timeout', passed: true, pendingCommands: 0, remainingParentListeners: 0 });

    const setupContext = await browser.newContext({ serviceWorkers: 'block' });
    const setupPage = await setupContext.newPage();
    const originalSessionFactory = setupContext.newCDPSession.bind(setupContext);
    setupContext.newCDPSession = async target => {
      const session = await originalSessionFactory(target);
      const originalSend = session.send.bind(session);
      session.send = (method, params) => method === 'Fetch.enable' ? new Promise(() => {}) : originalSend(method, params);
      return session;
    };
    const oldHits = { ...current.hits };
    await assert.rejects(installNativeFixtureController(setupContext, setupPage,
      { appOrigin, providerOrigin, embedUrl: providerOrigin + '/embed?case=setup', totalMs: 1000, commandMs: 100 }), /fixture-controller-setup/);
    assert.equal(setupContext.pages().length, 0);
    assert.deepEqual(current.hits, oldHits);
    results.push({ name: 'arming-timeout-before-traffic', passed: true, contextClosed: true, requestsAdded: 0 });
    const rootTimeoutContext = await browser.newContext({ serviceWorkers: 'block' });
    const rootTimeoutPage = await rootTimeoutContext.newPage();
    rootTimeoutContext.newCDPSession = () => new Promise(() => {});
    await assert.rejects(installNativeFixtureController(rootTimeoutContext, rootTimeoutPage,
      { appOrigin, providerOrigin, embedUrl: providerOrigin + '/embed?case=root-timeout', totalMs: 1000, commandMs: 100 }), /fixture-controller-setup/);
    assert.equal(rootTimeoutContext.pages().length, 0);
    assert.deepEqual(current.hits, oldHits);
    results.push({ name: 'initial-session-timeout-before-traffic', passed: true, contextClosed: true, requestsAdded: 0 });
    if (!selected.length || selected.includes('cookie-relay')) {
      current = { name: 'cookie-relay', embedUrl: providerOrigin + '/embed?case=cookie-relay', hits: {}, finished: 0, cookiePresent: false };
      const relayContext = await browser.newContext({ serviceWorkers: 'block' });
      try {
        await relayContext.route('**/*', async route => {
          const origin = new URL(route.request().url()).origin;
          if (origin === appOrigin) { await route.continue(); return; }
          if (origin !== providerOrigin) { await route.abort('blockedbyclient'); return; }
          const response = await route.fetch({ maxRedirects: 0, timeout: 5000 });
          await route.fulfill({ response });
        });
        const relayPage = await relayContext.newPage();
        await relayPage.goto(appOrigin);
        await relayPage.frameLocator('iframe').locator('#start').click();
        await relayPage.frameLocator('iframe').locator('body[data-done=yes]').waitFor();
        const cookies = (await relayContext.cookies()).filter(c => c.name === 'synthetic')
          .map(c => ({ name: c.name, partitioned: Boolean(c.partitionKey), partitionMatchesTop: c.partitionKey === appOrigin.replace(/:\d+$/, '') }));
        results.push({ name: 'cookie-relay-observation', passed: true, cookiePresentOnWire: current.cookiePresent, cookies,
          interpretation: 'Synthetic cookie storage observation only; not YouTube challenge causality' });
      } finally { await relayContext.close(); }
    }
    assert.equal(forbiddenHits, 0);
  } finally {
    if (browser) await browser.close();
    await Promise.all([closeServer(app), closeServer(provider), closeServer(forbidden)]);
    const report = { fixtureOnly: true, externalProviderRequested: false, qaApiOrDbUsed: false,
      productionImplementation: false, playwright: '1.63.0', forbidExternalDestinationHits: forbiddenHits,
      sourceScope: 'New standalone localhost native response prototype, not release guard replacement or bot fix proof',
      results, cleanup: { browserClosed: !browser?.isConnected(), allServersClosed: !app.listening && !provider.listening && !forbidden.listening } };
    report.recordedAt = new Date().toISOString();
    process.stdout.write(JSON.stringify({ passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, forbiddenHits, cleanup: report.cleanup }) + '\n');
  }
  assert.equal(results.length, 20);
  assert.equal(results.filter(result => !result.passed).length, 0, JSON.stringify(results.filter(result => !result.passed)));
  return results;
}
