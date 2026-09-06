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
  const transport = { readFetchRetries: 0 };
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
      let data: unknown;
      try { data = request.postDataJSON(); } catch { data = undefined; }
      const kind = assertReleaseRequestSafe(boundary, upstream, request.method(), await request.headerValue("x-tenant-code") || undefined, data);
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
