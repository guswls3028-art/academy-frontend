// PATH: src/shared/tenant/index.ts
/**
 * Tenant Resolution SSOT (Enterprise / Backend-First)
 *
 * ✅ Backend SSOT:
 * - Tenant is resolved by request host (request.get_host()).
 * - Tenant.code must match host (normalized, without port).
 * - No backend fallback resolver.
 *
 * ✅ Frontend SSOT:
 * - Do NOT invent tenant codes (no aliases like "default", "2_limglish").
 * - Canonical tenant code in production = current hostname (normalized).
 *
 * Allowed explicit overrides (dev/bootstrap only):
 * - Local storage override (TENANT_STORAGE_KEY)
 * - VITE_TENANT_CODE (explicit dev override)
 *
 * Notes:
 * - Even if backend ignores X-Tenant-Code (host-based resolution), sending it is harmless
 *   and helps transitional tooling / diagnostics.
 */

import { HOSTNAME_TO_TENANT_CODE } from "./config";

export const TENANT_STORAGE_KEY = "tenant_code";

export type TenantResolveResult =
  | { ok: true; code: string; source: "storage" | "env" | "hostname" }
  | { ok: false; reason: "missing" | "invalid_host" };

function normalizeHost(host: string): string {
  const v = String(host || "").trim().toLowerCase();
  if (!v) return "";
  return v.split(":")[0].trim();
}

function safeGetHostname(): string {
  try {
    return normalizeHost(window.location.hostname || "");
  } catch {
    return "";
  }
}

export function getTenantCodeFromStorage(): string | null {
  try {
    const v = localStorage.getItem(TENANT_STORAGE_KEY);
    const code = String(v || "").trim();
    return code ? code : null;
  } catch {
    return null;
  }
}

export function setTenantCodeToStorage(code: string) {
  const v = String(code || "").trim();
  if (!v) return;
  try {
    localStorage.setItem(TENANT_STORAGE_KEY, v);
  } catch {
    // ignore
  }
}

export function clearTenantCodeFromStorage() {
  try {
    localStorage.removeItem(TENANT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getTenantCodeFromEnv(): string | null {
  const code = String(import.meta.env.VITE_TENANT_CODE || "").trim();
  return code ? code : null;
}

/**
 * Canonical hostname contract (prod):
 * - If hostname exists and is not local/dev-like: tenant code == hostname.
 * - For localhost/dev preview domains: require explicit override (storage/env).
 */
export function getTenantCodeFromHostname(hostname?: string): TenantResolveResult {
  const host = normalizeHost(hostname ?? safeGetHostname());
  if (!host) return { ok: false, reason: "invalid_host" };

  // Local/dev: use dev tenant 9999 from config so localhost works without env/storage.
  if (host === "localhost" || host === "127.0.0.1") {
    const devCode = HOSTNAME_TO_TENANT_CODE[host];
    if (devCode) return { ok: true, code: devCode, source: "hostname" };
    return { ok: false, reason: "missing" };
  }

  // Preview/temporary domains: require explicit override unless you truly use them as tenant codes.
  if (host.endsWith(".pages.dev") || host.endsWith(".trycloudflare.com")) {
    return { ok: false, reason: "missing" };
  }

  return { ok: true, code: host, source: "hostname" };
}

/**
 * Resolve tenant in deterministic priority order:
 * 1) storage (operator choice)
 * 2) env (explicit dev setting)
 * 3) hostname (prod canonical)
 */
export function resolveTenantCode(): TenantResolveResult {
  const stored = getTenantCodeFromStorage();
  if (stored) return { ok: true, code: stored, source: "storage" };

  const env = getTenantCodeFromEnv();
  if (env) return { ok: true, code: env, source: "env" };

  const fromHost = getTenantCodeFromHostname();
  if (fromHost.ok) return fromHost;

  return { ok: false, reason: "missing" };
}

/**
 * Header helper (API layer use):
 * - Must be deterministic and non-magical.
 * - Prefer explicit sources; do not infer from hostname here.
 */
export function getTenantCodeForHeader(): string | null {
  const stored = getTenantCodeFromStorage();
  if (stored) return stored;

  const env = getTenantCodeFromEnv();
  if (env) return env;

  return null;
}

/**
 * API 요청 시 X-Tenant-Code 값 (SSOT)
 * - 중앙 API(api.hakwonplus.com)로 요청할 때 필수.
 * - 로컬(localhost/127.0.0.1): 경로(/login/xxx)·sessionStorage 우선 → 태넌트별 완전 격리(1 vs 9999).
 * - 그 외: 1) hostname(도메인) 2) /login/xxx 경로 3) sessionStorage
 */
export function getTenantCodeForApiRequest(): string | null {
  try {
    if (typeof window === "undefined") return null;
    const hostname = (window.location.hostname || "").trim().toLowerCase();
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1";

    if (isLocal) {
      // 로컬에서는 경로·sessionStorage 우선 — 1번/9999 등 테넌트 구분
      const pathname = window.location.pathname || "";
      const parts = pathname.split("/").filter(Boolean);
      const loginIdx = parts.indexOf("login");
      const fromPath =
        loginIdx >= 0 && parts[loginIdx + 1] ? parts[loginIdx + 1] : null;
      if (fromPath) {
        try {
          sessionStorage.setItem("tenantCode", fromPath);
        } catch {}
        return fromPath;
      }
      try {
        const stored = sessionStorage.getItem("tenantCode");
        if (stored) return stored;
      } catch {}
      return HOSTNAME_TO_TENANT_CODE[hostname] ?? null;
    }

    const fromHost =
      HOSTNAME_TO_TENANT_CODE[hostname] ||
      HOSTNAME_TO_TENANT_CODE[hostname.replace(/^www\./, "")];
    if (fromHost) {
      try {
        sessionStorage.setItem("tenantCode", fromHost);
      } catch {}
      return fromHost;
    }
    const pathname = window.location.pathname || "";
    const parts = pathname.split("/").filter(Boolean);
    const loginIdx = parts.indexOf("login");
    const fromPath =
      loginIdx >= 0 && parts[loginIdx + 1] ? parts[loginIdx + 1] : null;
    if (fromPath) {
      try {
        sessionStorage.setItem("tenantCode", fromPath);
      } catch {}
      return fromPath;
    }
    try {
      return sessionStorage.getItem("tenantCode");
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

export type { TenantId } from "./config";
export {
  getTenantIdFromCode,
  getTenantBranding,
  HOSTNAME_TO_TENANT_CODE,
  getLoginPathForTenantId,
  getTenantIdsWithDedicatedLogin,
  TENANTS,
} from "./config";
