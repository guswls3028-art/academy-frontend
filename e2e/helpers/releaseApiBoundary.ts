import type { APIRequestContext, BrowserContext, Frame, Request } from "@playwright/test";

export type ReleaseBoundary = {
  mode: "readonly" | "development";
  apiOrigin: string;
  webOrigin: string;
  tenantCode: string;
  omrR2TenantId?: number;
};

const DEVELOPMENT_OMR_R2_ORIGIN = "https://af4f2937d73db240e99864b8518265c5.r2.cloudflarestorage.com";
const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PPTX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const PUBLIC_VIDEO_PROVIDERS = ["youtube.com", "youtube-nocookie.com", "ytimg.com", "googlevideo.com",
  "gstatic.com", "google.com", "googleapis.com", "googleusercontent.com", "ggpht.com",
  "doubleclick.net", "googlesyndication.com", "googleadservices.com"] as const;

function registerPublicVideoSources(payload: unknown, ids: Set<string>): void {
  if (!isRecord(payload)) return;
  const sources = [payload, payload.hero, payload.video,
    ...(Array.isArray(payload.results) ? payload.results.slice(0, 12) : [])];
  for (const source of sources) {
    if (!isRecord(source) || typeof source.youtube_video_id !== "string"
      || !/^[A-Za-z0-9_-]{11}$/.test(source.youtube_video_id)) continue;
    const id = source.youtube_video_id;
    if (source.canonical_url === `https://www.youtube.com/watch?v=${id}`
      && ["", `https://i.ytimg.com/vi/${id}/hqdefault.jpg`].includes(String(source.thumbnail_url))) ids.add(id);
  }
}

function exactPublicVideoEmbed(boundary: ReleaseBoundary, rawUrl: string, ids: Set<string>): boolean {
  const url = new URL(rawUrl);
  const match = /^\/embed\/([A-Za-z0-9_-]{11})$/.exec(url.pathname);
  return boundary.mode === "development" && url.origin === "https://www.youtube.com"
    && !url.username && !url.password && !url.hash && !!match && ids.has(match[1])
    && [...url.searchParams.keys()].sort().join(",") === "autoplay,origin,playsinline"
    && url.searchParams.get("autoplay") === "0" && url.searchParams.get("playsinline") === "1"
    && url.searchParams.get("origin") === boundary.webOrigin;
}

function publicVideoRequestKind(boundary: ReleaseBoundary, rawUrl: string, method: string,
  resourceType: string, ids: Set<string>, trustedPlayerFrame: boolean): "thumbnail" | "embed" | "player" | null {
  if (boundary.mode !== "development") return null;
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.port || url.username || url.password || url.hash) return null;
  const thumbnail = /^\/vi\/([A-Za-z0-9_-]{11})\/hqdefault\.jpg$/.exec(url.pathname);
  if (method === "GET" && resourceType === "image" && url.origin === "https://i.ytimg.com"
    && !url.search && thumbnail && ids.has(thumbnail[1])) return "thumbnail";
  if (method === "GET" && resourceType === "document" && exactPublicVideoEmbed(boundary, rawUrl, ids)) return "embed";
  // Only Google's actual embedded player frame may contact its public providers.
  // The application and direct APIRequestContext retain the original fail-closed boundary.
  if (trustedPlayerFrame && ["GET", "HEAD", "OPTIONS", "POST"].includes(method)
    && PUBLIC_VIDEO_PROVIDERS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) return "player";
  return null;
}

type InventoryOriginal = { r2Key: string; name: string; contentType: string; sizeBytes: number };

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase());
}

