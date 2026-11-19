import learnerDemo from './baseline-worker.mjs';

const productionHost = 'demo.hakwonplus.com';
const originHost = 'https://dawon-review-origin.hakwonplus.com';
const legacyRevision = 'fd6d5e6e1db1ff9fb1dd03903416dbf3789acf590073b806f65cf15f7d7e0458';
const linkedNavPath = '/dawon-preview-navigation.js';
const nativeAssetDirectories = ['/assets/', '/tenants/', '/feature-guides/', '/guide-media/', '/teacher-icons/', '/licenses/'];
const nativeFiles = new Set(['/dawon-brand.svg', '/dawon-brand.css', '/dawon-release.js', '/manifest.json', '/teacher-manifest.json', '/student-manifest.json', '/dev-manifest.json', '/omr-default-logo.svg', '/omr-sheet.html']);
const brandStyle = (version) => `<link rel="stylesheet" href="/dawon-brand.css?v=${encodeURIComponent(version)}"><style>body:not([data-role="student"]) .dawon-native-exams { display:none!important }</style>`;
const formerTeacherRoutes = /^\/learn\/(?:teacher(?:[-/]|$)|grade-collection(?:\/|$)|class-qr(?:\/|$))/;
const consoleCookie = 'dawon_console=1; Path=/; SameSite=Lax; HttpOnly; Secure';
const consoleCookieExpired = 'dawon_console=; Path=/; SameSite=Lax; HttpOnly; Secure; Max-Age=0';
const workspaceStyle = `<style>
.ds-overlay-backdrop:has(+ .ds-overlay-wrap .ds-overlay-panel--student-detail),
.ds-overlay-wrap:has(.ds-overlay-panel--student-detail) {
  left:0;
}
@media (max-width:420px) {
  .teacher-topbar__brand[data-tenant-header-brand] {
    padding-inline-end:4px!important;
    gap:6px!important;
  }
  .teacher-topbar__brand[data-tenant-header-brand] span {
    font-size:15px!important;
  }
  .teacher-topbar__logo {
    flex:0 0 auto;
  }
  .teacher-topbar button[aria-label="기능 검색"] > span {
    display:none;
  }
}
@media (min-width:1024px) {
  html[data-sidebar="expanded"] [data-analytics-placement="admin.sidebar"] button.nav-item[aria-expanded] {
    column-gap:8px;
  }
  html[data-sidebar="expanded"] [data-analytics-placement="admin.sidebar"] button.nav-item[aria-expanded] > .label {
    white-space:nowrap;
  }
}
</style>`;
const nativePolicy = "default-src 'self'; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

const loginNav = `<nav id="dawon-preview-roles" aria-label="다원수학 데모 화면">
<a href="/login/dawon" aria-current="page">선생님</a><a href="/student">학생</a><a href="/guardian">학부모</a>
</nav><p id="dawon-preview-scope">체험 화면에서는 예시 데이터만 사용해 주세요.</p>
<style>
#dawon-preview-roles{display:flex;justify-content:center;gap:8px;padding:10px 12px;background:#fff;border-bottom:1px solid #eee6df;font:600 14px/1.3 system-ui,sans-serif}
#dawon-preview-roles a{padding:8px 12px;border-radius:6px;color:#53473e;text-decoration:none}
#dawon-preview-roles a[aria-current]{background:#fff1e7;color:#a7470c}
#dawon-preview-scope{margin:0;padding:8px 16px;background:#fbfaf8;color:#695e55;text-align:center;font:12px/1.5 system-ui,sans-serif}
</style>`;

const navigation = `
const gradePanel = document.querySelector('#panel-grades .detail-sheet');
if (gradePanel) {
  const saved = document.createElement('details');
  const label = document.createElement('summary');
  label.textContent = '이 기기에 저장된 이전 데모 성적';
  saved.append(label);
  const heading = gradePanel.querySelector('h1,h2');
  const previous = Array.from(gradePanel.children).filter(node => node !== heading && !(heading && node.contains(heading)));
  if (previous.length) saved.append(...previous);
  const link = document.createElement('a');
  link.className = 'route-action dawon-native-exams';
  link.href = '/login/dawon?demo=student&view=school-report';
  link.textContent = '학교 성적 입력·조회';
  if (heading) heading.after(link); else gradePanel.prepend(link);
  gradePanel.append(saved);
}
const examPanel = document.querySelector('#panel-exam #exam');
if (examPanel) {
  const exams = document.createElement('a');
  exams.href = '/login/dawon?demo=student&view=exams';
  exams.className = 'route-action dawon-native-exams';
  exams.textContent = '등록된 수업의 시험 결과 보기';
  examPanel.append(exams);
}
try {
  if (sessionStorage.getItem('dawon-room-role') === 'teacher') {
    sessionStorage.removeItem('dawon-room-role');
    window.location.replace('/teacher');
  }
} catch {}
document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  if (document.body.dataset.role === 'student' && event.target.closest('[data-route="qr"]')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign('/login/dawon?demo=student');
    return;
  }
  if (!event.target.closest('[data-preview-role="teacher"],[data-signin="teacher"]')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  window.location.assign('/teacher');
}, true);`;

