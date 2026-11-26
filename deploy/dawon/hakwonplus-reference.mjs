import { insertDemoSwitcher, referenceOrigin, referenceSwitcherScript } from "./dawon-demo-header.mjs";

const policy = "default-src 'self'; script-src 'self' 'unsafe-inline' data: blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

function reply(body, status, type = "application/json; charset=utf-8") {
  return new Response(body, { status, headers: { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff" } });
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
  const path = document ? "/index.html" : url.pathname;
  try {
    const upstream = await fetcher(staticOrigin + path, { method: request.method, redirect: "manual" });
    const type = upstream.headers.get("content-type") || "";
    if (!upstream.ok || Boolean(document) !== type.includes("text/html")) return reply(null, 404);
    const headers = new Headers({ "content-type": type, "referrer-policy": "no-referrer", "x-content-type-options": "nosniff",
      "cache-control": path.startsWith("/assets/") ? "public,max-age=31536000,immutable" : "no-store" });
    if (document) headers.set("content-security-policy", policy);
    const body = head ? null : document ? insertDemoSwitcher(await upstream.text(), url, true) : upstream.body;
    return new Response(body, { status: 200, headers });
  } catch {
    return reply('{"detail":"원본 화면을 불러오지 못했습니다. 다시 시도해 주세요."}', 503);
  }
}
