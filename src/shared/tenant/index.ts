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

  // Local/dev hosts: require explicit override (avoid guessing).
  if (host === "localhost" || host === "127.0.0.1") {
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

export type { TenantId } from "./config";
export { getTenantIdFromCode, getTenantBranding } from "./config";