const reloadScript = (release) => `<script defer src="/dawon-release.js?v=${encodeURIComponent(release)}" data-release="${release}"></script>`;
const modernProbe = "data:text/javascript,if(!import.meta.resolve)throw Error(\"import.meta.resolve not supported\")";

function secureResponse(body, status, contentType = 'application/json') {
  return new Response(body, {
    status,
    headers: {'content-type': contentType, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff'}
  });
}

function forbidden() {
  return secureResponse('{"detail":"이 데모 계정의 요청만 사용할 수 있습니다."}', 403);
}

function scopesAreValid(entries) {
  const scopes = {
    tenant: ['dawon', '719'],
    tenant_id: ['719'],
    tenantId: ['719'],
    tenant_code: ['dawon'],
    tenantCode: ['dawon'],
  };
  return [...entries].every(([key, value]) => !Object.hasOwn(scopes, key) || scopes[key].includes(String(value)));
}

function forward(url, request, env, fetcher, body = null) {
  const headers = new Headers({'x-dawon-review-origin': env.ORIGIN_KEY, 'x-dawon-asset-version': env.ADMIN_VERSION});
  for (const header of ['authorization', 'content-type', 'accept', 'user-agent', 'if-none-match', 'if-modified-since', 'range', 'idempotency-key']) {
    const value = request.headers.get(header);
    if (value) headers.set(header, value);
  }
  return fetcher(originHost + url.pathname + url.search, {
    method: request.method,
    headers,
    body,
    redirect: 'manual',
  });
}

async function handleApi(request, url, env, fetcher) {
  const { method } = request;
  if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return secureResponse(null, 405);
  if (!scopesAreValid(url.searchParams)) return forbidden();
  const tenant = request.headers.get('x-tenant-code');
  if (tenant && tenant !== 'dawon') return forbidden();
  if (request.headers.has('origin') && request.headers.get('origin') !== url.origin) return forbidden();
  if (Number(request.headers.get('content-length') ?? 0) > 20_000_000) return secureResponse(null, 413);

  const isWrite = !['GET', 'HEAD'].includes(method);
  const authPaths = ['/api/v1/token/', '/api/v1/token/refresh/', '/api/v1/students/demo-session/'];
  if (isWrite && !(method === 'POST' && authPaths.includes(url.pathname))) {
    const authorization = request.headers.get('authorization');
    if (!/^Bearer [A-Za-z0-9_.-]+$/.test(authorization ?? '')) return forbidden();
    const check = await fetcher(originHost + '/api/v1/core/me/', {
      headers: {'x-dawon-review-origin': env.ORIGIN_KEY, 'x-dawon-asset-version': env.ADMIN_VERSION, authorization},
      redirect: 'manual',
    });
    if (check.status !== 200) return forbidden();
    await check.body?.cancel();
  }
  const body = request.body ? await request.arrayBuffer() : null;
  if (body?.byteLength > 20_000_000) return secureResponse(null, 413);
  if (/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '') && body) {
    try {
      const payload = JSON.parse(new TextDecoder().decode(body));
      if (!payload || typeof payload !== 'object') return secureResponse(null, 400);
      if (!scopesAreValid(Object.entries(payload))) return forbidden();
    } catch {
      return secureResponse(null, 400);
    }
  }
  return forward(url, request, env, fetcher, body);
}

