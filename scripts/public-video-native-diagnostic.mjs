// Standalone transport diagnostic; not a production release guard.
import { EventEmitter } from 'node:events';
import { performance } from 'node:perf_hooks';

function childEndpoint(parent, sessionId, commandMs, state) {
  const child = new EventEmitter();
  const pending = new Map();
  let sequence = 0;
  let disposed = false;
  const receive = event => {
    if (event.sessionId !== sessionId || disposed) return;
    let message;
    try { message = JSON.parse(event.message); } catch { state.fail('child-message'); return; }
    if (message.id) {
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id); clearTimeout(waiter.timer);
      message.error ? waiter.reject(new Error('child-command')) : waiter.resolve(message.result);
    } else child.emit(message.method, message.params);
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    parent.off('Target.receivedMessageFromTarget', receive);
    parent.off('Target.detachedFromTarget', detached);
    for (const waiter of pending.values()) { clearTimeout(waiter.timer); waiter.reject(new Error('child-detached')); }
    pending.clear(); child.removeAllListeners();
  };
  const detached = event => { if (event.sessionId === sessionId) dispose(); };
  parent.on('Target.receivedMessageFromTarget', receive);
  parent.on('Target.detachedFromTarget', detached);
  child.send = (method, params = {}) => new Promise((resolve, reject) => {
    if (disposed) { reject(new Error('child-detached')); return; }
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('child-deadline')); }, commandMs);
    pending.set(id, { resolve, reject, timer });
    parent.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) })
      .catch(() => { const item = pending.get(id); if (!item) return; clearTimeout(item.timer); pending.delete(id); item.reject(new Error('child-send')); });
  });
  child.dispose = dispose;
  child.isDisposed = () => disposed;
  child.pendingCount = () => pending.size;
  return child;
}

