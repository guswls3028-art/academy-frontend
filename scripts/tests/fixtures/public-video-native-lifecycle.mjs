import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { installNativeFixtureController } from '../../public-video-native-diagnostic.mjs';
const options = { appOrigin: 'http://127.0.0.1:4173', providerOrigin: 'http://localhost:4174',
  embedUrl: 'http://localhost:4174/embed', totalMs: 1000, commandMs: 100 };
const bounded = promise => Promise.race([promise, new Promise((_, reject) => {
  const timer = setTimeout(() => reject(new Error('harness-deadline')), 1800); timer.unref();
})]);
export async function runLifecycleFaults() {
  const results = [];
  const browser = await chromium.launch({ headless: true, args: ['--disable-background-networking'] });
  try {
    for (const fault of ['close-reject', 'close-stall', 'close-unconfirmed', 'route-reject', 'route-stall', 'route-reject-close-reject']) {
      const context = await browser.newContext({ serviceWorkers: 'block' });
      const page = await context.newPage();
      const originalClose = context.close.bind(context);
      let requests = 0, actualClosed = false;
      context.on('request', () => requests++);
      context.once('close', () => { actualClosed = true; });
      const started = performance.now();
      try {
        if (fault.startsWith('close-')) {
          const guard = await installNativeFixtureController(context, page, options);
          // A retained in-flight request must not be erased by a failed close.
          const retainedRequest = {};
          context.close = () => {
            guard.state.active.add(retainedRequest);
            return fault === 'close-reject' ? Promise.reject(new Error('injected'))
              : fault === 'close-stall' ? new Promise(() => {}) : Promise.resolve();
          };
          await assert.rejects(bounded(guard.close()), /fixture-controller-close/);
          const snapshot = guard.snapshot();
          assert.equal(snapshot.closed, false);
          assert.equal(snapshot.closing, true);
          assert.equal(snapshot.activeRequests, 1);
          assert.equal(actualClosed, false);
          assert.equal(context.pages().length, 1);
          assert.ok(context.listenerCount('requestfinished') >= 1);
          assert.throws(() => guard.assertClean(), /native-response-boundary-failed/);
          const expected = fault === 'close-stall' ? 'context-close-deadline'
            : fault === 'close-unconfirmed' ? 'context-close-unconfirmed' : 'context-close-failed';
          assert.ok(snapshot.failures.includes(expected));
          // A cleanup retry cannot turn the diagnostic into a pass.
          guard.state.active.delete(retainedRequest);
          context.close = originalClose;
          await bounded(guard.close());
          assert.equal(guard.snapshot().closed, true);
          assert.equal(actualClosed, true);
          assert.equal(context.listenerCount('requestfinished'), 0);
          assert.throws(() => guard.assertClean(), /native-response-boundary-failed/);
        } else {
          context.route = fault === 'route-stall' ? () => new Promise(() => {})
            : async () => { throw new Error('injected-route'); };
          if (fault.endsWith('close-reject')) context.close = async () => { throw new Error('injected-close'); };
          await assert.rejects(bounded(installNativeFixtureController(context, page, options)),
            fault.endsWith('close-reject') ? /fixture-controller-setup: cleanup-failed/ : /fixture-controller-setup/);
          if (fault.endsWith('close-reject')) {
            assert.equal(actualClosed, false);
            assert.equal(context.pages().length, 1);
          } else {
            assert.equal(actualClosed, true);
            assert.equal(context.pages().length, 0);
            assert.equal(context.listenerCount('requestfinished'), 0);
            assert.equal(context.listenerCount('requestfailed'), 0);
          }
        }
        assert.equal(requests, 0);
        results.push({ fault, passed: true, elapsedMs: Math.round(performance.now() - started), requests });
        process.stdout.write(fault + ': PASS\n');
      } catch (error) {
        results.push({ fault, passed: false, message: error.message.slice(0, 250) });
        process.stdout.write(fault + ': FAIL ' + error.message.slice(0, 250) + '\n');
      } finally { context.close = originalClose; await originalClose(); }
    }
  } finally { await browser.close(); }
  assert.equal(browser.isConnected(), false);
  assert.equal(results.length, 6);
  assert.equal(results.filter(result => !result.passed).length, 0, JSON.stringify(results.filter(result => !result.passed)));
  return results;
}
