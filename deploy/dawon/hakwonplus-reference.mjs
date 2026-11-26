import { insertDemoSwitcher, referenceOrigin, referenceSwitcherScript } from "./dawon-demo-header.mjs";

const privateApi = "https://dawon-review-origin.hakwonplus.com/__reference";
const policy = "default-src 'self'; script-src 'self' 'unsafe-inline' data: blob: https://www.youtube.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; media-src 'self' blob: https:; connect-src 'self'; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

function reply(body, status, type = "application/json; charset=utf-8") {
  return new Response(body, { status, headers: { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

// The WSGI service uses Content-Length when reading normal JSON and form updates.
// Give fetch a fixed-size body, including when the browser sent it chunked.
const maxFormBytes = 2621440;
async function formBody(request) {
  if (!request.body) return undefined;
  if (Number(request.headers.get("content-length")) > maxFormBytes) throw new RangeError();
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxFormBytes) {
        await reader.cancel();
        throw new RangeError();
      }
      chunks.push(value);
    }
    return new Blob(chunks);
  } finally { reader.releaseLock(); }
}

export async function serveReferenceApi(request, env, fetcher = fetch) {
  const url = new URL(request.url);
  if (url.origin !== referenceOrigin || !url.pathname.startsWith("/api/v1/")) return reply(null, 404);
  if (!["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE"].includes(request.method)) return reply(null, 405);
  const read = ["GET", "HEAD"].includes(request.method);
  const origin = request.headers.get("origin");
  const tenant = request.headers.get("x-tenant-code");
  if (((origin !== null || !read) && origin !== referenceOrigin) || (tenant && tenant !== "hakwonplus")) return reply(null, 403);
  if (!env.ORIGIN_KEY) return reply(null, 503);
  const headers = new Headers({ "X-Dawon-Review-Origin": env.ORIGIN_KEY });
  for (const name of ["authorization", "accept", "content-type", "idempotency-key", "range"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    let body;
    if (!read) {
      try { body = await formBody(request); }
      catch (error) {
        if (error instanceof RangeError) return reply('{"detail":"한 번에 저장하는 입력량을 줄여 다시 시도해 주세요."}', 413);
        throw error;
      }
    }
    const upstream = await fetcher(privateApi + url.pathname + url.search, {
      method: request.method, headers, body, redirect: "manual", cache: "no-store",
    });
    if (upstream.status >= 300 && upstream.status < 400) return reply(null, 502);
    if (upstream.ok && upstream.headers.get("x-tenant-id") !== "849") return reply(null, 502);
    const resultHeaders = new Headers({ "cache-control": "private, no-store", "x-content-type-options": "nosniff" });
    for (const name of ["content-type", "content-disposition", "content-range", "x-tenant-id", "retry-after"]) {
      const value = upstream.headers.get(name);
      if (value) resultHeaders.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers: resultHeaders });
  } catch {
    return reply('{"detail":"예시 학원을 불러오지 못했습니다. 다시 시도해 주세요."}', 503);
  }
}

export async function serveReference(request, env, fetcher = fetch) {
  const url = new URL(request.url);
  if (url.origin !== referenceOrigin || url.pathname.startsWith("/api/")) return reply(null, 404);
  if (!["GET", "HEAD"].includes(request.method)) return reply(null, 405);

  const head = request.method === "HEAD";
  if (url.pathname === "/dawon-demo-role.js") return reply(head ? null : referenceSwitcherScript, 200, "text/javascript; charset=utf-8");
  if (["/sw.js", "/teacher-sw.js"].includes(url.pathname)) {
    return reply(head ? null : "self.addEventListener('install',()=>self.skipWaiting())", 200, "text/javascript; charset=utf-8");
  }
  const staticOrigin = env.REFERENCE_STATIC_ORIGIN || "";
  if (!/^https:\/\/[a-f0-9]{8,32}\.dawon-original-reference\.pages\.dev$/.test(staticOrigin)) return reply(null, 503);
  const document = url.pathname === "/" || /^\/(?:login|workspace|terms|privacy)(?:\/|$)/.test(url.pathname) ||
    (request.headers.get("accept")?.includes("text/html") && !url.pathname.includes("."));
  const sheet = url.pathname === "/omr-sheet.html";
  const path = document ? "/" : sheet ? "/omr-sheet" : url.pathname;
  try {
    const upstream = await fetcher(staticOrigin + path, { method: request.method, redirect: "manual" });
    const type = upstream.headers.get("content-type") || "";
    if (!upstream.ok || Boolean(document || sheet) !== type.includes("text/html")) return reply(null, 404);
    const headers = new Headers({ "content-type": type, "referrer-policy": "no-referrer", "x-content-type-options": "nosniff",
      "cache-control": path.startsWith("/assets/") ? "public,max-age=31536000,immutable" : "no-store" });
    if (document || sheet) headers.set("content-security-policy", policy);
    const body = head ? null : document ? insertDemoSwitcher(await upstream.text(), url, true) : upstream.body;
    return new Response(body, { status: 200, headers });
  } catch {
    return reply('{"detail":"원본 화면을 불러오지 못했습니다. 다시 시도해 주세요."}', 503);
  }
}
