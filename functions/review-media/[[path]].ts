// The browser uses one origin for playlists and fragments. The API admits every
// request; Cloudflare streams the admitted fragment without sending video bytes through Django.
import { HOSTNAME_TO_TENANT_CODE } from "../../src/shared/tenant/tenants";

const apiOrigin = "https://api.hakwonplus.com";
const videoStorage = /^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/;
const noStore = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function proxyReviewMedia(request: Request, fetchUpstream: typeof fetch = fetch): Promise<Response> {
  const reject = (status: number) => new Response(null, { status, headers: noStore });
  if (request.method !== "GET" && request.method !== "HEAD") return reject(405);
  const url = new URL(request.url);
  const match = /^\/review-media\/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\/([a-zA-Z0-9._/-]+)$/.exec(url.pathname);
  const tenant = url.searchParams.get("tenant") ?? "";
  // The deployment artifact carries the same domain registry as the role app.
  // Never send a preview, localhost or unregistered host to production admission.
  if (url.protocol !== "https:" || url.port || url.hostname === "localhost" || url.hostname === "127.0.0.1"
      || !Object.hasOwn(HOSTNAME_TO_TENANT_CODE, url.hostname)
      || HOSTNAME_TO_TENANT_CODE[url.hostname] !== tenant || !match || url.searchParams.size !== 1) return reject(404);
  const [, stream, asset] = match;
  if (asset.split("/").some(part => !part || part === "." || part === "..")) return reject(404);
  const range = request.headers.get("Range");
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return reject(416);

  try {
    const admission = await fetchUpstream(`${apiOrigin}/api/v1/media/review-stream/${stream}/${asset}?tenant=${encodeURIComponent(tenant)}`, {
      headers: { "X-Tenant-Code": tenant }, redirect: "manual", cache: "no-store",
    });
    if (admission.status !== 302) {
      if (admission.status === 200 && asset.endsWith(".m3u8")) {
        return new Response(request.method === "HEAD" ? null : admission.body, {
          headers: { ...noStore, "Content-Type": "application/vnd.apple.mpegurl" },
        });
      }
      return new Response(null, { status: admission.status >= 400 ? admission.status : 502,
        headers: admission.status === 429 ? { ...noStore, "Retry-After": "1" } : noStore });
    }
    const target = new URL(admission.headers.get("Location") || "");
    if (asset.endsWith(".m3u8") || target.protocol !== "https:" || target.port || !videoStorage.test(target.hostname)
        || target.username || target.password || !/^\/academy-(?:video|development-artifacts)\/tenants\/[1-9]\d*\/video\/hls\/[1-9]\d*\//.test(target.pathname)
        || !target.pathname.endsWith(`/${asset}`) || !target.searchParams.has("X-Amz-Signature")) return reject(502);

    const fragment = await fetchUpstream(target.href, {
      method: "GET", headers: range ? { Range: range } : {}, redirect: "manual", cache: "no-store",
    });
    if (fragment.status !== 200 && fragment.status !== 206) return reject(fragment.status >= 400 ? fragment.status : 502);
    const headers = new Headers(noStore);
    for (const name of ["Content-Type", "Content-Length", "Content-Range", "Accept-Ranges"]) {
      const value = fragment.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (request.method === "HEAD") await fragment.body?.cancel();
    return new Response(request.method === "HEAD" ? null : fragment.body, { status: fragment.status, headers });
  } catch {
    return reject(502);
  }
}

export const onRequest = (context: { request: Request }) => proxyReviewMedia(context.request);
