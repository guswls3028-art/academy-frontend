// PATH: src/shared/tenant/index.ts
/**
 * Tenant Resolution SSOT (Enterprise)
 *
 * Backend contract:
 * - X-Tenant-Code header is required for most API endpoints (including /core/me)
 * - Tenant may be resolved via:
 *   1) Local override (localStorage)
 *   2) Hostname/subdomain convention
 *   3) Environment default (dev/bootstrap)
 *
 * NOTE:
 * - Do not "guess" tenant at API layer if it is ambiguous.
 * - If tenant is not resolved, UI must route user to tenant-select or show blocking screen.
 */

export const TENANT_STORAGE_KEY = "tenant_code";

export type TenantResolveResult =
  | { ok: true; code: string; source: "storage" | "hostname" | "env" }
  | { ok: false; reason: "missing" | "ambiguous" | "invalid_host" };

function safeGetHost(): string {
  try {
    return window.location.hostname || "";
  } catch {
    return "";
  }
}

export function getTenantCodeFromStorage(): string | null {
  try {
    const v = localStorage.getItem(TENANT_STORAGE_KEY);
    const code = (v || "").trim();
    return code ? code : null;
  } catch {
    return null;
  }
}

export function setTenantCodeToStorage(code: string) {
  const v = (code || "").trim();
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

/**
 * Hostname convention:
 * - hakwonplus.com / www.hakwonplus.com => do not infer from hostname
 * - {tenant}.hakwonplus.com => infer tenant=subdomain
 * - limglish.kr / www.limglish.kr => use env mapping if provided
 */
export function getTenantCodeFromHostname(hostname?: string): TenantResolveResult {
  const host = (hostname ?? safeGetHost()).trim().toLowerCase();
  if (!host) return { ok: false, reason: "invalid_host" };

  // limglish mapping
  if (host === "limglish.kr" || host === "www.limglish.kr") {
    const code = String(import.meta.env.VITE_TENANT_CODE_LIMGLISH || "").trim();
    if (code) return { ok: true, code, source: "env" };
    return { ok: false, reason: "missing" };
  }

  // hakwonplus base domains: don't infer from hostname (ambiguous)
  if (
    host === "hakwonplus.com" ||
    host === "www.hakwonplus.com" ||
    host === "api.hakwonplus.com" ||
    host.endsWith(".pages.dev")
  ) {
    return { ok: false, reason: "ambiguous" };
  }

  // subdomain inference: {tenant}.hakwonplus.com
  const suffix = ".hakwonplus.com";
  if (host.endsWith(suffix)) {
    const sub = host.slice(0, -suffix.length);
    // Reject common subdomains
    if (!sub || sub === "www" || sub === "api") {
      return { ok: false, reason: "ambiguous" };
    }
    return { ok: true, code: sub, source: "hostname" };
  }

  // local/dev hosts: do not infer from hostname
  if (host === "localhost" || host === "127.0.0.1") {
    return { ok: false, reason: "ambiguous" };
  }

  return { ok: false, reason: "ambiguous" };
}

export function getTenantCodeFromEnv(): string | null {
  const code = String(import.meta.env.VITE_TENANT_CODE || "").trim();
  return code ? code : null;
}

/**
 * Resolve tenant in deterministic priority order.
 */
export function resolveTenantCode(): TenantResolveResult {
  const stored = getTenantCodeFromStorage();
  if (stored) return { ok: true, code: stored, source: "storage" };

  const fromHost = getTenantCodeFromHostname();
  if (fromHost.ok) return fromHost;

  const env = getTenantCodeFromEnv();
  if (env) return { ok: true, code: env, source: "env" };

  return { ok: false, reason: "missing" };
}
