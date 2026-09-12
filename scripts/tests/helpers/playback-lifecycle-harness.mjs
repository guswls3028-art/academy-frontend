import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import axios from 'axios';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const token = (seconds = 120) => `unit.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds })).toString('base64url')}.signature`;
export const tick = () => new Promise((resolve) => setImmediate(resolve));
export async function settle() { for (let index = 0; index < 12; index++) await tick(); }

export function harness(options = {}) {
  let envelope = { access: token(options.expiresIn ?? 120), refresh: 'unit-refresh', generation: 'generation-a' };
  let support = options.support ?? false;
  let supportAccess = token(options.expiresIn ?? 120);
  const window = new EventTarget();
  window.location = { pathname: '/student/video/play', hostname: 'unit.invalid', href: '' };
  const document = new EventTarget();
  document.hidden = false;
  const timers = new Map();
  let timerOrdinal = 0;
  window.setTimeout = (callback) => { timers.set(++timerOrdinal, callback); return timerOrdinal; };
  window.clearTimeout = (id) => timers.delete(id);
  const counts = { refresh: 0, clear: 0, supportEnd: 0, apiError: 0 };
  const requests = [];
  const cache = new Map();
  let api;
  const importMocks = {
    axios: { ...axios, __esModule: true, default: { ...axios, create: axios.create, post: async () => {
      counts.refresh++;
      return options.refresh ? options.refresh() : { data: { access: token(120), refresh: 'rotated-refresh' } };
    } } },
    '@/shared/api/parentStudentSelection': { getParentStudentId: () => options.parentId ?? null },
    '@/shared/ui/asyncStatus/asyncStatusStore': { asyncStatusStore: { trackRequest: () => 'unit-request', completeTask() {} } },
    '@/shared/tenant': { getTenantCodeForApiRequest: () => 'unit-tenant' },
    '@/shared/lib/sentryContext': { captureApiError: () => counts.apiError++ },
    '@/shared/utils/safeSessionStorage': { getSessionItem: () => null, removeSessionItem() {}, setSessionItem() {} },
    '@/shared/auth/tokenSession': {
      AuthTokenStorageError: class AuthTokenStorageError extends Error {},
      readAuthTokenEnvelope: () => envelope, readAuthTokenEnvelopeSafely: () => envelope,
      clearAuthTokenEnvelope: () => { counts.clear++; envelope = null; }, notifyAuthTokenStorageError() {},
      withAuthSessionLock: (operation) => Promise.resolve().then(operation),
      publishRefreshedTokenEnvelope: (generation, refresh, access, rotatedRefresh) => {
        if (envelope?.generation !== generation || envelope.refresh !== refresh) return null;
        envelope = { generation, access, refresh: rotatedRefresh }; return envelope;
      },
    },
    '@/shared/auth/supportPreviewSession': {
      isStudentSupportWindow: () => support, getStudentSupportAccessToken: () => supportAccess,
      endStudentSupportSession: () => { counts.supportEnd++; supportAccess = null; },
    },
    '../design/utils': { clamp: (value, min, max) => Math.min(max, Math.max(min, value)), getEpochSec: () => Date.now() / 1000 },
    '../playbackUrl': { resolveStudentVideoPlayUrl: (value) => value },
    '@/shared/media/video/youtube': { extractYouTubeVideoId: () => 'unit-video' },
  };
  function load(relative) {
    const file = path.resolve(root, relative);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env', '__testEnv');
    const compiled = ts.transpileModule(source, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
    }, fileName: file }).outputText;
    vm.runInNewContext(compiled, {
      exports: module.exports, module, __testEnv: { VITE_API_BASE_URL: 'https://unit.invalid' },
      require(specifier) {
        if (importMocks[specifier]) return importMocks[specifier];
        if (specifier === '@/shared/api/axios') return load('src/shared/api/axios.ts');
        if (specifier === '@student/shared/api/student.api') return load('src/app_student/shared/api/student.api.ts');
        if (specifier.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(file), `${specifier}.ts`)));
        throw new Error(`Unmocked import: ${specifier}`);
      },
      window, document, console, atob, URL, setInterval: () => 1, clearInterval() {},
      setTimeout: window.setTimeout, clearTimeout: window.clearTimeout,
    }, { filename: file });
    return module.exports;
  }
  const exports = load('src/shared/api/axios.ts');
  api = exports.default;
  // Real axios fetch adapter with a closed in-memory transport: no sockets/providers.
  api.defaults.adapter = 'fetch';
  api.defaults.env = { ...api.defaults.env, Request, Response, fetch: async (request) => {
    const body = await request.clone().json().catch(() => null);
    const record = { path: new URL(request.url).pathname, headers: request.headers, keepalive: request.keepalive, body };
    requests.push(record);
    const response = options.respond ? await options.respond(record) : { status: 200, body: { ok: true } };
    return new Response(JSON.stringify(response.body), { status: response.status, headers: { 'content-type': 'application/json' } });
  } };
  const studentApi = load('src/app_student/shared/api/student.api.ts').default;
  return {
    api, studentApi, exports, load, window, document, counts, requests,
    envelope: () => envelope, replaceEnvelope: (value) => { envelope = value; },
    setSupport: (value) => { support = value; }, setSupportAccess: (value) => { supportAccess = value; },
    fireTimers: () => { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach((callback) => callback()); },
    pagehide: (persisted = false) => window.dispatchEvent(Object.assign(new Event('pagehide'), { persisted })),
    controller(kind, playbackToken = 'signed-playback-a') {
      const name = kind === 'hls' ? 'StudentHlsController' : 'StudentYoutubeController';
      const Controller = load(`src/app_student/domains/video/playback/player/headless/${name}.ts`)[name];
      const controller = new Controller({ videoId: 1, enrollmentId: 2, playUrl: '', token: playbackToken,
        policy: { access_mode: 'PROCTORED_CLASS', monitoring_enabled: true } });
      controller.startDocListeners();
      return controller;
    },
  };
}