export async function handle(request, env, fetcher = fetch, context) {
  const url = new URL(request.url);
  const { pathname } = url;
  if (url.hostname !== productionHost) return secureResponse(null, 404);

  if (pathname === '/teacher' || formerTeacherRoutes.test(pathname) || url.searchParams.get('preview') === 'teacher') {
    return Response.redirect(url.origin + '/login/dawon', 302);
  }
  if (pathname === '/dawon-module-probe.mjs') return secureResponse('if (!import.meta.resolve) throw Error("import.meta.resolve not supported");', 200, 'text/javascript; charset=utf-8');
  if (pathname === linkedNavPath) return secureResponse(navigation, 200, 'application/javascript; charset=utf-8');
  if (pathname === '/version.json') {
    return secureResponse(JSON.stringify({
      name: 'dawon-learning-room',
      revision: legacyRevision,
      version: env.ADMIN_VERSION,
      teacherVersion: env.ADMIN_VERSION,
      roles: ['teacher', 'student', 'guardian'],
      productionApi: false,
    }), 200);
  }
  if (/%(?:2f|5c|2e)/i.test(pathname)) return secureResponse(null, 404);

  try {
    if (['/favicon.svg', '/vite.svg'].includes(pathname)) {
      return forward(new URL('/dawon-brand.svg', url), request, env, fetcher);
    }
    if (pathname.startsWith('/api/v1/')) return await handleApi(request, url, env, fetcher);
    const isConsoleLogin = pathname === '/login/dawon' ||
      (pathname === '/login' && /(?:^|;\s*)dawon_console=1(?:;|$)/.test(request.headers.get('cookie') ?? ''));
    const isNative = isConsoleLogin || /^\/(?:workspace|student\/(?:attendance|exams|submit\/school-report))(?:\/|$)/.test(pathname) || ['/terms', '/privacy'].includes(pathname)
      || nativeFiles.has(pathname) || nativeAssetDirectories.some(prefix => pathname.startsWith(prefix));
    if (isNative) {
      if (!['GET', 'HEAD'].includes(request.method)) return secureResponse(null, 405);
      const immutableAsset = request.method === 'GET' && !request.headers.has('range') &&
        /^\/assets\/[a-zA-Z0-9._-]+-[a-zA-Z0-9_-]{8,}(?:-legacy)?\.(?:css|js|woff2|svg|png)$/.test(pathname);
      const edge = immutableAsset && globalThis.caches?.default;
      const cacheKey = edge && new Request(url.origin + pathname);
      if (edge) {
        const cached = await edge.match(cacheKey);
        if (cached) return cached;
      }
      let upstream = await forward(url, request, env, fetcher);
      for (const previous of ['dawon-review-20261119-orange-r9', 'dawon-review-20261119-orange-r8', 'dawon-review-20261119-orange-r7', 'dawon-review-20261119-orange-r4', 'dawon-review-20261119-orange-r3']) {
        if (upstream.status !== 404 || !pathname.startsWith('/assets/')) break;
        await upstream.body?.cancel();
        upstream = await forward(url, request, { ...env, ADMIN_VERSION: previous }, fetcher);
      }
      const headers = new Headers(upstream.headers);
      // Vite includes a second capability probe in each modern entry chunk.
      // Serve the equivalent same-origin module under the existing script policy.
      if (request.method === 'GET' && upstream.ok && /^\/assets\/(?:index|polyfills)-[A-Za-z0-9_-]+\.js$/.test(pathname) && !pathname.includes('-legacy-')) {
        const source = await upstream.text();
        const probe = /import'data:text\/javascript,"(assets\/[A-Za-z0-9._-]+)";if\(!import\.meta\.resolve\)throw Error\("import\.meta\.resolve not supported"\)'/;
        const body = source.replace(probe, (_, chunk) => "import'/dawon-module-probe.mjs?chunk=" + encodeURIComponent(chunk) + "'");
        for (const key of ['content-encoding','content-length','etag']) headers.delete(key);
        headers.set('cache-control','public, max-age=31536000, immutable');
        const response = new Response(body,{status:200,headers});
        if (edge && context) context.waitUntil(edge.put(cacheKey,response.clone()).catch(() => {}));
        return response;
      }
      if (immutableAsset && upstream.status === 200 && !headers.has('set-cookie') && !headers.get('content-type')?.includes('html')) {
        headers.set('cache-control','public, max-age=31536000, immutable');
        const response = new Response(upstream.body,{status:200,headers});
        if (edge && context) context.waitUntil(edge.put(cacheKey,response.clone()).catch(() => {}));
        return response;
      }
      if (headers.get('content-type')?.startsWith('text/html')) {
        headers.set('cache-control','no-store');
        headers.set('content-security-policy', nativePolicy);
        headers.append('set-cookie', consoleCookie);
        const isWorkspacePage = /^\/workspace(?:\/|$)/.test(pathname);
        if (request.method === 'GET' && upstream.ok) {
          for (const stale of ['content-encoding', 'content-length', 'etag']) headers.delete(stale);
          const original = await upstream.text();
          const branded = original.replace(modernProbe, '/dawon-module-probe.mjs')
            .replace('</head>', brandStyle(env.ADMIN_VERSION) + reloadScript(env.ADMIN_VERSION) + '</head>');
          const html = isConsoleLogin
            ? branded.replace(/<body[^>]*>/, start => start + loginNav)
            : isWorkspacePage ? branded.replace('</head>', workspaceStyle + '</head>') : branded;
          return new Response(html, {status: upstream.status, headers});
        }
      }
      return new Response(upstream.body, {status: upstream.status, headers});
    }

    const response = await learnerDemo.fetch(request);
    if (request.method !== 'GET' || !response.headers.get('content-type')?.startsWith('text/html')) return response;
    const headers = new Headers(response.headers);
    for (const stale of ['content-encoding', 'content-length', 'etag']) headers.delete(stale);
    headers.set('cache-control', 'no-store');
    headers.append('set-cookie', consoleCookieExpired);
    const html = (await response.text()).replace('</head>', `${brandStyle(env.ADMIN_VERSION)}${reloadScript(env.ADMIN_VERSION)}<script src="${linkedNavPath}" defer></script></head>`);
    return new Response(html, {status: response.status, headers});
  } catch {
    return secureResponse('{"detail":"다원 데모를 잠시 후 다시 열어 주세요."}', 503);
  }
}

export default {fetch: (request, env, context) => handle(request, env, fetch, context)};