function inventoryDisposition(name: string): string {
  const safeName = [...name].filter((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
    .join("").replaceAll('"', "").replaceAll("\\", "_");
  const ascii = [...safeName].every((char) => char.charCodeAt(0) < 128);
  return `attachment; filename="${ascii ? safeName : "download"}"`
    + (ascii ? "" : "; filename*=UTF-8''" + encodeRfc3986(safeName));
}

function isExactInventoryOriginalDownload(boundary: ReleaseBoundary, rawUrl: string, file: InventoryOriginal): boolean {
  if (boundary.mode !== "development") return false;
  const target = new URL(rawUrl);
  if (target.origin !== DEVELOPMENT_OMR_R2_ORIGIN || target.username || target.password || target.hash
    || rawUrl !== target.origin + target.pathname + target.search
    || target.pathname !== "/academy-development-artifacts/" + file.r2Key.split("/").map(encodeRfc3986).join("/")
    || target.searchParams.getAll("response-content-type").length !== 1
    || target.searchParams.get("response-content-type") !== file.contentType
    || target.searchParams.getAll("response-content-disposition").length !== 1
    || target.searchParams.get("response-content-disposition") !== inventoryDisposition(file.name)) return false;
  target.searchParams.delete("response-content-type");
  target.searchParams.delete("response-content-disposition");
  return hasExactHostSignature(target, 3600);
}

export function isExactDevelopmentConversionAsset(boundary: ReleaseBoundary, rawUrl: string, conversionId: string,
  filename: string, contentType: string): boolean {
  if (boundary.mode !== "development" || !UUID.test(conversionId) || !Number.isSafeInteger(boundary.omrR2TenantId)
    || Number(boundary.omrR2TenantId) < 1 || !["image/png", "image/jpeg", "application/hwp+zip", "application/zip"].includes(contentType)) return false;
  const target = new URL(rawUrl);
  const prefix = `/academy-development-artifacts/tenants/${boundary.omrR2TenantId}/tools/problem-studio/conversions/${conversionId}/`;
  const suffix = target.pathname.slice(prefix.length);
  if (target.origin !== DEVELOPMENT_OMR_R2_ORIGIN || target.username || target.password || target.hash
    || !target.pathname.startsWith(prefix) || rawUrl !== target.origin + target.pathname + target.search
    || !(suffix === "sources.zip" && filename === "원본.zip" && contentType === "application/zip"
      || /^[0-9a-f]{20}\//.test(suffix) && suffix.slice(21) === encodeRfc3986(filename) && !filename.includes("/"))
    || target.searchParams.getAll("response-content-type").length !== 1
    || target.searchParams.get("response-content-type") !== contentType
    || target.searchParams.getAll("response-content-disposition").length !== 1
    || target.searchParams.get("response-content-disposition") !== inventoryDisposition(filename)) return false;
  target.searchParams.delete("response-content-type"); target.searchParams.delete("response-content-disposition");
  return hasExactHostSignature(target, 900);
}

function isExactDevelopmentPptDownload(
  boundary: ReleaseBoundary, rawUrl: string, filename: string,
): boolean {
  if (boundary.mode !== "development" || !Number.isSafeInteger(boundary.omrR2TenantId)
    || Number(boundary.omrR2TenantId) < 1) return false;
  const target = new URL(rawUrl);
  if (target.origin !== DEVELOPMENT_OMR_R2_ORIGIN || target.username || target.password || target.hash
    || rawUrl !== target.origin + target.pathname + target.search) return false;
  const match = new RegExp("^/academy-development-artifacts/tenants/" + boundary.omrR2TenantId
    + "/tools/ppt/([a-f0-9]{12})\\.pptx$").exec(target.pathname);
  if (!match || filename !== "presentation_" + match[1] + ".pptx"
    || target.searchParams.getAll("response-content-type").length !== 1
    || target.searchParams.get("response-content-type") !== PPTX_CONTENT_TYPE
    || target.searchParams.getAll("response-content-disposition").length !== 1
    || target.searchParams.get("response-content-disposition") !== 'attachment; filename="' + filename + '"') return false;
  const unsigned = new URL(target);
  unsigned.searchParams.delete("response-content-type");
  unsigned.searchParams.delete("response-content-disposition");
  return hasExactHostSignature(unsigned, 3600);
}

function isExactDevelopmentPayrollDownload(
  boundary: ReleaseBoundary, rawUrl: string, jobId: string, filename: string,
): boolean {
  if (boundary.mode !== "development" || !Number.isSafeInteger(boundary.omrR2TenantId)
    || Number(boundary.omrR2TenantId) < 1 || !UUID.test(jobId)) return false;
  const target = new URL(rawUrl);
  if (target.origin !== DEVELOPMENT_OMR_R2_ORIGIN || target.username || target.password || target.hash
    || rawUrl !== target.origin + target.pathname + target.search
    || target.pathname !== `/academy-development-artifacts/exports/${boundary.omrR2TenantId}/${jobId}_${filename}`
    || target.searchParams.getAll("response-content-type").length !== 1
    || target.searchParams.get("response-content-type") !== XLSX_CONTENT_TYPE
    || target.searchParams.getAll("response-content-disposition").length !== 1
    || target.searchParams.get("response-content-disposition") !== 'attachment; filename="' + filename + '"; filename*=UTF-8\'\'' + filename) return false;
  const unsigned = new URL(target);
  unsigned.searchParams.delete("response-content-type");
  unsigned.searchParams.delete("response-content-disposition");
  return hasExactHostSignature(unsigned, 3600);
}

function isExactDevelopmentResourceDownload(boundary: ReleaseBoundary, rawUrl: string, fileId: string): boolean {
  if (boundary.mode !== "development" || !UUID.test(fileId) || !Number.isSafeInteger(boundary.omrR2TenantId)
    || Number(boundary.omrR2TenantId) < 1) return false;
  const target = new URL(rawUrl);
  return target.origin === DEVELOPMENT_OMR_R2_ORIGIN && !target.username && !target.password && !target.hash
    && rawUrl === `${target.origin}${target.pathname}${target.search}`
    && target.pathname === `/academy-development-artifacts/landing-public/resources/${boundary.omrR2TenantId}/${fileId}`
    && hasExactHostSignature(target, 300);
}

function isExactDevelopmentResourceReaderAsset(boundary: ReleaseBoundary, rawUrl: string, fileId: string): boolean {
  if (isExactDevelopmentResourceDownload(boundary, rawUrl, fileId)) return true;
  if (boundary.mode !== "development" || !UUID.test(fileId) || !Number.isSafeInteger(boundary.omrR2TenantId)
    || Number(boundary.omrR2TenantId) < 1) return false;
  const target = new URL(rawUrl);
  const prefix = `/academy-development-artifacts/landing-public/resources/${boundary.omrR2TenantId}/${fileId}/reader/`;
  return target.origin === DEVELOPMENT_OMR_R2_ORIGIN && !target.username && !target.password && !target.hash
    && rawUrl === `${target.origin}${target.pathname}${target.search}` && target.pathname.startsWith(prefix)
    && /^[0-9a-f-]{36}\/(?:image-\d+\.(?:webp|gif|png)|pages\.pdf)$/.test(target.pathname.slice(prefix.length))
    && UUID.test(target.pathname.slice(prefix.length).split("/")[0]) && hasExactHostSignature(target, 300);
}

function isExactDevelopmentOmrImage(boundary: ReleaseBoundary, rawUrl: string, method: string): boolean {
  if (boundary.mode !== "development" || method !== "GET"
    || !Number.isSafeInteger(boundary.omrR2TenantId) || Number(boundary.omrR2TenantId) < 1) return false;
  const target = new URL(rawUrl);
  if (target.origin !== DEVELOPMENT_OMR_R2_ORIGIN || target.username || target.password || target.hash
    // Compare the raw path too: URL parsing normalizes dot segments before policy checks.
    || rawUrl !== `${target.origin}${target.pathname}${target.search}`) return false;
  const path = new RegExp(`^/academy-development-artifacts/tenants/${boundary.omrR2TenantId}/ai/submissions/([1-9][0-9]*)/aligned/([0-9a-f-]+)\\.jpg$`).exec(target.pathname);
  if (!path || !Number.isSafeInteger(Number(path[1])) || !UUID.test(path[2])) return false;
  return hasExactHostSignature(target, 21600);
}

function hasExactHostSignature(target: URL, maxExpires: number): boolean {
  const query = target.searchParams;
  const keys = ["X-Amz-Algorithm", "X-Amz-Credential", "X-Amz-Date", "X-Amz-Expires", "X-Amz-SignedHeaders", "X-Amz-Signature"];
  if ([...query.keys()].length !== keys.length || keys.some((key) => query.getAll(key).length !== 1)
    || query.get("X-Amz-Algorithm") !== "AWS4-HMAC-SHA256" || query.get("X-Amz-SignedHeaders") !== "host"
    || !/^[0-9a-f]{64}$/.test(query.get("X-Amz-Signature") ?? "")) return false;
  const date = query.get("X-Amz-Date") ?? "";
  if (!/^[0-9]{8}T[0-9]{6}Z$/.test(date)) return false;
  const isoDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${date.slice(9, 11)}:${date.slice(11, 13)}:${date.slice(13, 15)}.000Z`;
  if (Number.isNaN(Date.parse(isoDate)) || new Date(isoDate).toISOString() !== isoDate) return false;
  const credential = /^([A-Za-z0-9]{16,128})\/([0-9]{8})\/auto\/s3\/aws4_request$/.exec(query.get("X-Amz-Credential") ?? "");
  const expires = query.get("X-Amz-Expires") ?? "";
  return credential?.[2] === date.slice(0, 8) && /^[1-9][0-9]*$/.test(expires) && Number(expires) <= maxExpires;
}

function isExactDevelopmentHomeworkImage(boundary: ReleaseBoundary, rawUrl: string, mediaId: string, contentType: string): boolean {
  const extension = ({ "image/png": "png", "image/heic": "heic", "image/heif": "heif" } as Record<string, string>)[contentType];
  if (!extension) return false;
  if (boundary.mode !== "development" || !Number.isSafeInteger(boundary.omrR2TenantId)
    || Number(boundary.omrR2TenantId) < 1 || !Number.isSafeInteger(Number(mediaId))) return false;
  const target = new URL(rawUrl);
  if (target.origin !== DEVELOPMENT_OMR_R2_ORIGIN || target.username || target.password || target.hash
    || rawUrl !== `${target.origin}${target.pathname}${target.search}`) return false;
  const path = new RegExp(`^/academy-development-artifacts/tenants/${boundary.omrR2TenantId}/ai/submissions/([1-9][0-9]*)/media-${mediaId}-[0-9a-f]{32}\\.${extension}$`).exec(target.pathname);
  return Boolean(path && Number.isSafeInteger(Number(path[1])) && hasExactHostSignature(target, 600));
}

function isExactDevelopmentHomeworkVideo(boundary: ReleaseBoundary, rawUrl: string, mediaId: string, compatible: boolean): boolean {
  if (boundary.mode !== "development" || !Number.isSafeInteger(boundary.omrR2TenantId)
    || Number(boundary.omrR2TenantId) < 1 || !Number.isSafeInteger(Number(mediaId))) return false;
  const target = new URL(rawUrl);
  if (target.origin !== DEVELOPMENT_OMR_R2_ORIGIN || target.username || target.password || target.hash
    || rawUrl !== `${target.origin}${target.pathname}${target.search}`) return false;
  const filename = compatible ? "preview-[0-9a-f]{32}-[0-9a-f]{32}" : `media-${mediaId}-[0-9a-f]{32}`;
  const path = new RegExp(`^/academy-development-artifacts/tenants/${boundary.omrR2TenantId}/ai/submissions/([1-9][0-9]*)/${filename}\\.mp4$`).exec(target.pathname);
  return Boolean(path && Number.isSafeInteger(Number(path[1])) && hasExactHostSignature(target, 600));
}

function isExactDevelopmentCommunityAttachment(
  boundary: ReleaseBoundary, rawUrl: string, postId: number, contentType: string, downloadName?: string,
): boolean {
  if (boundary.mode !== "development" || !Number.isSafeInteger(boundary.omrR2TenantId)
    || Number(boundary.omrR2TenantId) < 1 || !Number.isSafeInteger(postId) || postId < 1
    || !["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain"].includes(contentType)
    || (!contentType.startsWith("image/") && downloadName === undefined)) return false;
  const target = new URL(rawUrl);
  if (target.origin !== DEVELOPMENT_OMR_R2_ORIGIN || target.username || target.password || target.hash
    || rawUrl !== `${target.origin}${target.pathname}${target.search}`) return false;
  const path = new RegExp(`^/academy-development-artifacts/tenants/${boundary.omrR2TenantId}/community/posts/${postId}/uploads/[A-Za-z0-9_-]{16,80}/[0-9]_[0-9a-f]{16}_[0-9a-f]{8}_[^/]+\\.(png|jpg|jpeg|webp|pdf|txt)$`, "i").exec(target.pathname);
  if (!path) return false;
  const extensionType = path[1].toLowerCase() === "png" ? "image/png"
    : path[1].toLowerCase() === "webp" ? "image/webp"
    : path[1].toLowerCase() === "pdf" ? "application/pdf"
    : path[1].toLowerCase() === "txt" ? "text/plain" : "image/jpeg";
  if (extensionType !== contentType || target.searchParams.getAll("response-content-type").length !== 1
    || target.searchParams.get("response-content-type") !== contentType) return false;
  if (downloadName === undefined) {
    if (target.searchParams.has("response-content-disposition")) return false;
  } else if (target.searchParams.getAll("response-content-disposition").length !== 1
    || target.searchParams.get("response-content-disposition") !== inventoryDisposition(downloadName)) {
    return false;
  }
  const unsignedType = new URL(target);
  unsignedType.searchParams.delete("response-content-type");
  unsignedType.searchParams.delete("response-content-disposition");
  return hasExactHostSignature(unsignedType, 3600);
}

function isExactPublicTenantMetadataRead(boundary: ReleaseBoundary, target: URL, verb: string): boolean {
  return verb === "GET"
    && target.pathname === "/api/v1/core/og-meta/"
    && [...target.searchParams.keys()].length === 1
    && target.searchParams.getAll("hostname").length === 1
    && target.searchParams.get("hostname") === new URL(boundary.webOrigin).hostname;
}

function developmentPublicPhotoType(boundary: ReleaseBoundary, rawUrl: string): "image/png" | "image/jpeg" | "image/webp" | undefined {
  if (boundary.mode !== "development" || !Number.isSafeInteger(boundary.omrR2TenantId) || Number(boundary.omrR2TenantId) < 1) return;
  let target: URL;
  try { target = new URL(rawUrl); } catch { return; }
  if (target.origin !== DEVELOPMENT_OMR_R2_ORIGIN || target.username || target.password || target.hash
    || rawUrl !== `${target.origin}${target.pathname}${target.search}` || !hasExactHostSignature(target, 604800)) return;
  const path = new RegExp(`^/academy-development-artifacts/landing-public/reviews/${boundary.omrR2TenantId}/users/[1-9][0-9]*/[a-f0-9]{64}\\.(png|jpg|jpeg|webp)$`).exec(target.pathname);
  return !path ? undefined : path[1] === "png" ? "image/png" : path[1] === "webp" ? "image/webp" : "image/jpeg";
}

function releaseRequestFailureCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("missing or foreign QA tenant")) return "tenant";
  if (message.includes("escaped the verified API boundary")) return "origin";
  if (message.includes("must use the verified API origin")) return "api-origin";
  if (message.includes("cannot contain credentials")) return "credentials";
  if (message.includes("observation payload")) return "observation-schema";
  if (message.includes("business mutation refused")) return "mutation";
  if (message.includes("redirect refused")) return "redirect";
  if (message.includes("CORS boundary mismatch")) return "cors";
  if (message === "Resource reader QA manifest limit") return "resource-manifest";
  if (message === "Resource reader asset escaped exact development scope") return "resource-scope";
  if (message === "Resource reader format is outside exact development scope") return "resource-format";
  if (message.startsWith("route.fetch: Request context disposed.")) return "context-disposed";
  return "transport";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_IN_PATH = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
const STABLE_ANALYTICS_ID = /^[a-z0-9][a-z0-9.-]{0,119}$/;
const ANALYTICS_EVENT_TYPES = new Set([
  "screen_view", "screen_engaged", "cta_impression", "cta_click",
  "task_start", "task_success", "task_failure",
]);
const ANALYTICS_EVENT_REQUIRED_KEYS = new Set([
  "event_id", "event_type", "occurred_at", "session_id", "view_id", "feature_id",
  "screen_id", "surface", "route_template", "device_class", "client_release",
  "catalog_version", "synthetic",
]);
const ANALYTICS_EVENT_OPTIONAL_KEYS = new Set([
  "interaction_id", "cta_id", "action_id", "placement_id", "position_index", "failure_category",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactReadonlyAnalyticsEventCount(
  boundary: ReleaseBoundary,
  target: URL,
  method: string,
  tenantCode: string | undefined,
  data: unknown,
  bodyBytes: number,
): number | null {
  if (boundary.mode !== "readonly" || target.origin !== boundary.apiOrigin
    || target.pathname !== "/api/v1/core/product-analytics/events/batch/"
    || target.search || target.hash || method.toUpperCase() !== "POST") return null;
  if (tenantCode !== boundary.tenantCode) return null;
  if (!isRecord(data)
    || !Number.isInteger(bodyBytes) || bodyBytes < 1 || bodyBytes > 64 * 1024
    || Object.keys(data).sort().join(",") !== "events,schema_version"
    || data.schema_version !== 1 || !Array.isArray(data.events)
    || data.events.length < 1 || data.events.length > 20) {
    throw new Error("Production observation payload is outside the reviewed analytics schema");
  }
  for (const event of data.events) {
    if (!isRecord(event)
      || Object.keys(event).some((key) => !ANALYTICS_EVENT_REQUIRED_KEYS.has(key) && !ANALYTICS_EVENT_OPTIONAL_KEYS.has(key))
      || [...ANALYTICS_EVENT_REQUIRED_KEYS].some((key) => !Object.hasOwn(event, key))
      || !UUID.test(String(event.event_id)) || !UUID.test(String(event.session_id)) || !UUID.test(String(event.view_id))
      || (event.interaction_id !== undefined && !UUID.test(String(event.interaction_id)))
      || !ANALYTICS_EVENT_TYPES.has(String(event.event_type))
      || typeof event.occurred_at !== "string" || Number.isNaN(Date.parse(event.occurred_at))
      || new Date(event.occurred_at).toISOString() !== event.occurred_at
      || Date.parse(event.occurred_at) < Date.now() - 24 * 60 * 60 * 1000
      || Date.parse(event.occurred_at) > Date.now() + 5 * 60 * 1000
      || !STABLE_ANALYTICS_ID.test(String(event.feature_id))
      || String(event.feature_id).length > 80
      || !STABLE_ANALYTICS_ID.test(String(event.screen_id))
      || String(event.screen_id).length > 100
      || !["admin", "teacher", "student"].includes(String(event.surface))
      || typeof event.route_template !== "string"
      || event.route_template.length > 180 || !event.route_template.startsWith("/")
      || event.route_template.includes("?") || event.route_template.includes("#") || event.route_template.includes("://")
      || UUID_IN_PATH.test(event.route_template) || /\/\d+(?:\/|$)/.test(event.route_template)
      || !["mobile", "tablet", "desktop"].includes(String(event.device_class))
      || typeof event.client_release !== "string" || !/^[A-Za-z0-9._-]{1,64}$/.test(event.client_release)
      || typeof event.catalog_version !== "string" || !/^[A-Za-z0-9._-]{1,32}$/.test(event.catalog_version)
      || typeof event.synthetic !== "boolean"
      || ["cta_id", "action_id", "placement_id"].some((key) => event[key] !== undefined
        && (!STABLE_ANALYTICS_ID.test(String(event[key])) || String(event[key]).length > 80))
      || (event.position_index !== undefined && (!Number.isInteger(event.position_index) || Number(event.position_index) < 0 || Number(event.position_index) > 32767))
      || (event.failure_category !== undefined && !["validation", "network", "permission", "server", "unknown"].includes(String(event.failure_category)))
      || (["cta_impression", "cta_click"].includes(String(event.event_type)) && (!event.cta_id || !event.placement_id))
      || (event.event_type === "cta_click" && !event.interaction_id)
      || (["task_start", "task_success", "task_failure"].includes(String(event.event_type)) && (!event.interaction_id || !event.action_id))
      || (event.event_type === "task_failure" && !event.failure_category)
      || (event.event_type !== "task_failure" && Boolean(event.failure_category))) {
      throw new Error("Production observation payload is outside the reviewed analytics schema");
    }
  }
  return data.events.length;
}

function isExactReadonlyCloudflareBeacon(boundary: ReleaseBoundary, target: URL, method: string): boolean {
  return boundary.mode === "readonly"
    && method.toUpperCase() === "GET"
    && target.origin === "https://static.cloudflareinsights.com"
    && /^\/beacon\.min\.js\/v[a-f0-9]{32,64}$/.test(target.pathname)
    && !target.search && !target.hash && !target.username && !target.password;
}

export function releaseBoundaryFromEnv(env: Record<string, string | undefined>): ReleaseBoundary | null {
  if (!env.E2E_RELEASE_API_MODE) return null;
  const mode = env.E2E_RELEASE_API_MODE;
  if (mode !== "readonly" && mode !== "development") throw new Error("Invalid release API mode");
  if (env.E2E_ALLOW_PRODUCTION_WRITES !== "0") throw new Error("Release production writes must be exactly 0");
  const api = new URL(env.E2E_API_URL || "");
  const web = new URL(env.E2E_BASE_URL || "");
  const tenantCode = env.E2E_TENANT_CODE || "";
  if (api.username || api.password || web.username || web.password) throw new Error("Release origins cannot contain credentials");
  if (mode === "development") {
    if (api.protocol !== "http:" || api.hostname !== "127.0.0.1" || web.origin !== "http://localhost:4173") {
      throw new Error("Development release canary requires owned loopback origins");
    }
    if (!/^qa-ymath-realuse-[a-z0-9-]+$/.test(tenantCode)) throw new Error("An exact disposable QA tenant is required");
  } else if (api.origin !== "https://api.hakwonplus.com" || web.origin !== "https://hakwonplus.com" || tenantCode !== "hakwonplus") {
    throw new Error("Production read-only canary requires exact production origins and tenant");
  }
  const omrTenant = env.E2E_OMR_R2_TENANT_ID;
  if (omrTenant !== undefined && (mode !== "development" || !/^[1-9][0-9]*$/.test(omrTenant)
    || !Number.isSafeInteger(Number(omrTenant)))) throw new Error("Invalid development OMR tenant scope");
  return { mode, apiOrigin: api.origin, webOrigin: web.origin, tenantCode,
    ...(omrTenant === undefined ? {} : { omrR2TenantId: Number(omrTenant) }) };
}

export function assertReleaseRequestSafe(
  boundary: ReleaseBoundary,
  url: string,
  method: string,
  tenantCode?: string,
  data?: unknown,
): "read" | "authentication" | "observation" | "development" {
  const target = new URL(url, boundary.webOrigin);
  const verb = method.toUpperCase();
  const read = ["GET", "HEAD", "OPTIONS"].includes(verb);
  const api = target.pathname.startsWith("/api/") || target.origin === boundary.apiOrigin;
  if (![boundary.apiOrigin, boundary.webOrigin].includes(target.origin)) {
    throw new Error("Release request escaped the verified API boundary");
  }
  if (api && target.origin !== boundary.apiOrigin) throw new Error("API request must use the verified API origin");
  if (target.username || target.password) throw new Error("Release request URL cannot contain credentials");
  const publicTenantMetadataRead = isExactPublicTenantMetadataRead(boundary, target, verb);
  if (target.pathname.startsWith("/api/") && verb !== "OPTIONS"
    && !publicTenantMetadataRead && tenantCode !== boundary.tenantCode) {
    throw new Error("Release request has a missing or foreign QA tenant");
  }
  if (!api && read) return "read";
  if (publicTenantMetadataRead) return "read";
  if (boundary.mode === "development") {
    return "development";
  }
  const authentication = verb === "POST"
    && ["/api/v1/token/", "/api/v1/token/refresh/"].includes(target.pathname);
  if (verb === "POST" && target.pathname === "/api/v1/students/me/activity/") {
    const payload = data as Record<string, unknown> | null;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)
      || Object.keys(payload).sort().join(",") !== "device_class,screen_id"
      || !["student.dashboard.home", "student.session.list", "student.grades.home", "student.guide.home", "student.assignment.submit"].some((screenId) => payload.screen_id === screenId)
      || !["desktop", "tablet", "mobile"].some((deviceClass) => payload.device_class === deviceClass)) {
      throw new Error("Production observation payload is outside the reviewed screen-view schema");
    }
    return "observation";
  }
  if (!read && !authentication) {
    // No payload, query string, token or recipient is included in diagnostics.
    const pathTemplate = safeRequestTransportPathTemplate(target.toString());
    throw new Error(`Production release business mutation refused: ${verb}${pathTemplate ? ` ${pathTemplate}` : ""}`);
  }
  return authentication ? "authentication" : "read";
}

export type ObservationCounts = { attempted: number; accepted: number };
export type RequestTransportCounts = { readFetchRetries: number; mutationReplays: number };
export type RequestTransportDiagnostic = {
  method: "GET" | "HEAD" | "OPTIONS" | "POST" | "PUT" | "PATCH" | "DELETE";
  pathTemplate: string;
  requestKind: "read" | "mutation";
  stage: "initial" | "retry";
  transportCode: "context-disposed" | "timeout" | "transport";
};

type NativeTransportCode = "ECONNRESET" | "ECONNREFUSED" | "EPIPE" | "ETIMEDOUT" | "timeout" | "context-disposed" | "other";
type NativeTransportKind = "socket-hang-up" | "response-aborted" | "decompression" | NativeTransportCode;
export type ReleaseObservationEvent = {
  phase: "route-fetch" | "route-fulfill" | "route-handler" | "api-request" | "browser-console" | "browser-pageerror"
    | "page-close" | "page-crash" | "context-close" | "browser-disconnected";
  stage: "initial" | "retry" | "recovered" | "terminal";
  method?: RequestTransportDiagnostic["method"] | "other";
  pathTemplate?: string | null;
  nativeCode?: NativeTransportCode;
  nativeKind?: NativeTransportKind;
  requestOrdinal?: number;
  requestStartedElapsedMs?: number;
  attemptDurationMs?: number;
  pageOrdinal?: number | null;
  startDocumentLoadOrdinal?: number | null;
  endDocumentLoadOrdinal?: number | null;
  startNavigationOrdinal?: number | null;
  endNavigationOrdinal?: number | null;
  category?: "cors" | "chunk" | "network" | "resource" | "runtime" | "other";
  sourceKind?: "local" | "api" | "vendor" | "unknown";
  externalOrigin?: {
    providerClass: typeof PUBLIC_VIDEO_PROVIDERS[number] | "other";
    resourceType: "document" | "image" | "script" | "stylesheet" | "font" | "media" | "xhr" | "fetch" | "other";
    frameExists: boolean; frameAdmitted: boolean; frameExactEmbed: boolean;
    trustedAncestor: boolean; frameDetached: boolean | null;
    protocol: "https" | "http" | "other";
    hasPort: boolean; hasHash: boolean; hasCredentials: boolean;
  };
};

export function safeNativeTransportCode(error: unknown): NativeTransportCode {
  const message = error instanceof Error ? error.message : "";
  const code = isRecord(error) && typeof error.code === "string" ? error.code : "";
  for (const candidate of ["ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT"] as const) {
    if (code === candidate || new RegExp(`\\b${candidate}\\b`).test(message)) return candidate;
  }
  const legacyCode = safeRequestTransportCode(error);
  return legacyCode === "transport" ? "other" : legacyCode;
}

export function safeNativeTransportKind(error: unknown): NativeTransportKind {
  // Playwright's wire Error preserves message/name, not Node's code/cause.
  // Classify the first line only: its call log may contain URLs and credentials.
  const firstLine = error instanceof Error ? error.message.split(/\r?\n/, 1)[0].trim() : "";
  if (/^(?:[A-Za-z.]+:\s*)?socket hang up$/i.test(firstLine)) return "socket-hang-up";
  if (/^(?:[A-Za-z.]+:\s*)?aborted$/i.test(firstLine)) return "response-aborted";
  if (/^(?:[A-Za-z.]+:\s*)?failed to decompress '(?:gzip|x-gzip|br|deflate)' encoding:/i.test(firstLine)) return "decompression";
  return safeNativeTransportCode(new Error(firstLine));
}

export function emitReleaseTestFailure(error: unknown, phase: "video-primary" | "context-check" | "assessment-copy" | "assessment-copy-cleanup",
  emit: (value: unknown) => void = (value) => console.log(JSON.stringify(value))) {
  const message = error instanceof Error ? error.message.split(/\r?\n/, 1)[0] : "";
  const kind = /Release API boundary failed:/.test(message) ? "boundary"
    : /expect\(|Expected values|AssertionError/.test(message) ? "assertion"
    : /locator\.[a-z]+:.*(?:Timeout|timeout)/.test(message) ? "locator-timeout"
    : safeNativeTransportKind(error) !== "other" ? "transport" : "other";
  // A toBe(403) could compare a score or ID. HTTP status is captured only at
  // an actual response boundary, never guessed from generic matcher values.
  emit({ releaseTestFailure: { schema: "release-test-failure/v1", phase, kind,
    expectedStatus: null, receivedStatus: null } });
}

// Mirrors the closed label vocabulary raised by SessionViewSet.destroy /
// LectureViewSet.destroy (apps/domains/lectures/views.py) via
// first_session_delete_blocker / first_lecture_delete_blocker
// (apps/support/lectures/view_dependencies.py). These are fixed English
// nouns describing which referential-integrity guard tripped -- never
// user content -- so they are safe to publish in evidence.
const SESSION_DELETE_BLOCKER_LABELS = new Set([
  "session enrollments", "attendance records", "exams", "homework enrollments",
  "homework assignments", "homeworks", "homework scores", "session progress",
  "lecture progress references", "clinic links", "risk logs", "videos",
  "video folders", "score edit drafts",
]);
const LECTURE_ONLY_DELETE_BLOCKER_LABELS = new Set([
  "lecture enrollments", "lecture progress", "clinic sessions", "section assignments",
]);

export function safeLectureSessionDeleteBlocker(body: unknown): string | null {
  const detail = isRecord(body) && typeof body.detail === "string" ? body.detail : "";
  const match = /^This (?:session|lecture) has (.+) and cannot be deleted\.$/.exec(detail);
  if (!match) return null;
  const label = match[1];
  if (SESSION_DELETE_BLOCKER_LABELS.has(label) || LECTURE_ONLY_DELETE_BLOCKER_LABELS.has(label)) return label;
  const sessionsWith = /^sessions with (.+)$/.exec(label);
  if (sessionsWith && SESSION_DELETE_BLOCKER_LABELS.has(sessionsWith[1])) return label;
  return null;
}

export function emitOmrCleanupStatus(stage: "remove" | "verify-absent" | "archive-action" | "verify-archive",
  expectedStatuses: number[], receivedStatus: number, blocker: string | null = null,
  emit: (value: unknown) => void = (value) => console.log(JSON.stringify(value))) {
  emit({ omrCleanupStatus: { schema: "release-omr-cleanup-status/v1", stage, expectedStatuses: [...expectedStatuses],
    receivedStatus: Number.isInteger(receivedStatus) && receivedStatus >= 100 && receivedStatus <= 599 ? receivedStatus : null,
    blocker: typeof blocker === "string" && (SESSION_DELETE_BLOCKER_LABELS.has(blocker)
      || LECTURE_ONLY_DELETE_BLOCKER_LABELS.has(blocker)
      || SESSION_DELETE_BLOCKER_LABELS.has(/^sessions with (.+)$/.exec(blocker)?.[1] ?? "")) ? blocker : null } });
}

let nextObservationOrdinal = 0;

export function createReleaseContextObservation(contextOrdinal: number | null,
  state: () => { closing: boolean; activeRouteCount: number } = () => ({ closing: false, activeRouteCount: 0 })) {
  const startedAt = Date.now();
  const pageStates = new WeakMap<object, { pageOrdinal: number; documentLoadOrdinal: number; navigationOrdinal: number }>();
  let snapshotSequence = 0;
  const data = {
    schema: "release-context-observation/v1" as const,
    observationOrdinal: ++nextObservationOrdinal,
    contextOrdinal,
    events: [] as Array<ReleaseObservationEvent & { elapsedMs: number; closing: boolean; activeRouteCount: number }>,
    droppedEventCount: 0,
    droppedRequestTransportDiagnosticCount: 0,
    unknownPathEventCounts: { "route-fetch": 0, "route-fulfill": 0, "api-request": 0 },
  };
  return {
    data,
    elapsedMs: () => Math.max(0, Date.now() - startedAt),
    setPageState(page: object, state: { pageOrdinal: number; documentLoadOrdinal: number; navigationOrdinal: number }) {
      pageStates.set(page, { ...state });
    },
    requestPageState(request: Request) {
      try { return pageStates.get(request.frame().page()) ?? null; }
      catch { return null; }
    },
    snapshot() {
      return {
        ...data,
        snapshotSequence: ++snapshotSequence,
        events: data.events.map((event) => ({ ...event })),
        unknownPathEventCounts: { ...data.unknownPathEventCounts },
      };
    },
    record(event: ReleaseObservationEvent) {
      if (event.pathTemplate === null && (event.phase === "route-fetch" || event.phase === "route-fulfill" || event.phase === "api-request")) {
        data.unknownPathEventCounts[event.phase] += 1;
      }
      if (data.events.length >= 128) { data.droppedEventCount += 1; return; }
      data.events.push({ ...event, elapsedMs: Math.max(0, Date.now() - startedAt), ...state() });
    },
    recordTransportDiagnostic(diagnostics: RequestTransportDiagnostic[], diagnostic: RequestTransportDiagnostic) {
      if (diagnostics.length < 128) diagnostics.push(diagnostic);
      else data.droppedRequestTransportDiagnosticCount += 1;
    },
  };
}

function safeTransportMethod(method: string): RequestTransportDiagnostic["method"] | "other" {
  return ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"].includes(method)
    ? method as RequestTransportDiagnostic["method"] : "other";
}

export type ReleaseContextGuard = {
  observations: ObservationCounts;
  authentication: ObservationCounts;
  transport: RequestTransportCounts & {
    suppressedAnalyticsBatches: number;
    suppressedAnalyticsEvents: number;
    suppressedCloudflareBeacons: number;
    closingAborts: number;
  };
  requestTransportDiagnostics: RequestTransportDiagnostic[];
  observation: ReturnType<typeof createReleaseContextObservation>;
  beginClose: () => Promise<void>;
  assertClean: () => void;
};

const installedContextGuards = new WeakMap<BrowserContext, {
  boundary: ReleaseBoundary;
  ready: Promise<ReleaseContextGuard>;
}>();
let nextContextOrdinal = 0;

const SAFE_REQUEST_TRANSPORT_STATIC_PATHS = new Set([
  "/api/v1/landing-public/resources/",
  "/api/v1/landing-public/resources/capabilities/",
  "/api/v1/landing-public/uploads/resource/",
  "/api/v1/clinic/idcard/",
  "/api/v1/clinic/participants/",
  "/api/v1/clinic/participants/bulk-create/",
  "/api/v1/clinic/participants/by_session/",
  "/api/v1/clinic/sessions/",
  "/api/v1/clinic/sessions/tree/",
  "/api/v1/clinic/sessions/locations/",
  "/api/v1/core/tenant/by-host/",
  "/api/v1/media/playback/end/",
  "/api/v1/media/playback/events/",
  "/api/v1/media/playback/v2/events/",
  "/api/v1/media/playback/v2/end/",
  "/api/v1/media/playback/heartbeat/",
  "/api/v1/media/playback/refresh/",
  "/api/v1/media/playback/renew/",
  "/api/v1/media/playback/start/",
  "/api/v1/storage/inventory/",
  "/api/v1/storage/inventory/upload/",
  "/api/v1/student/video/me/",
  "/api/v1/students/me/activity/",
  "/api/v1/students/me/activity/homework-open/",
  "/api/v1/token/",
  "/api/v1/token/refresh/",
  "/clinic/participants/",
  "/clinic/sessions/",
  "/lectures/lectures/",
  "/students/bulk_delete/",
  "/students/bulk_permanent_delete/",
]);
const SAFE_REQUEST_TRANSPORT_PATH_SHAPES: Array<[RegExp, string]> = [
  [/^\/api\/v1\/landing-public\/resources\/[1-9][0-9]*\/$/, "/api/v1/landing-public/resources/:id/"],
  [/^\/api\/v1\/landing-public\/resource-files\/[0-9a-f-]{36}\/$/, "/api/v1/landing-public/resource-files/:id/"],
  [/^\/api\/v1\/landing-public\/resource-files\/[0-9a-f-]{36}\/reader\/$/, "/api/v1/landing-public/resource-files/:id/reader/"],
  [/^\/api\/v1\/clinic\/participants\/[1-9][0-9]*\/$/, "/api/v1/clinic/participants/:id/"],
  [/^\/api\/v1\/clinic\/participants\/[1-9][0-9]*\/set_status\/$/, "/api/v1/clinic/participants/:id/set_status/"],
  [/^\/api\/v1\/clinic\/participants\/[1-9][0-9]*\/change-booking\/$/, "/api/v1/clinic/participants/:id/change-booking/"],
  [/^\/api\/v1\/clinic\/sessions\/[1-9][0-9]*\/$/, "/api/v1/clinic/sessions/:id/"],
  [/^\/api\/v1\/clinic\/sessions\/[1-9][0-9]*\/availability\/$/, "/api/v1/clinic/sessions/:id/availability/"],
  [/^\/api\/v1\/student\/video\/sessions\/[1-9][0-9]*\/videos\/$/, "/api/v1/student/video/sessions/:id/videos/"],
  [/^\/api\/v1\/student\/video\/videos\/[1-9][0-9]*\/progress\/$/, "/api/v1/student/video/videos/:id/progress/"],
  [/^\/api\/v1\/student\/video\/videos\/[1-9][0-9]*\/playback\/$/, "/api/v1/student/video/videos/:id/playback/"],
  [/^\/api\/v1\/storage\/inventory\/files\/[1-9][0-9]*\/$/, "/api/v1/storage/inventory/files/:id/"],
  [/^\/api\/v1\/storage\/inventory\/folders\/[1-9][0-9]*\/$/, "/api/v1/storage/inventory/folders/:id/"],
  [/^\/storage\/inventory\/files\/[1-9][0-9]*\/$/, "/storage/inventory/files/:id/"],
  [/^\/storage\/inventory\/folders\/[1-9][0-9]*\/$/, "/storage/inventory/folders/:id/"],
  [/^\/clinic\/participants\/[1-9][0-9]*\/$/, "/clinic/participants/:id/"],
  [/^\/clinic\/sessions\/[1-9][0-9]*\/$/, "/clinic/sessions/:id/"],
  [/^\/lectures\/lectures\/[1-9][0-9]*\/$/, "/lectures/lectures/:id/"],
  [/^\/lectures\/sessions\/[1-9][0-9]*\/$/, "/lectures/sessions/:id/"],
];

// A stale pooled keep-alive socket over the SSM tunnel fails fast with
// "socket hang up" before the server sees the request. Replay is permitted
// only where a duplicate delivery is provably harmless to BOTH the API and
// this gate's own exact-count assertions.
const REPLAY_SAFE_MUTATION_TEMPLATES = new Set<string>([
  "/api/v1/media/playback/events/", // append-only; canary asserts playback_events >= 4 (lower bound)
  "/api/v1/students/me/activity/", // activity ping; no exact-count assertion
  // Deliberately excluded: /api/v1/student/video/videos/:id/playback/
  //   creates a playback session; observeLongVideoRuntime asserts
  //   playback_sessions === 4 and active_playback_sessions === 0 exactly.
]);
const REPLAY_SAFE_MAX_ATTEMPT_MS = 250; // observed stale-socket hang-ups: 7..134ms
const REPLAY_SAFE_MAX_TOTAL = 3; // a degrading tunnel must still fail the gate

function safeRequestTransportPathTemplate(rawUrl: string): string | null {
  let target: URL;
  try { target = new URL(rawUrl); } catch { return null; }
  if (SAFE_REQUEST_TRANSPORT_STATIC_PATHS.has(target.pathname)) return target.pathname;
  return SAFE_REQUEST_TRANSPORT_PATH_SHAPES.find(([pattern]) => pattern.test(target.pathname))?.[1] ?? null;
}

function safeRequestTransportCode(error: unknown): RequestTransportDiagnostic["transportCode"] {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("request context disposed") || message.includes("target page, context or browser has been closed")) {
    return "context-disposed";
  }
  if (message.includes("timeout") || message.includes("timed out")) return "timeout";
  return "transport";
}

const guardedRequests = new WeakSet<APIRequestContext>();
export function installReleaseRequestGuard(
  request: APIRequestContext,
  boundary: ReleaseBoundary,
  observations: ObservationCounts = { attempted: 0, accepted: 0 },
  authentication: ObservationCounts = { attempted: 0, accepted: 0 },
  onViolation: () => void = () => {},
  transport: RequestTransportCounts = { readFetchRetries: 0, mutationReplays: 0 },
  onTransportDiagnostic: (diagnostic: RequestTransportDiagnostic) => void = () => {},
  onObservation: (event: ReleaseObservationEvent) => void = () => {},
): APIRequestContext {
  if (guardedRequests.has(request)) return request;
  guardedRequests.add(request);
  type Options = Parameters<APIRequestContext["fetch"]>[1];
  function check(url: string | Request, method: string, options?: Options) {
    const headers = options?.headers || {};
    const tenant = Object.entries(headers).find(([name]) => name.toLowerCase() === "x-tenant-code")?.[1];
    try {
      return assertReleaseRequestSafe(boundary, typeof url === "string" ? url : url.url(), method, tenant, options?.data);
    } catch (error) { onViolation(); throw error; }
  }
  const counterFor = (kind: string) => kind === "observation" ? observations : kind === "authentication" ? authentication : null;
  const count = async (kind: string, response: ReturnType<APIRequestContext["fetch"]>) => {
    const counter = counterFor(kind);
    const result = await response;
    if (result.status() >= 300 && result.status() < 400) {
      onViolation();
      throw new Error("Release API redirect refused");
    }
    if (counter && (kind === "observation" ? result.status() === 202 : result.ok())) counter.accepted += 1;
    return result;
  };
  const originalFetch = request.fetch.bind(request);
  const send = (url: string | Request, method: string, options?: Options) => {
    const verb = method.toUpperCase();
    const kind = check(url, verb, options);
    const counter = counterFor(kind);
    if (counter) counter.attempted += 1;
    const rawUrl = typeof url === "string" ? new URL(url, boundary.webOrigin).toString() : url.url();
    const pathTemplate = safeRequestTransportPathTemplate(rawUrl);
    const retryableRead = verb === "GET" || verb === "HEAD";
    const diagnosticMethod = safeTransportMethod(verb);
    const requestKind: RequestTransportDiagnostic["requestKind"] = retryableRead || verb === "OPTIONS" ? "read" : "mutation";
    const record = (stage: ReleaseObservationEvent["stage"], error?: unknown) => onObservation({
      phase: "api-request", stage, method: diagnosticMethod, pathTemplate,
      ...(error === undefined ? {} : { nativeCode: safeNativeTransportCode(error), nativeKind: safeNativeTransportKind(error) }),
    });
    return (async () => {
      const attempt = async (stage: RequestTransportDiagnostic["stage"]) => {
        try {
          return { response: await originalFetch(url, { ...options, method: verb, maxRedirects: 0 }) };
        } catch (error) {
          record(stage, error);
          if (pathTemplate && diagnosticMethod !== "other") onTransportDiagnostic({
            method: diagnosticMethod,
            pathTemplate,
            requestKind,
            stage,
            transportCode: safeRequestTransportCode(error),
          });
          return { error };
        }
      };
      let result = await attempt("initial");
      if (result.error) {
        if (retryableRead) {
          transport.readFetchRetries += 1;
          await new Promise((resolve) => setTimeout(resolve, 500));
          result = await attempt("retry");
        }
        if (result.error) {
          record("terminal", result.error);
          onViolation();
          throw new Error("Release APIRequestContext transport rejected");
        }
        record("recovered");
      }
      return count(kind, Promise.resolve(result.response!));
    })();
  };
  request.fetch = ((url: string | Request, options?: Options) => send(
    url,
    options?.method || (typeof url === "string" ? "GET" : url.method()),
    options,
  )) as APIRequestContext["fetch"];
  for (const verb of ["get", "head", "post", "put", "patch", "delete"] as const) {
    request[verb] = ((url: string, options?: Options) => send(url, verb.toUpperCase(), options)) as APIRequestContext[typeof verb];
  }
  return request;
}

export function developmentUpstream(boundary: ReleaseBoundary, rawUrl: string): string {
  const url = new URL(rawUrl);
  if (boundary.mode === "development" && url.origin === "https://api.hakwonplus.com" && url.pathname.startsWith("/api/")) {
    return `${boundary.apiOrigin}${url.pathname}${url.search}`;
  }
  return rawUrl;
}

async function installNativeKeepaliveGuard(
  context: BrowserContext,
  boundary: ReleaseBoundary,
  reject: (code: string) => void,
): Promise<void> {
  // Chromium sends native keepalive outside context.route, including pagehide.
  // Report before rejecting: the app may catch the rejection or unload immediately.
  await context.exposeBinding("__academyReleaseKeepaliveViolation", (_source, code: unknown) => {
    const allowed = ["origin", "tenant", "mutation", "shape", "transport"];
    reject(typeof code === "string" && allowed.includes(code) ? code : "shape");
  });
  context.on("console", (message) => {
    const code = /^academy-release-native-keepalive:(origin|tenant|mutation|shape|transport)$/.exec(message.text())?.[1];
    if (code) reject(code);
  });
  await context.addInitScript((boundary: ReleaseBoundary) => {
    const nativeFetch = window.fetch.bind(window);
    const NativeRequest = window.Request;
    const bodies = new WeakMap<InstanceType<typeof NativeRequest>, BodyInit | null | undefined>();
    // A Request exposes only a stream, which cannot be used to reconstruct a
    // keepalive request. Retain its original body synchronously when Axios builds
    // it; never await request.text() in a departing document.
    window.Request = class extends NativeRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(input, init);
        bodies.set(this, init?.body ?? (input instanceof NativeRequest ? bodies.get(input) : null));
      }
      clone(): InstanceType<typeof NativeRequest> {
        const copy = super.clone();
        bodies.set(copy, bodies.get(this));
        return copy;
      }
    };
    const violationKey = "academy:release-native-keepalive-defects";
    const binding = (window as unknown as {
      __academyReleaseKeepaliveViolation: (code: string) => Promise<void>;
    }).__academyReleaseKeepaliveViolation;
    // The old document can disappear before its binding message is delivered.
    // This sanitized per-tab journal is synchronously durable across reload;
    // the next document forwards it before application code runs.
    let previous: string[] = [];
    if (location.origin === boundary.webOrigin) try {
      const stored: unknown = JSON.parse(sessionStorage.getItem(violationKey) ?? "[]");
      if (!Array.isArray(stored) || stored.length > 5
        || stored.some((code) => !["origin", "tenant", "mutation", "shape", "transport"].includes(code))) {
        previous = ["shape"];
      } else previous = stored;
    } catch { previous = ["shape"]; }
    for (const code of previous) void binding(code).catch(() => undefined);
    const report = (code: string) => {
      previous = [...new Set([...previous, code])];
      try { sessionStorage.setItem(violationKey, JSON.stringify(previous)); } catch { /* Binding still reports; network remains refused. */ }
      // CDP console delivery also survives closing the tab without a next document.
      console.warn(`academy-release-native-keepalive:${code}`);
      void binding(code).catch(() => undefined);
    };
    const refuse = (code: string): Promise<Response> => {
      report(code);
      return Promise.reject(new TypeError("Release native keepalive request refused"));
    };
    window.fetch = (input, init) => {
      const keepalive = init?.keepalive ?? (input instanceof NativeRequest && input.keepalive);
      if (!keepalive) return nativeFetch(input, init);
      let request: InstanceType<typeof NativeRequest>;
      let target: URL;
      try {
        request = new NativeRequest(input, init);
        target = new URL(request.url);
      } catch { return refuse("shape"); }
      const playerUrl = new URL(location.href);
      const publicPlayerTelemetry = boundary.mode === "development" && window.parent !== window
        && playerUrl.origin === "https://www.youtube.com" && /^\/embed\/[A-Za-z0-9_-]{11}$/.test(playerUrl.pathname)
        && [...playerUrl.searchParams.keys()].sort().join(",") === "autoplay,origin,playsinline"
        && playerUrl.searchParams.get("origin") === boundary.webOrigin && playerUrl.searchParams.get("autoplay") === "0"
        && playerUrl.searchParams.get("playsinline") === "1" && !playerUrl.hash
        && target.origin === "https://www.youtube.com" && !target.username && !target.password
        && ["GET", "POST"].includes(request.method)
        && ["/youtubei/v1/log_event", "/api/stats/qoe", "/api/stats/watchtime", "/api/stats/playback"].includes(target.pathname)
        && !request.headers.has("authorization") && !request.headers.has("x-tenant-code") && !request.headers.has("x-csrftoken");
      // This iframe document was admitted by the registered-video route check.
      // Keep YouTube's own anonymous telemetry outside the application's write boundary.
      if (publicPlayerTelemetry) return nativeFetch(request, { redirect: "error" });
      // Application keepalive retains its existing route policy. Only the
      // reviewed terminal development write below has a native transport path.
      if (location.origin !== boundary.webOrigin
        || ![boundary.apiOrigin, "https://api.hakwonplus.com"].includes(target.origin)
        || target.username || target.password) return refuse("origin");
      if (request.headers.get("x-tenant-code") !== boundary.tenantCode) return refuse("tenant");
      if (boundary.mode !== "development") return refuse("mutation");
      const scoreMatch = /^\/api\/v1\/results\/admin\/sessions\/([1-9][0-9]*)\/score-draft\/commit\/$/.exec(target.pathname);
      const scoreExit = scoreMatch && Number.isSafeInteger(Number(scoreMatch[1]));
      const receiptEnd = target.pathname === "/api/v1/media/playback/v2/end/";
      if (request.method !== "POST" || (target.pathname !== "/api/v1/media/playback/end/" && !receiptEnd && !scoreExit)
        || target.search || target.hash || request.mode !== "cors"
        || request.credentials !== "omit"
        || !/^Bearer\s+\S+$/.test(request.headers.get("authorization") ?? "")) return refuse("shape");
      // Cross-origin native pagehide preflight is lost under Chromium routing.
      // The owned artifact server forwards only this terminal write to the
      // verified development API; the browser performs a real same-origin fetch.
      const body = init?.body ?? (input instanceof NativeRequest ? bodies.get(input) : undefined);
      if (typeof body !== "string") return refuse("shape");
      if (scoreExit) {
        try {
          const data = JSON.parse(body);
          if (!/^[a-zA-Z0-9._-]{1,128}$/.test(request.headers.get("x-score-editor-client") ?? "")
            || !data || Object.keys(data).sort().join(",") !== "release_if_empty,release_lease"
            || data.release_if_empty !== true || data.release_lease !== true) return refuse("shape");
        } catch { return refuse("shape"); }
      }
      const upstream = `${boundary.webOrigin}${scoreExit ? `/__qa__/score-exit/${scoreMatch[1]}` : receiptEnd ? "/__qa__/playback-v2-end" : "/__qa__/playback-end"}`;
      // Retain the original JSON bytes, method, auth/tenant headers and native
      // keepalive flag, including Axios's Request input.
      // Never follow a redirect with the playback token or authorization header.
      return nativeFetch(upstream, {
        method: request.method, headers: request.headers, body, keepalive: true,
        credentials: request.credentials, mode: request.mode, cache: request.cache,
        referrer: request.referrer, referrerPolicy: request.referrerPolicy,
        integrity: request.integrity, signal: request.signal, redirect: "error",
      }).catch((error: unknown) => {
        report("transport");
        throw error;
      });
    };
  }, boundary);
}

/**
 * Execute one read-only negative isolation probe against an existing sibling
 * qa-* tenant. This intentionally bypasses the browser route guard, whose
 * normal job is to reject the foreign tenant before network, so the release
 * canary can prove the real development API denies the same request too.
 */
export async function probeDevelopmentCrossTenantDenial({
  accessToken,
  participantId,
  targetTenantCode,
}: {
  accessToken: string;
  participantId: number;
  targetTenantCode: string;
}): Promise<number> {
  const boundary = releaseBoundaryFromEnv(process.env);
  if (!boundary || boundary.mode !== "development") {
    throw new Error("Cross-tenant denial probe requires the release development boundary");
  }
  if (!/^qa-ymath-realuse-[a-z0-9-]+$/.test(targetTenantCode)
    || targetTenantCode === boundary.tenantCode) {
    throw new Error("Cross-tenant denial probe requires a distinct disposable QA tenant");
  }
  if (!Number.isInteger(participantId) || participantId < 1 || !accessToken.trim()) {
    throw new Error("Cross-tenant denial probe requires an exact participant and access token");
  }

  const target = new URL(`/api/v1/clinic/participants/${participantId}/`, boundary.apiOrigin);
  if (target.origin !== "http://127.0.0.1:18000") {
    throw new Error("Cross-tenant denial probe must use the owned loopback development API");
  }
  const response = await fetch(target, {
    method: "GET",
    redirect: "manual",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Tenant-Code": targetTenantCode,
    },
  });
  const status = response.status;
  console.log(JSON.stringify({ crossTenantDenialProbe: {
    schema: "release-cross-tenant-denial/v1", status, errorCode: null,
  } }));
  await response.body?.cancel();
  if (status >= 300 && status < 400) {
    throw new Error("Cross-tenant denial probe refused an API redirect");
  }
  return status;
}

export async function installReleaseContextGuard(
  context: BrowserContext,
  boundary: ReleaseBoundary,
): Promise<ReleaseContextGuard> {
  const installed = installedContextGuards.get(context);
  if (installed) {
    if (installed.boundary.mode !== boundary.mode || installed.boundary.apiOrigin !== boundary.apiOrigin
      || installed.boundary.webOrigin !== boundary.webOrigin || installed.boundary.tenantCode !== boundary.tenantCode
      || installed.boundary.omrR2TenantId !== boundary.omrR2TenantId) {
      throw new Error("Release context boundary mismatch");
    }
    return installed.ready;
  }
  boundary = { ...boundary };

  const observations = { attempted: 0, accepted: 0 };
  const authentication = { attempted: 0, accepted: 0 };
  const transport = {
    readFetchRetries: 0,
    mutationReplays: 0,
    suppressedAnalyticsBatches: 0,
    suppressedAnalyticsEvents: 0,
    suppressedCloudflareBeacons: 0,
    closingAborts: 0,
  };
  const defects: string[] = [];
  const homeworkPreviewUrls = new Map<string, string>();
  const communityImageUrls = new Map<string, "image/png" | "image/jpeg" | "image/webp">();
  const communityFileUrls = new Map<string, { contentType: string; sizeBytes: number; disposition: string }>();
  const resourceDownloadUrls = new Set<string>();
  const resourceReaderUrls = new Map<string, string>();
  const acceptedPptJobs = new Set<string>();
  const acceptedPayrollJobs = new Map<string, string>();
  const documentDownloadUrls = new Map<string, { url: string; filename: string; contentType: string; contentDisposition: string;
    inventoryOriginal?: InventoryOriginal }>();
  const inventoryOriginals = new Map<string, InventoryOriginal>();
  const communityAttachments = new Map<string, { contentType: string; originalName: string; sizeBytes?: number }>();
  const registerCommunityPost = (post: unknown, expectedType?: "qna" | "notice") => {
    if (!isRecord(post) || !["qna", "notice", "board", "materials", "counsel"].includes(String(post.post_type)) || typeof post.post_type !== "string"
      || (expectedType !== undefined && post.post_type !== expectedType)
      || typeof post.id !== "number" || !Number.isSafeInteger(post.id)
      || Number(post.id) < 1 || !Array.isArray(post.attachments) || post.attachments.length > 10) return;
    const postId = Number(post.id);
    for (const attachment of post.attachments) {
      if (!isRecord(attachment) || typeof attachment.id !== "number" || !Number.isSafeInteger(attachment.id) || Number(attachment.id) < 1
        || typeof attachment.content_type !== "string" || typeof attachment.original_name !== "string") continue;
      const contentType = attachment.content_type;
      if (!["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain"].includes(contentType)) continue;
      const sizeBytes = typeof attachment.size_bytes === "number" && Number.isSafeInteger(attachment.size_bytes)
        && attachment.size_bytes > 0 && attachment.size_bytes <= 50 * 1024 * 1024 ? attachment.size_bytes : undefined;
      if (!contentType.startsWith("image/") && sizeBytes === undefined) continue;
      communityAttachments.set(`${postId}:${attachment.id}`, { contentType, originalName: attachment.original_name, sizeBytes });
      const url = attachment.download_url;
      if (typeof url === "string" && isExactDevelopmentCommunityAttachment(boundary, url, postId, contentType)) {
        communityImageUrls.set(url, contentType as "image/png" | "image/jpeg" | "image/webp");
      }
    }
  };
  const requestTransportDiagnostics: RequestTransportDiagnostic[] = [];
  const activeRoutes = new Set<Promise<void>>();
  const publicVideoIds = new Set<string>();
  const publicVideoFrames = new WeakSet<Frame>();
  let closing = false;
  let nextRequestOrdinal = 0;
  const observation = createReleaseContextObservation(++nextContextOrdinal,
    () => ({ closing, activeRouteCount: activeRoutes.size }));
  installReleaseRequestGuard(context.request, boundary, observations, authentication,
    () => defects.push("APIRequestContext release boundary violation"), transport,
    (diagnostic) => observation.recordTransportDiagnostic(requestTransportDiagnostics, diagnostic), observation.record);
  const requestTimings = new WeakMap<Request, { requestOrdinal: number; requestStartedElapsedMs: number;
    attemptStartedAt: number; startPage: ReturnType<typeof observation.requestPageState> }>();
  const recordRouteTransport = (request: Request, upstream: string,
    stage: ReleaseObservationEvent["stage"], error?: unknown,
    phase: "route-fetch" | "route-fulfill" | "route-handler" = "route-fetch",
    externalOrigin?: ReleaseObservationEvent["externalOrigin"]) => {
    const method = safeTransportMethod(request.method().toUpperCase());
    const pathTemplate = safeRequestTransportPathTemplate(upstream);
    const timing = requestTimings.get(request);
    const endPage = observation.requestPageState(request);
    observation.record({ phase, stage, method, pathTemplate,
      ...(externalOrigin ? { externalOrigin } : {}),
      ...(timing ? { requestOrdinal: timing.requestOrdinal, requestStartedElapsedMs: timing.requestStartedElapsedMs,
        attemptDurationMs: Math.max(0, Date.now() - timing.attemptStartedAt),
        pageOrdinal: timing.startPage?.pageOrdinal ?? null,
        startDocumentLoadOrdinal: timing.startPage?.documentLoadOrdinal ?? null,
        endDocumentLoadOrdinal: endPage?.documentLoadOrdinal ?? null,
        startNavigationOrdinal: timing.startPage?.navigationOrdinal ?? null,
        endNavigationOrdinal: endPage?.navigationOrdinal ?? null } : {}),
      ...(error === undefined ? {} : { nativeCode: safeNativeTransportCode(error), nativeKind: safeNativeTransportKind(error) }) });
    if (!pathTemplate || method === "other" || phase !== "route-fetch" || (stage !== "initial" && stage !== "retry")) return;
    observation.recordTransportDiagnostic(requestTransportDiagnostics, {
      method,
      pathTemplate,
      requestKind: ["GET", "HEAD", "OPTIONS"].includes(method) ? "read" : "mutation",
      stage,
      transportCode: safeRequestTransportCode(error),
    });
  };
  const handleRoute = async (route: Parameters<Parameters<BrowserContext["route"]>[1]>[0]) => {
    const request = route.request();
    const timing = { requestOrdinal: ++nextRequestOrdinal, requestStartedElapsedMs: observation.elapsedMs(),
      attemptStartedAt: Date.now(), startPage: observation.requestPageState(request) };
    requestTimings.set(request, timing);
    const reject = async (code: string) => {
      const pathTemplate = safeRequestTransportPathTemplate(request.url());
      defects.push(`Release request rejected [${code}] ${request.method().toUpperCase()}${pathTemplate ? ` ${pathTemplate}` : ""}`);
      try { await route.abort("blockedbyclient"); } catch { /* Context teardown already owns this request. */ }
    };
    let externalOrigin: ReleaseObservationEvent["externalOrigin"];
    try {
      const upstream = developmentUpstream(boundary, request.url());
      const target = new URL(upstream);
      // Public-player handling only applies outside the existing app/API
      // transports; their diagnostics and retry policy remain untouched.
      if (boundary.mode === "development" && target.origin !== boundary.apiOrigin && target.origin !== boundary.webOrigin) {
        let playerFrame: Frame | null = null;
        try { playerFrame = request.frame(); } catch { /* Requests without a frame stay inside the API boundary. */ }
        let trustedPlayerFrame = false;
        for (let frame = playerFrame; frame; frame = frame.parentFrame()) {
          if (publicVideoFrames.has(frame) && exactPublicVideoEmbed(boundary, frame.url(), publicVideoIds)) { trustedPlayerFrame = true; break; }
        }
        const publicVideoKind = publicVideoRequestKind(boundary, upstream, request.method(), request.resourceType(), publicVideoIds, trustedPlayerFrame);
        if (!publicVideoKind) {
          let frameAdmitted = false, frameExactEmbed = false, frameDetached: boolean | null = null;
          try {
            frameAdmitted = !!playerFrame && publicVideoFrames.has(playerFrame);
            frameExactEmbed = !!playerFrame && exactPublicVideoEmbed(boundary, playerFrame.url(), publicVideoIds);
            frameDetached = playerFrame?.isDetached() ?? null;
          } catch { /* Observation must not change the fail-closed request policy. */ }
          const resourceType = request.resourceType();
          externalOrigin = {
            providerClass: PUBLIC_VIDEO_PROVIDERS.find(host => target.hostname === host || target.hostname.endsWith(`.${host}`)) ?? "other",
            resourceType: ["document", "image", "script", "stylesheet", "font", "media", "xhr", "fetch"].includes(resourceType)
              ? resourceType as NonNullable<ReleaseObservationEvent["externalOrigin"]>["resourceType"] : "other",
            frameExists: !!playerFrame, frameAdmitted, frameExactEmbed, trustedAncestor: trustedPlayerFrame, frameDetached,
            protocol: target.protocol === "https:" ? "https" : target.protocol === "http:" ? "http" : "other",
            hasPort: !!target.port, hasHash: !!target.hash, hasCredentials: !!(target.username || target.password),
          };
        }
        if (publicVideoKind) {
          const headers = await request.allHeaders();
          const parent = playerFrame?.parentFrame();
          if (headers.authorization || headers["x-tenant-code"] || headers["x-csrftoken"]
            || (publicVideoKind === "embed" && (!playerFrame || !parent || new URL(parent.url()).origin !== boundary.webOrigin))) {
            await reject("credentials"); return;
          }
          // Relay actual provider responses and validate any permitted read hop. Native
          // route.continue() can follow a redirect without re-entering this guard.
          const started = Date.now();
          let response = await route.fetch({ maxRedirects: 0, timeout: 30_000 });
          let current = target;
          let redirects = 0;
          while ([301, 302, 303, 307, 308].includes(response.status())) {
            const location = response.headers().location;
            const next = location ? new URL(location, current) : null;
            const remaining = 30_000 - (Date.now() - started);
            // The native player uses query-only redirects on public providers.
            // Validate every hop; never replay writes or cross an origin/path.
            if (publicVideoKind !== "player" || !["GET", "HEAD"].includes(request.method())
              || redirects >= 3 || remaining <= 0 || !next
              || next.origin !== target.origin || next.pathname !== target.pathname
              || publicVideoRequestKind(boundary, next.href, request.method(), request.resourceType(), publicVideoIds, trustedPlayerFrame) !== "player") {
              await reject("public-video-redirect"); return;
            }
            redirects += 1; current = next;
            response = await route.fetch({ url: next.href, maxRedirects: 0, timeout: remaining });
          }
          if (response.status() >= 300 && response.status() < 400) {
            await reject("public-video-redirect"); return;
          }
          if (publicVideoKind === "embed" && playerFrame && response.status() === 200) publicVideoFrames.add(playerFrame);
          await route.fulfill({ response });
          return;
        }
      }
      if (isExactReadonlyCloudflareBeacon(boundary, target, request.method())) {
        const headers = await request.allHeaders();
        if (headers.authorization || headers.cookie || headers["x-tenant-code"]) {
          await reject("credentials");
          return;
        }
        try {
          await route.fulfill({ status: 200, contentType: "application/javascript; charset=utf-8", body: "" });
          transport.suppressedCloudflareBeacons += 1;
        } catch (error) {
          recordRouteTransport(request, upstream, "terminal", error, "route-fulfill");
          await reject("fulfill-transport");
        }
        return;
      }
      let data: unknown;
      try { data = request.postDataJSON(); } catch { data = undefined; }
      let bodyBytes = 0;
      try {
        const raw = typeof request.postDataBuffer === "function" ? request.postDataBuffer() : null;
        bodyBytes = raw?.byteLength ?? (data == null ? 0 : new TextEncoder().encode(JSON.stringify(data)).byteLength);
      } catch { bodyBytes = 0; }
      const tenantCode = await request.headerValue("x-tenant-code") || undefined;
      const analyticsEvents = exactReadonlyAnalyticsEventCount(boundary, target, request.method(), tenantCode, data, bodyBytes);
      if (analyticsEvents !== null) {
        const headers = await request.allHeaders();
        if (headers.origin !== boundary.webOrigin) throw new Error("Real API CORS boundary mismatch");
        try {
          await route.fulfill({ status: 202, contentType: "application/json; charset=utf-8",
            headers: { "access-control-allow-origin": boundary.webOrigin, "access-control-allow-credentials": "true" },
            body: JSON.stringify({ accepted: 0, ignored: "release_readonly" }) });
          transport.suppressedAnalyticsBatches += 1;
          transport.suppressedAnalyticsEvents += analyticsEvents;
        } catch (error) {
          recordRouteTransport(request, upstream, "terminal", error, "route-fulfill");
          await reject("fulfill-transport");
        }
        return;
      }
      const readerContentType = resourceReaderUrls.get(upstream);
      const resourceTypes = readerContentType
        ? (readerContentType.startsWith("image/") ? ["image", "fetch", "xhr"] : ["fetch", "xhr"])
        : ["document", "other", "fetch", "xhr"];
      if (request.method() === "GET" && (resourceDownloadUrls.has(upstream) || readerContentType)
        && resourceTypes.includes(request.resourceType())) {
        const headers = await request.allHeaders();
        if (bodyBytes > 0 || ["authorization", "proxy-authorization", "cookie", "x-tenant-code", "x-student-id", "x-api-key"]
          .some((key) => headers[key])) { await reject("credentials"); return; }
        const preview = Boolean(readerContentType) || ["fetch", "xhr"].includes(request.resourceType());
        const response = await route.fetch({ url: upstream, method: "GET",
          headers: { accept: "*/*", ...(preview ? { origin: boundary.webOrigin } : {}) }, maxRedirects: 0 });
        if (response.status() >= 300 && response.status() < 400) throw new Error("Release API redirect refused");
        const body = await response.body();
        const actualType = response.headers()["content-type"]?.split(";")[0].trim().toLowerCase();
        // Derived reader assets have no download disposition. Keep original-download
        // checks intact and bind each derived response to its manifest's exact format.
        const readerSignatureMatches = !readerContentType || (readerContentType === "application/pdf"
          ? body.subarray(0, 5).toString("ascii") === "%PDF-"
          : readerContentType === "image/png"
            ? [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => body[index] === byte)
            : readerContentType === "image/jpeg"
              ? body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff
              : readerContentType === "image/gif"
                ? ["GIF87a", "GIF89a"].includes(body.subarray(0, 6).toString("ascii"))
                : body.subarray(0, 4).toString("ascii") === "RIFF" && body.subarray(8, 12).toString("ascii") === "WEBP");
        const responseFailure = response.status() !== 200 ? "resource-status"
          : !body.length || body.length > (readerContentType ? 60 : 30) * 1024 * 1024 ? "resource-size"
            : !readerSignatureMatches ? "resource-signature"
              : (readerContentType ? actualType !== readerContentType
                : !["application/pdf", "application/x-hwp", "application/hwp+zip", "application/octet-stream"].includes(actualType)) ? "resource-type"
                : !readerContentType && !response.headers()["content-disposition"]?.startsWith("attachment;") ? "resource-disposition" : null;
        if (responseFailure) { await reject(responseFailure); return; }
        if (preview && !["*", boundary.webOrigin].includes(response.headers()["access-control-allow-origin"])) {
          await reject("cors"); return;
        }
        await route.fulfill({ response, body });
        return;
      }
      const documentDownload = request.method() === "GET"
        ? [...documentDownloadUrls.values()].find((item) => item.url === upstream) : undefined;
      if (documentDownload && ["document", "other"].includes(request.resourceType())) {
        const headers = await request.allHeaders();
        if (bodyBytes > 0 || ["authorization", "proxy-authorization", "cookie", "x-tenant-code", "x-student-id", "x-api-key"]
          .some((key) => headers[key])) {
          await reject("credentials");
          return;
        }
        const response = await route.fetch({ url: upstream, method: "GET",
          headers: { accept: documentDownload.contentType }, maxRedirects: 0 });
        if (response.status() >= 300 && response.status() < 400) throw new Error("Release API redirect refused");
        const body = await response.body();
        const disposition = documentDownload.contentDisposition;
        const original = documentDownload.inventoryOriginal;
        const signatureMatches = original?.contentType === "application/x-hwp"
          ? [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((byte, index) => body[index] === byte)
          : body.length >= 4 && body.subarray(0, 4).toString("binary") === "PK\x03\x04";
        if (response.status() !== 200
          || response.headers()["content-type"]?.split(";")[0].trim().toLowerCase() !== documentDownload.contentType
          || response.headers()["content-disposition"] !== disposition
          || !signatureMatches || (original && body.length !== original.sizeBytes)) {
          await reject("transport");
          return;
        }
        await route.fulfill({ status: 200, headers: { "content-type": documentDownload.contentType,
          "content-disposition": disposition }, body });
        return;
      }
      const communityFile = request.method() === "GET" ? communityFileUrls.get(upstream) : undefined;
      if (communityFile && ["document", "other"].includes(request.resourceType())) {
        const headers = await request.allHeaders();
        if (bodyBytes > 0 || ["authorization", "proxy-authorization", "cookie", "x-tenant-code", "x-student-id", "x-api-key"]
          .some((key) => headers[key])) {
          await reject("credentials");
          return;
        }
        const response = await route.fetch({ url: upstream, method: "GET", headers: { accept: communityFile.contentType }, maxRedirects: 0 });
        if (response.status() >= 300 && response.status() < 400) throw new Error("Release API redirect refused");
        const body = await response.body();
        if (response.status() !== 200 || body.length !== communityFile.sizeBytes
          || response.headers()["content-type"]?.split(";")[0].trim().toLowerCase() !== communityFile.contentType
          || response.headers()["content-disposition"] !== communityFile.disposition
          || (communityFile.contentType === "application/pdf" && body.subarray(0, 5).toString("ascii") !== "%PDF-")) {
          await reject("transport");
          return;
        }
        await route.fulfill({ status: 200, headers: { "content-type": communityFile.contentType,
          "content-disposition": communityFile.disposition }, body });
        return;
      }
      const homeworkImageType = request.method() === "GET" ? homeworkPreviewUrls.get(upstream) : undefined;
      if (homeworkImageType === "video/mp4" && request.resourceType() === "media") {
        const headers = await request.allHeaders();
        if (bodyBytes > 0 || ["authorization", "proxy-authorization", "cookie", "x-tenant-code", "x-student-id", "x-api-key"].some((key) => headers[key])
          || (headers.range && !/^bytes=[0-9]+-[0-9]*$/.test(headers.range))) { await reject("credentials"); return; }
        // Synthetic canary clips only: preserve the actual object bytes, strip
        // credentials/Range/referrer, and return a complete 200 media response.
        const response = await route.fetch({ url: upstream, method: "GET", headers: { accept: "video/mp4" }, maxRedirects: 0 });
        const body = await response.body();
        if (response.status() !== 200 || response.headers()["content-type"]?.split(";")[0].trim().toLowerCase() !== "video/mp4"
          || body.length < 24 || body.length > 2 * 1024 * 1024 || body.subarray(4, 8).toString("ascii") !== "ftyp") {
          await reject("transport"); return;
        }
        await route.fulfill({ status: 200, headers: { "content-type": "video/mp4", "content-length": String(body.length) }, body });
        return;
      }
      const homeworkHeic = homeworkImageType === "image/heic" || homeworkImageType === "image/heif";
      const communityImageType = request.method() === "GET" ? communityImageUrls.get(upstream) : undefined;
      if (((homeworkImageType && homeworkImageType !== "video/mp4") || communityImageType || isExactDevelopmentOmrImage(boundary, upstream, request.method()))
        && (request.resourceType() === "image" || (homeworkHeic && request.resourceType() === "xhr"))) {
        const headers = await request.allHeaders();
        if (bodyBytes > 0 || ["authorization", "proxy-authorization", "cookie", "x-tenant-code", "x-student-id", "x-api-key"]
          .some((key) => headers[key])) {
          await reject("credentials");
          return;
        }
        // Only this signed development object URL is forwarded. Never send app
        // credentials/referrer or follow redirects; never report the signed URL.
        const contentType = communityImageType || homeworkImageType || "image/jpeg";
        const response = await route.fetch({ url: upstream, method: "GET", headers: { accept: contentType,
          ...(homeworkHeic ? { origin: boundary.webOrigin } : {}) }, maxRedirects: 0 });
        if (response.status() >= 300 && response.status() < 400) throw new Error("Release API redirect refused");
        const body = await response.body();
        const signature = homeworkHeic ? [] : contentType === "image/png" ? [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
          : contentType === "image/webp" ? [0x52, 0x49, 0x46, 0x46] : [0xff, 0xd8, 0xff];
        if (response.status() !== 200 || response.headers()["content-type"]?.split(";")[0].trim().toLowerCase() !== contentType
          || signature.some((byte, index) => body[index] !== byte)
          || (homeworkHeic && (body.subarray(4, 8).toString("ascii") !== "ftyp"
            || !["*", boundary.webOrigin].includes(response.headers()["access-control-allow-origin"] ?? "")))
          || (contentType === "image/webp" && body.subarray(8, 12).toString("ascii") !== "WEBP")) {
          await reject("transport");
          return;
        }
        await route.fulfill({ status: 200, headers: { "content-type": contentType,
          ...(homeworkHeic ? { "access-control-allow-origin": response.headers()["access-control-allow-origin"] } : {}) }, body });
        return;
      }
      const kind = assertReleaseRequestSafe(boundary, upstream, request.method(), tenantCode, data);
      const counter = kind === "observation" ? observations : kind === "authentication" ? authentication : null;
      if (counter) counter.attempted += 1;
      if (new URL(upstream).origin === boundary.apiOrigin) {
        const headers = await request.allHeaders();
        delete headers.host;
        // The stale-socket failures below are a pooled-keepalive-socket
        // reuse race over the SSM tunnel: a socket the tunnel already tore
        // down still looks idle to the HTTP client's connection pool.
        // Never reusing a pooled connection removes the race at its source,
        // rather than only recovering from it after the fact.
        headers.connection = "close";
        // Transport only: unchanged artifact -> real isolated HTTP response.
        // Never follow a redirect carrying QA credentials to another origin.
        let response: Awaited<ReturnType<typeof route.fetch>>;
        try {
          timing.attemptStartedAt = Date.now();
          response = await route.fetch({ url: upstream, headers, maxRedirects: 0 });
        } catch (error) {
          recordRouteTransport(request, upstream, "initial", error);
          const code = releaseRequestFailureCode(error);
          const safeRead = ["GET", "HEAD", "OPTIONS"].includes(request.method().toUpperCase());
          const attemptMs = Date.now() - timing.attemptStartedAt;
          // Stale pooled socket over the SSM tunnel: same narrow failure mode
          // GET already recovers from below, extended to two provably replay-safe
          // mutation endpoints (see REPLAY_SAFE_MUTATION_TEMPLATES above).
          const replaySafeMutation = !safeRead && code !== "context-disposed"
            && safeNativeTransportKind(error) === "socket-hang-up"
            && attemptMs <= REPLAY_SAFE_MAX_ATTEMPT_MS
            && REPLAY_SAFE_MUTATION_TEMPLATES.has(safeRequestTransportPathTemplate(upstream) ?? "")
            && transport.mutationReplays < REPLAY_SAFE_MAX_TOTAL;
          if ((!safeRead && !replaySafeMutation) || code === "context-disposed") {
            recordRouteTransport(request, upstream, "terminal", error);
            await reject(code === "context-disposed" ? code : "fetch-transport");
            return;
          }
          if (replaySafeMutation) transport.mutationReplays += 1;
          else transport.readFetchRetries += 1;
          // A stale pooled socket resolves as soon as the retry opens a new
          // connection -- the delay only needs to clear the immediate race,
          // not wait out anything server-side. A long delay only widens the
          // client-side window for a second, unrelated failure.
          await new Promise((resolve) => setTimeout(resolve, 50));
          try {
            timing.attemptStartedAt = Date.now();
            response = await route.fetch({ url: upstream, headers, maxRedirects: 0 });
            recordRouteTransport(request, upstream, "recovered");
          } catch (retryError) {
            recordRouteTransport(request, upstream, "retry", retryError);
            recordRouteTransport(request, upstream, "terminal", retryError);
            const retryCode = releaseRequestFailureCode(retryError);
            await reject(retryCode === "context-disposed" ? retryCode : "fetch-transport");
            return;
          }
        }
        if (response.status() >= 300 && response.status() < 400) throw new Error("Release API redirect refused");
        // Playwright adds CORS headers when absent. Reject such a response
        // BEFORE fulfill so this transport cannot conceal a real CORS defect.
        if (headers.origin !== boundary.webOrigin
          || response.headers()["access-control-allow-origin"] !== boundary.webOrigin
          || response.headers()["access-control-allow-credentials"] !== "true") {
          throw new Error("Real API CORS boundary mismatch");
        }
        const pptTarget = new URL(upstream);
        if (boundary.mode === "development" && request.method() === "POST" && !pptTarget.search
          && response.status() >= 200 && response.status() < 300
          && response.headers()["content-type"]?.split(";")[0].trim().toLowerCase() === "application/json"
          && /^Bearer \S+$/.test(headers.authorization ?? "") && headers["x-tenant-code"] === boundary.tenantCode
          && ["/api/v1/storage/inventory/upload/", "/api/v1/storage/inventory/presign/"].includes(pptTarget.pathname)) {
          const payload = await response.json();
          if (pptTarget.pathname.endsWith("/upload/") && isRecord(payload) && inventoryOriginals.size < 4
            && Number.isSafeInteger(boundary.omrR2TenantId) && Number(boundary.omrR2TenantId) > 0
            && typeof payload.r2Key === "string" && new RegExp("^tenants/" + boundary.omrR2TenantId
              + "/students/[A-Za-z0-9_-]+/inventory/qa-[^/\\\\\\x00-\\x1f]{1,240}_[0-9]{6}_[a-f0-9]{32}\\.[hH][wW][pP][xX]?$").test(payload.r2Key)
            && typeof payload.name === "string" && /^qa-[^/\\]{1,240}\.[hH][wW][pP][xX]?$/.test(payload.name)
            && [...payload.name].every((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
            && typeof payload.contentType === "string" && payload.contentType === (payload.name.toLowerCase().endsWith(".hwpx")
              ? "application/vnd.hancom.hwpx" : "application/x-hwp")
            && typeof payload.sizeBytes === "number" && Number.isSafeInteger(payload.sizeBytes)
            && payload.sizeBytes > 0 && payload.sizeBytes <= 30 * 1024 * 1024) {
            inventoryOriginals.set(payload.r2Key, { r2Key: payload.r2Key, name: payload.name,
              contentType: payload.contentType, sizeBytes: payload.sizeBytes });
          }
          if (pptTarget.pathname.endsWith("/presign/") && isRecord(data) && data.download === true
            && typeof data.r2_key === "string" && isRecord(payload) && typeof payload.url === "string") {
            const original = inventoryOriginals.get(data.r2_key);
            if (original && isExactInventoryOriginalDownload(boundary, payload.url, original)) {
              documentDownloadUrls.set("inventory:" + original.r2Key, { url: payload.url, filename: original.name,
                contentType: original.contentType, contentDisposition: inventoryDisposition(original.name), inventoryOriginal: original });
            }
          }
        }
        const pptSubmission = request.method() === "POST"
          && pptTarget.pathname === "/api/v1/tools/ppt/generate/" && !pptTarget.search;
        const payrollSubmission = request.method() === "POST"
          && pptTarget.pathname === "/api/v1/staffs/payroll-snapshots/export-excel/" && !pptTarget.search;
        const payrollPeriod = data as { year?: unknown; month?: unknown } | undefined;
        const payrollYear = Number(payrollPeriod?.year);
        const payrollMonth = Number(payrollPeriod?.month);
        const pptStatus = request.method() === "GET"
          ? /^\/api\/v1\/jobs\/([0-9a-f-]{36})\/(?:progress\/)?$/.exec(pptTarget.pathname) : null;
        if (boundary.mode === "development" && response.status() >= 200 && response.status() < 300
          && response.headers()["content-type"]?.split(";")[0].trim().toLowerCase() === "application/json"
          && /^Bearer \S+$/.test(headers.authorization ?? "") && headers["x-tenant-code"] === boundary.tenantCode
          && (pptSubmission || payrollSubmission || (pptStatus && !pptTarget.search))) {
          const payload = await response.json();
          if (pptSubmission && UUID.test(payload?.job_id) && acceptedPptJobs.size < 2) {
            acceptedPptJobs.add(payload.job_id);
          }
          if (payrollSubmission && UUID.test(payload?.job_id) && acceptedPayrollJobs.size < 2
            && Number.isInteger(payrollYear) && payrollYear >= 2020 && payrollYear <= 2100
            && Number.isInteger(payrollMonth) && payrollMonth >= 1 && payrollMonth <= 12) {
            acceptedPayrollJobs.set(payload.job_id, `payroll_${payrollYear}_${payrollMonth}.xlsx`);
          }
          if (pptStatus && UUID.test(pptStatus[1]) && acceptedPayrollJobs.has(pptStatus[1])
            && payload?.job_id === pptStatus[1] && payload?.job_type === "staff_excel_export"
            && payload?.status === "DONE" && typeof payload?.result?.download_url === "string"
            && payload.result.filename === acceptedPayrollJobs.get(pptStatus[1])
            && isExactDevelopmentPayrollDownload(boundary, payload.result.download_url, pptStatus[1], payload.result.filename)) {
            documentDownloadUrls.set(pptStatus[1], {
              url: payload.result.download_url, filename: payload.result.filename, contentType: XLSX_CONTENT_TYPE,
              contentDisposition: 'attachment; filename="' + payload.result.filename + '"; filename*=UTF-8\'\'' + payload.result.filename,
            });
          }
          if (pptStatus && UUID.test(pptStatus[1]) && acceptedPptJobs.has(pptStatus[1])
            && payload?.job_id === pptStatus[1] && payload?.job_type === "ppt_generation"
            && payload?.status === "DONE" && typeof payload?.result?.download_url === "string"
            && typeof payload.result.filename === "string"
            && isExactDevelopmentPptDownload(boundary, payload.result.download_url, payload.result.filename)) {
            documentDownloadUrls.set(pptStatus[1], { url: payload.result.download_url, filename: payload.result.filename, contentType: PPTX_CONTENT_TYPE,
              contentDisposition: 'attachment; filename="' + payload.result.filename + '"' });
          }
        }
        const resourceTarget = new URL(upstream);
        const conversion = /^\/api\/v1\/tools\/problem-studio\/conversions\/([0-9a-f-]{36})\/(?:actions\/)?$/.exec(resourceTarget.pathname);
        if (boundary.mode === "development" && conversion && !resourceTarget.search && [200, 202].includes(response.status())
          && headers["x-tenant-code"] === boundary.tenantCode && /^Bearer \S+$/.test(headers.authorization ?? "")
          && response.headers()["content-type"]?.split(";")[0].trim().toLowerCase() === "application/json") {
          const payload = await response.json();
          if (payload?.id !== conversion[1]) throw new Error("Conversion identity mismatch");
          const assets = [...(payload.document?.pages ?? []), payload.source_archive,
            ...Object.values(payload.artifacts ?? {}),
            ...(payload.document?.questions ?? []).flatMap((question: { visual?: unknown; redrawn?: unknown; proposal?: { redrawn?: unknown } }) => [question.visual, question.redrawn, question.proposal?.redrawn])];
          for (const asset of assets) {
            if (!asset) continue;
            if (typeof asset.url !== "string" || typeof asset.filename !== "string" || typeof asset.mime !== "string"
              || !isExactDevelopmentConversionAsset(boundary, asset.url, conversion[1], asset.filename, asset.mime)) {
              throw new Error("Conversion asset escaped exact development scope");
            }
            if (["image/png", "image/jpeg"].includes(asset.mime)) resourceReaderUrls.set(asset.url, asset.mime);
            else documentDownloadUrls.set(asset.url, { url: asset.url, filename: asset.filename,
              contentType: asset.mime, contentDisposition: inventoryDisposition(asset.filename) });
          }
        }
        const resourceFile = /^\/api\/v1\/landing-public\/resource-files\/([0-9a-f-]{36})\/$/.exec(resourceTarget.pathname);
        if (boundary.mode === "development" && request.method() === "GET" && resourceFile
          && !resourceTarget.search && response.status() === 200 && headers["x-tenant-code"] === boundary.tenantCode
          && response.headers()["content-type"]?.split(";")[0].trim().toLowerCase() === "application/json") {
          const payload = await response.json();
          if (payload?.expires_in === 300 && typeof payload.url === "string"
            && isExactDevelopmentResourceDownload(boundary, payload.url, resourceFile[1])) resourceDownloadUrls.add(payload.url);
        }
        const resourceReader = /^\/api\/v1\/landing-public\/resource-files\/([0-9a-f-]{36})\/reader\/$/.exec(resourceTarget.pathname);
        if (boundary.mode === "development" && ["GET", "POST"].includes(request.method()) && resourceReader
          && !resourceTarget.search && response.status() === 200 && headers["x-tenant-code"] === boundary.tenantCode
          && response.headers()["content-type"]?.split(";")[0].trim().toLowerCase() === "application/json") {
          const payload = await response.json();
          if (payload?.status === "ready") {
            const urls: string[] = [];
            if (typeof payload.pdf_url === "string") urls.push(payload.pdf_url);
            let visited = 0;
            function visit(value: unknown, depth = 0) {
              if (depth > 48 || ++visited > 50000) throw new Error("Resource reader QA manifest limit");
              if (Array.isArray(value)) { for (const item of value) visit(item, depth + 1); }
              else if (value && typeof value === "object") {
                const block = value as { kind?: unknown; url?: unknown; rows?: unknown };
                if (block.kind === "image" && typeof block.url === "string") urls.push(block.url);
                else if (block.kind === "table") visit(block.rows, depth + 1);
              }
            }
            visit(payload.blocks);
            for (const url of urls) {
              if (!isExactDevelopmentResourceReaderAsset(boundary, url, resourceReader[1])) throw new Error("Resource reader asset escaped exact development scope");
              if (isExactDevelopmentResourceDownload(boundary, url, resourceReader[1])) resourceDownloadUrls.add(url);
              else {
                const types: Record<string, string> = { pdf: "application/pdf", png: "image/png", webp: "image/webp", gif: "image/gif" };
                const type = types[new URL(url).pathname.split(".").at(-1) ?? ""];
                if (!type) throw new Error("Resource reader format is outside exact development scope");
                resourceReaderUrls.set(url, type);
              }
            }
          }
        }
        const homeworkPreview = /^\/api\/v1\/submissions\/submissions\/homework\/([1-9][0-9]*)\/media\/([1-9][0-9]*)\/preview\/(compatible\/)?$/.exec(new URL(upstream).pathname);
        if (boundary.mode === "development" && request.method() === "GET" && homeworkPreview
          && !new URL(upstream).search && response.status() === 200 && /^Bearer \S+$/.test(headers.authorization ?? "")) {
          const preview = await response.json();
          if (!homeworkPreview[3] && preview?.media_kind === "image" && typeof preview.mime_type === "string" && preview.expires_in === 600
            && typeof preview.url === "string" && isExactDevelopmentHomeworkImage(boundary, preview.url, homeworkPreview[2], preview.mime_type)) {
            homeworkPreviewUrls.set(preview.url, preview.mime_type);
          }
          if ((homeworkPreview[3] ? preview?.status === "ready" : preview?.media_kind === "video")
            && preview.mime_type === "video/mp4" && preview.expires_in === 600 && typeof preview.url === "string"
            && isExactDevelopmentHomeworkVideo(boundary, preview.url, homeworkPreview[2], Boolean(homeworkPreview[3]))) {
            homeworkPreviewUrls.set(preview.url, "video/mp4");
          }
        }
        if (boundary.mode === "development" && target.pathname.startsWith("/api/v1/landing-public/videos/")
          && [200, 201].includes(response.status())
          && response.headers()["content-type"]?.split(";")[0].trim().toLowerCase() === "application/json") {
          registerPublicVideoSources(await response.json(), publicVideoIds);
        }
        const communityTarget = new URL(upstream);
        const publicPost = /^\/api\/v1\/landing-public\/(board|reviews)\/([1-9][0-9]*)\/$/.exec(communityTarget.pathname);
        if (boundary.mode === "development" && publicPost && !communityTarget.search && request.method() === "GET"
          && response.status() === 200 && /^Bearer \S+$/.test(headers.authorization ?? "")
          && response.headers()["content-type"]?.split(";")[0].trim().toLowerCase() === "application/json") {
          const payload = await response.json();
          const photos = publicPost[1] === "board" ? payload?.meta?.photos : payload?.photos;
          if (payload?.id === Number(publicPost[2]) && Array.isArray(photos) && photos.length <= 8) {
            for (const photo of photos) {
              if (typeof photo !== "string") continue;
              const contentType = developmentPublicPhotoType(boundary, photo);
              if (contentType) communityImageUrls.set(photo, contentType);
            }
          }
        }
        const communityPost = /^\/api\/v1\/community\/posts\/([1-9][0-9]*)\/$/.exec(communityTarget.pathname);
        const communityList = communityTarget.pathname === "/api/v1/community/posts/"
          && communityTarget.searchParams.getAll("post_type").length === 1
          && communityTarget.searchParams.get("post_type") === "qna"
          && [...communityTarget.searchParams.keys()].every((key) => ["post_type", "page_size"].includes(key))
          && (communityTarget.searchParams.getAll("page_size").length === 0
            || (communityTarget.searchParams.getAll("page_size").length === 1
              && /^[1-9][0-9]*$/.test(communityTarget.searchParams.get("page_size") ?? "")
              && Number(communityTarget.searchParams.get("page_size")) <= 200));
        const communityDownload = /^\/api\/v1\/community\/posts\/([1-9][0-9]*)\/attachments\/([1-9][0-9]*)\/download\/$/.exec(communityTarget.pathname);
        if (boundary.mode === "development" && request.method() === "GET"
          && ((communityPost && !communityTarget.search) || communityList || (communityDownload && !communityTarget.search))
          && response.status() === 200 && /^Bearer \S+$/.test(headers.authorization ?? "")
          && response.headers()["content-type"]?.split(";")[0].trim().toLowerCase() === "application/json") {
          const payload = await response.json();
          if (communityPost && payload?.id === Number(communityPost[1])) registerCommunityPost(payload);
          if (communityList) {
            const posts = Array.isArray(payload) ? payload : payload?.results;
            if (Array.isArray(posts) && posts.length <= 200) posts.forEach((post) => registerCommunityPost(post, "qna"));
          }
          if (communityDownload) {
            const postId = Number(communityDownload[1]);
            const attachment = communityAttachments.get(`${postId}:${communityDownload[2]}`);
            if (attachment && payload?.original_name === attachment.originalName && typeof payload?.url === "string"
              && isExactDevelopmentCommunityAttachment(boundary, payload.url, postId,
                attachment.contentType, attachment.originalName)) {
              if (attachment.contentType.startsWith("image/")) {
                communityImageUrls.set(payload.url,
                  attachment.contentType as "image/png" | "image/jpeg" | "image/webp");
              } else if (attachment.sizeBytes !== undefined) {
                communityFileUrls.set(payload.url, { contentType: attachment.contentType, sizeBytes: attachment.sizeBytes,
                  disposition: new URL(payload.url).searchParams.get("response-content-disposition")! });
              }
            }
          }
        }
        if (counter && (kind === "observation" ? response.status() === 202 : response.ok())) counter.accepted += 1;
        try { await route.fulfill({ response }); }
        catch (error) {
          recordRouteTransport(request, upstream, "terminal", error, "route-fulfill");
          await reject("fulfill-transport");
        }
        return;
      }
    } catch (error) {
      // Upstream errors can contain credential-bearing URLs. Emit no raw error.
      recordRouteTransport(request, request.url(), "terminal", error, "route-handler", externalOrigin);
      await reject(releaseRequestFailureCode(error));
      return;
    }
    await route.continue();
  };
  const guard: ReleaseContextGuard = {
    observations,
    authentication,
    transport,
    requestTransportDiagnostics,
    observation,
    async beginClose() {
      closing = true;
      await Promise.allSettled([...activeRoutes]);
    },
    assertClean() {
      if (defects.length) throw new Error(`Release API boundary failed: ${[...new Set(defects)].join("; ")}`);
    },
  };
  const ready = Promise.resolve().then(async () => {
    await installNativeKeepaliveGuard(context, boundary,
      (code) => defects.push(`Release native keepalive rejected [${code}]`));
    await context.route("**/*", async (route) => {
      if (closing) {
        // Only requests arriving after explicit close begins reach this path;
        // already-inspected routes are drained by beginClose(). Cancel these
        // as lifecycle aborts, not policy violations: blockedbyclient can make
        // Chromium create an error document and report synthetic page errors.
        // Keep API attribution without changing retries or live policy rejects.
        try {
          const upstream = developmentUpstream(boundary, route.request().url());
          if (new URL(upstream).origin === boundary.apiOrigin) transport.closingAborts += 1;
        } catch { /* best-effort attribution only -- still abort below */ }
        try { await route.abort("aborted"); } catch { /* Context teardown already owns this request. */ }
        return;
      }
      const handling = handleRoute(route);
      activeRoutes.add(handling);
      try { await handling; }
      finally { activeRoutes.delete(handling); }
    });
    return guard;
  });
  // Share registration as well as counters. A failed context must be discarded:
  // its APIRequestContext is already wrapped with this boundary and diagnostics.
  installedContextGuards.set(context, { boundary, ready });
  return ready;
}