async function installNativeFixtureController(context, page, options) {
  const { appOrigin, providerOrigin, embedUrl, totalMs = 5000, commandMs = 1000, maxRedirects = 3 } = options;
  if (!Number.isFinite(totalMs) || totalMs < 1 || totalMs > 30000 || !Number.isFinite(commandMs)
    || commandMs < 1 || commandMs > 5000 || maxRedirects !== 3) throw new Error('invalid-diagnostic-budget');
  const fixtureOnly = options.fixtureOnly !== false;
  const providerOrigins = new Set(options.providerOrigins || [providerOrigin]);
  for (const origin of fixtureOnly ? [appOrigin, ...providerOrigins] : []) {
    const url = new URL(origin);
    if (url.protocol !== 'http:' || !(['localhost', '127.0.0.1'].includes(url.hostname) || /^[a-z]+\.localhost$/.test(url.hostname))) throw new Error('fixture-only');
  }
  const classify = options.classify || ((raw, method, resourceType, trusted) => {
    const target = new URL(raw);
    if (!providerOrigins.has(target.origin) || target.username || target.password || target.hash) return null;
    if (raw === embedUrl && method === 'GET' && resourceType === 'document') return 'embed';
    return trusted && ['GET', 'HEAD', 'POST', 'OPTIONS'].includes(method) ? 'player' : null;
  });
  if (classify(embedUrl, 'GET', 'document', false) !== 'embed') throw new Error('fixed-embed-not-admitted');
  const started = performance.now();
  const state = { failures: [], rejected: 0, armedChildren: 0, continued: 0, active: new Set(), pendingHeaders: new Set(),
    handlers: new Set(), endpoints: [], sessions: new Set(), closing: false, closed: false, trustedFrameId: null,
    responseCounts: {},
    fail(code) { if (!this.failures.includes(code)) this.failures.push(code); } };
  let candidateFrame = null;
  let rootFrameId;
  const requestCounts = new Map(), closingAbortIntents = new Map();
  // Chromium may report an aborted browser fetch as XHR. Count both together
  // so an XHR/fetch duplicate is ambiguous and never receives an exemption.
  const requestKey = (url, method, resourceType) => {
    const type = resourceType.toLowerCase();
    return JSON.stringify([url, method, ['fetch', 'xhr'].includes(type) ? 'xhr' : type]);
  };
  let intentionalClosingAborts = 0;
  let root, rootTimer, onRequest, onResponse, onFinished, closePromise;
  const closeBudget = Math.min(5000, Math.max(250, commandMs));
  const onClosed = () => {
    state.closing = true; state.closed = true;
    clearTimeout(deadline);
    for (const child of state.endpoints) child.dispose();
    root?.removeAllListeners();
    if (onRequest) context.off('request', onRequest);
    if (onResponse) context.off('response', onResponse);
    if (onFinished) { context.off('requestfinished', onFinished); context.off('requestfailed', onFinished); }
    context.off('close', onClosed);
    state.active.clear(); state.pendingHeaders.clear();
    requestCounts.clear(); closingAbortIntents.clear();
  };
  context.on('close', onClosed);
  // The budget includes every awaited setup operation, including route registration.
  const deadline = setTimeout(() => {
    state.fail('total-deadline'); state.closing = true;
    void closeRaw().catch(() => {}); // closeRaw retains the fixed failure code.
  }, totalMs);
  async function closeRaw() {
    if (state.closed) return;
    if (closePromise) return closePromise;
    state.closing = true;
    let timer;
    closePromise = (async () => {
      try {
        await Promise.race([Promise.resolve().then(() => context.close()), new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('context-close-deadline')), closeBudget);
        })]);
        if (!state.closed) { state.fail('context-close-unconfirmed'); throw new Error('context-close-unconfirmed'); }
      } catch (error) {
        state.fail(error.message === 'context-close-deadline' ? 'context-close-deadline' : 'context-close-failed');
        throw new Error('fixture-controller-close');
      } finally { clearTimeout(timer); }
    })();
    try { await closePromise; } finally { if (!state.closed) closePromise = null; }
  }
  async function rejectSetup() {
    state.fail('setup');
    try { await closeRaw(); } catch { throw new Error('fixture-controller-setup: cleanup-failed'); }
    throw new Error('fixture-controller-setup');
  }
  try {
    root = await Promise.race([context.newCDPSession(page), new Promise((_, reject) => {
      rootTimer = setTimeout(() => reject(new Error('root-session-deadline')), Math.min(commandMs, totalMs));
    })]);
  } catch { return await rejectSetup(); }
  finally { clearTimeout(rootTimer); }
  const command = async (session, method, params = {}) => {
    let timer;
    const remaining = Math.max(1, Math.min(commandMs, totalMs - (performance.now() - started)));
    try { return await Promise.race([session.send(method, params), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('command-deadline')), remaining);
    })]); } finally { clearTimeout(timer); }
  };
  const track = promise => {
    state.handlers.add(promise);
    promise.catch(() => { if (!state.closed) state.fail('controller-command'); }).finally(() => state.handlers.delete(promise));
    return promise;
  };
  const treeEntries = tree => {
    const entries = new Map();
    const visit = (node, parentId) => { entries.set(node.frame.id, { ...node.frame, parentId: node.frame.parentId || parentId });
      for (const child of node.childFrames || []) visit(child, node.frame.id); };
    visit(tree.frameTree, null); return entries;
  };
  const trustedResponseFrame = async (frameId, isEmbed) => {
    const entries = treeEntries(await command(root, 'Page.getFrameTree'));
    // The root tree omits an OOPIF's current document. Ask each live child
    // session for its real tree and join only by protocol frame/parent IDs.
    for (const session of state.sessions) {
      if (session === root || session.isDisposed?.()) continue;
      for (const [id, frame] of treeEntries(await command(session, 'Page.getFrameTree'))) entries.set(id, frame);
    }
    const frame = entries.get(frameId);
    if (!frame) return false;
    if (isEmbed) {
      const parent = entries.get(frame.parentId);
      return !!candidateFrame && !candidateFrame.isDetached() && parent && new URL(parent.url).origin === appOrigin;
    }
    let current = frame;
    for (let depth = 0; current && depth < 32; depth++, current = entries.get(current.parentId)) {
      if (current.id === state.trustedFrameId && current.url === embedUrl) return true;
    }
    return false;
  };
  const arm = async session => {
    const chains = new Map();
    state.sessions.add(session);
    session.on('Target.attachedToTarget', event => {
      if (state.closed) return;
      const child = childEndpoint(session, event.sessionId, commandMs, state);
      state.endpoints.push(child);
      track((async () => { await arm(child); state.armedChildren++;
        await command(child, 'Runtime.runIfWaitingForDebugger'); })());
    });
    session.on('Fetch.requestPaused', event => track((async () => {
      const reject = async code => { state.fail(code); state.rejected++;
        await command(session, 'Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' }); };
      try {
        if (state.closed) return;
        if (state.closing && event.responseErrorReason === 'Aborted' && event.responseStatusCode == null && event.networkId) {
          const key = requestKey(event.request.url, event.request.method, String(event.resourceType || ''));
          const intent = closingAbortIntents.get(key);
          // A unique observed Request, an attested frame and successful explicit
          // route.abort are required. Network-event delivery order is not evidence
          // of intent. Duplicate identities and unknown frames remain failures.
          if (intent && requestCounts.get(key) === 1 && intent.frameId === event.frameId) {
            let abortTimer;
            try {
              await Promise.race([intent.completed, new Promise((_, reject) => {
                abortTimer = setTimeout(() => reject(new Error('closing-abort-deadline')), Math.max(1, Math.min(commandMs, totalMs - (performance.now() - started))));
              })]);
              if (requestCounts.get(key) === 1) {
                await command(session, 'Fetch.failRequest', { requestId: event.requestId, errorReason: 'Aborted' });
                intentionalClosingAborts++; return;
              }
            } finally { clearTimeout(abortTimer); }
          }
        }
        if (performance.now() - started >= totalMs) { await reject('total-deadline'); return; }
        const current = new URL(event.request.url);
        if (!event.networkId || !Number.isInteger(event.responseStatusCode) || event.responseStatusCode < 100
          || event.responseStatusCode > 599 || event.responseErrorReason
          || current.username || current.password || current.hash) {
          await reject('response-shape'); return;
        }
        const isEmbed = current.href === embedUrl;
        if (event.resourceType === 'Document' && event.frameId === state.trustedFrameId && !isEmbed) {
          state.trustedFrameId = null; await reject('response-frame'); return;
        }
        const frameTrusted = await trustedResponseFrame(event.frameId, isEmbed);
        if (!frameTrusted) { await reject('response-frame'); return; }
        const resourceType = String(event.resourceType || '').toLowerCase();
        const kind = classify(current.href, event.request.method, resourceType, !isEmbed && frameTrusted);
        if (!['embed', 'thumbnail', 'player'].includes(kind)) { await reject('response-admission'); return; }
        const countKey = kind + ':' + event.responseStatusCode;
        state.responseCounts[countKey] = (state.responseCounts[countKey] || 0) + 1;
        let chain = chains.get(event.networkId);
        if (!chain) { chain = { origin: current.origin, path: current.pathname, redirects: 0, isEmbed }; chains.set(event.networkId, chain); }
        if (event.responseStatusCode >= 300 && event.responseStatusCode < 400) {
          const locations = (event.responseHeaders || []).filter(h => h.name.toLowerCase() === 'location');
          const next = locations.length === 1 ? new URL(locations[0].value, current) : null;
          if (chain.isEmbed || kind !== 'player' || ![301, 302, 303, 307, 308].includes(event.responseStatusCode)
            || !['GET', 'HEAD'].includes(event.request.method) || chain.redirects >= maxRedirects || !next
            || next.origin !== chain.origin || next.pathname !== chain.path || next.username || next.password || next.hash
            || classify(next.href, event.request.method, resourceType, frameTrusted) !== 'player') {
            await reject('redirect'); return;
          }
          chain.redirects++;
        } else {
          chains.delete(event.networkId);
          if (isEmbed && event.responseStatusCode === 200) state.trustedFrameId = event.frameId;
        }
        await command(session, 'Fetch.continueResponse', { requestId: event.requestId });
        state.continued++;
      } catch { if (!state.closed) { try { await reject('controller-command'); } catch { state.fail('controller-command'); } } }
    })()));
    await command(session, 'Page.enable');
    if (session === root) rootFrameId = (await command(session, 'Page.getFrameTree')).frameTree.frame.id;
    await command(session, 'Network.enable');
    await command(session, 'Fetch.enable', { patterns: (options.responseUrlPatterns || [...providerOrigins].map(origin => origin + '/*'))
      .map(urlPattern => ({ urlPattern, requestStage: 'Response' })) });
    await command(session, 'Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: false,
      filter: [{ type: 'iframe', exclude: false }, { exclude: true }] });
  };
  onRequest = request => {
    state.active.add(request); state.pendingHeaders.add(request);
    const key = requestKey(request.url(), request.method(), request.resourceType());
    requestCounts.set(key, (requestCounts.get(key) || 0) + 1);
    if (request.url() !== embedUrl || request.method() !== 'GET' || request.resourceType() !== 'document') return;
    try {
      const frame = request.frame();
      if (frame.parentFrame() === page.mainFrame() && new URL(page.url()).origin === appOrigin) {
        if (candidateFrame && candidateFrame !== frame) state.fail('duplicate-embed');
        else candidateFrame = frame;
      }
    } catch { state.fail('embed-parent'); }
  };
  // Chromium emits response after the response-stage interceptor has allowed
  // headers through. Body streams may remain open after Play/Pause; close may
  // cancel those only after pending headers and their validation handlers settle.
  onResponse = response => state.pendingHeaders.delete(response.request());
  onFinished = request => { state.active.delete(request); state.pendingHeaders.delete(request); };
  context.on('request', onRequest); context.on('response', onResponse);
  context.on('requestfinished', onFinished); context.on('requestfailed', onFinished);
  const routeHandler = async route => {
    if (state.closing || state.closed) {
      const request = route.request();
      let frameId;
      try {
        const frame = request.frame();
        frameId = frame === page.mainFrame() ? rootFrameId
          : frame === candidateFrame ? state.trustedFrameId : null;
      } catch { /* Unknown frame cannot receive an intent exemption. */ }
      const key = requestKey(request.url(), request.method(), request.resourceType());
      const completed = route.abort('aborted');
      if (frameId && requestCounts.get(key) === 1) closingAbortIntents.set(key, { frameId, completed });
      try { await completed; } catch { state.fail('closing-abort'); throw new Error('fixture-closing-abort'); }
      return;
    }
    if (!fixtureOnly) {
      const request = route.request();
      if (request.url() === embedUrl) {
        let frame; try { frame = request.frame(); } catch { /* Reject below. */ }
        if (!candidateFrame || frame !== candidateFrame) { state.fail('embed-parent'); await route.abort('blockedbyclient'); return; }
      }
      await route.fallback(); return;
    }
    const request = route.request();
    let frame;
    try { frame = request.frame(); } catch { await route.abort('blockedbyclient'); state.fail('no-frame'); return; }
    const url = new URL(request.url());
    const headers = await request.allHeaders();
    const prohibited = headers.authorization || headers['x-tenant-code'] || headers['x-csrftoken'];
    const app = url.origin === appOrigin && frame === page.mainFrame() && request.method() === 'GET';
    const embed = request.url() === embedUrl && request.method() === 'GET' && request.resourceType() === 'document'
      && frame.parentFrame() === page.mainFrame() && new URL(page.url()).origin === appOrigin;
    let trusted = false;
    for (let current = frame; current; current = current.parentFrame()) {
      if (current === candidateFrame && !current.isDetached() && current.url() === embedUrl && state.trustedFrameId) { trusted = true; break; }
    }
    if (!app && (!providerOrigins.has(url.origin) || prohibited || url.username || url.password || url.hash
      || !['GET', 'HEAD', 'POST', 'OPTIONS'].includes(request.method()) || !(embed || trusted))) {
      state.fail(prohibited ? 'credentials' : 'admission'); state.rejected++; await route.abort('blockedbyclient'); return;
    }
    if (embed) {
      if (candidateFrame && candidateFrame !== frame) { state.fail('duplicate-embed'); await route.abort('blockedbyclient'); return; }
      candidateFrame = frame;
    }
    await route.continue();
  };
  try {
    let routeTimer;
    try {
      await Promise.race([context.route('**/*', routeHandler), new Promise((_, reject) => {
        routeTimer = setTimeout(() => reject(new Error('route-setup-deadline')),
          Math.max(1, Math.min(commandMs, totalMs - (performance.now() - started))));
      })]);
    } finally { clearTimeout(routeTimer); }
    if (state.closing) throw new Error('setup-deadline');
    await arm(root);
  } catch { return await rejectSetup(); }
  return {
    state,
    async beginClose() {
      state.closing = true;
      while (!state.closed && (state.pendingHeaders.size || state.handlers.size) && performance.now() - started < totalMs) {
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      await closeRaw();
      await Promise.allSettled([...state.handlers]);
    },
    async close() { await this.beginClose(); },
    assertClean() { if (state.failures.length) throw new Error('native-response-boundary-failed: ' + state.failures.join(',')); },
    snapshot() { return { failures: [...state.failures], rejected: state.rejected, armedChildren: state.armedChildren,
      continued: state.continued, activeRequests: state.active.size, activeHandlers: state.handlers.size,
      pendingResponseHeaders: state.pendingHeaders.size,
      intentionalClosingAborts,
      pendingCommands: state.endpoints.reduce((n, c) => n + c.pendingCount(), 0), closing: state.closing, closed: state.closed,
      responseCounts: { ...state.responseCounts } }; },
  };
}
function installNativeResponseGuard(context, page, options) {
  if (typeof options.classify !== 'function' || options.admissionGuardInstalled !== true) throw new Error('existing-admission-guard-required');
  return installNativeFixtureController(context, page, { fixtureOnly: false, appOrigin: options.webOrigin,
    providerOrigin: new URL(options.fixedEmbedUrl).origin, embedUrl: options.fixedEmbedUrl,
    classify: options.classify, totalMs: options.deadlineMs ?? 30000, commandMs: options.commandMs ?? 5000,
    responseUrlPatterns: options.responseUrlPatterns ?? ['https://*/*'] });
}
export { installNativeFixtureController, installNativeResponseGuard, childEndpoint };
