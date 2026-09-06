import type { APIRequestContext, BrowserContext, Request } from "@playwright/test";

export type ReleaseBoundary = {
  mode: "readonly" | "development";
  apiOrigin: string;
  webOrigin: string;
  tenantCode: string;
};

function isExactPublicTenantMetadataRead(boundary: ReleaseBoundary, target: URL, verb: string): boolean {
  return verb === "GET"
    && target.pathname === "/api/v1/core/og-meta/"
    && [...target.searchParams.keys()].length === 1
    && target.searchParams.getAll("hostname").length === 1
    && target.searchParams.get("hostname") === new URL(boundary.webOrigin).hostname;
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
  return { mode, apiOrigin: api.origin, webOrigin: web.origin, tenantCode };
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
      || payload.screen_id !== "student.dashboard.home"
      || !["desktop", "tablet", "mobile"].includes(String(payload.device_class))) {
      throw new Error("Production observation payload is outside the reviewed dashboard schema");
    }
    return "observation";
  }
  if (!read && !authentication) {
    // No payload, query string, token or recipient is included in diagnostics.
    throw new Error(`Production release business mutation refused: ${verb} ${target.pathname}`);
  }
  return authentication ? "authentication" : "read";
}

export type ObservationCounts = { attempted: number; accepted: number };
const guardedRequests = new WeakSet<APIRequestContext>();
export function installReleaseRequestGuard(
  request: APIRequestContext,
  boundary: ReleaseBoundary,
  observations: ObservationCounts = { attempted: 0, accepted: 0 },
  authentication: ObservationCounts = { attempted: 0, accepted: 0 },
  onViolation: () => void = () => {},
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
  const count = async (kind: string, response: ReturnType<APIRequestContext["fetch"]>) => {
    const counter = kind === "observation" ? observations : kind === "authentication" ? authentication : null;
    if (counter) counter.attempted += 1;
    const result = await response;
    if (result.status() >= 300 && result.status() < 400) {
      onViolation();
      throw new Error("Release API redirect refused");
    }
    if (counter && (kind === "observation" ? result.status() === 202 : result.ok())) counter.accepted += 1;
    return result;
  };
  const originalFetch = request.fetch.bind(request);
  request.fetch = ((url: string | Request, options?: Options) => {
    const kind = check(url, options?.method || (typeof url === "string" ? "GET" : url.method()), options);
    return count(kind, originalFetch(url, { ...options, maxRedirects: 0 }));
  }) as APIRequestContext["fetch"];
  for (const verb of ["get", "head", "post", "put", "patch", "delete"] as const) {
    request[verb] = ((url: string, options?: Options) => {
      const kind = check(url, verb.toUpperCase(), options);
      return count(kind, originalFetch(url, { ...options, method: verb.toUpperCase(), maxRedirects: 0 }));
    }) as APIRequestContext[typeof verb];
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

export async function installReleaseContextGuard(context: BrowserContext, boundary: ReleaseBoundary) {
  const observations = { attempted: 0, accepted: 0 };
  const authentication = { attempted: 0, accepted: 0 };
  const transport = {
    readFetchRetries: 0,
    suppressedAnalyticsBatches: 0,
    suppressedAnalyticsEvents: 0,
    suppressedCloudflareBeacons: 0,
  };
  const defects: string[] = [];
  const activeRoutes = new Set<Promise<void>>();
  let closing = false;
  installReleaseRequestGuard(context.request, boundary, observations, authentication,
    () => defects.push("APIRequestContext release boundary violation"));
  const handleRoute = async (route: Parameters<Parameters<BrowserContext["route"]>[1]>[0]) => {
    const request = route.request();
    const reject = async (code: string) => {
      defects.push(`Release request rejected [${code}]`);
      try { await route.abort("blockedbyclient"); } catch { /* Context teardown already owns this request. */ }
    };
    try {
      const upstream = developmentUpstream(boundary, request.url());
      const target = new URL(upstream);
      if (isExactReadonlyCloudflareBeacon(boundary, target, request.method())) {
        const headers = await request.allHeaders();
        if (headers.authorization || headers.cookie || headers["x-tenant-code"]) {
          await reject("credentials");
          return;
        }
        try {
          await route.fulfill({ status: 200, contentType: "application/javascript; charset=utf-8", body: "" });
          transport.suppressedCloudflareBeacons += 1;
        } catch { await reject("fulfill-transport"); }
        return;
      }
      let data: unknown;
      try { data = request.postDataJSON(); } catch { data = undefined; }
      let bodyBytes = 0;
      try {
        const raw = typeof request.postDataBuffer === "function" ? request.postDataBuffer() : null;
        bodyBytes = raw?.byteLength ?? new TextEncoder().encode(JSON.stringify(data)).byteLength;
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
        } catch { await reject("fulfill-transport"); }
        return;
      }
      const kind = assertReleaseRequestSafe(boundary, upstream, request.method(), tenantCode, data);
      const counter = kind === "observation" ? observations : kind === "authentication" ? authentication : null;
      if (counter) counter.attempted += 1;
      if (new URL(upstream).origin === boundary.apiOrigin) {
        const headers = await request.allHeaders();
        delete headers.host;
        // Transport only: unchanged artifact -> real isolated HTTP response.
        // Never follow a redirect carrying QA credentials to another origin.
        let response: Awaited<ReturnType<typeof route.fetch>>;
        try {
          response = await route.fetch({ url: upstream, headers, maxRedirects: 0 });
        } catch (error) {
          const code = releaseRequestFailureCode(error);
          const safeRead = ["GET", "HEAD", "OPTIONS"].includes(request.method().toUpperCase());
          if (!safeRead || code === "context-disposed") {
            await reject(code === "context-disposed" ? code : "fetch-transport");
            return;
          }
          transport.readFetchRetries += 1;
          await new Promise((resolve) => setTimeout(resolve, 500));
          try {
            response = await route.fetch({ url: upstream, headers, maxRedirects: 0 });
          } catch (retryError) {
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
        if (counter && (kind === "observation" ? response.status() === 202 : response.ok())) counter.accepted += 1;
        try { await route.fulfill({ response }); }
        catch {
          await reject("fulfill-transport");
        }
        return;
      }
    } catch (error) {
      // Upstream errors can contain credential-bearing URLs. Emit no raw error.
      await reject(releaseRequestFailureCode(error));
      return;
    }
    await route.continue();
  };
  await context.route("**/*", async (route) => {
    if (closing) {
      try { await route.abort("blockedbyclient"); } catch { /* Context teardown already owns this request. */ }
      return;
    }
    const handling = handleRoute(route);
    activeRoutes.add(handling);
    try { await handling; }
    finally { activeRoutes.delete(handling); }
  });
  return {
    observations,
    authentication,
    transport,
    async beginClose() {
      closing = true;
      await Promise.allSettled([...activeRoutes]);
    },
    assertClean() {
      if (defects.length) throw new Error(`Release API boundary failed: ${[...new Set(defects)].join("; ")}`);
    },
  };
}
