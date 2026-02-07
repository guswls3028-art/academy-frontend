// PATH: src/shared/api/axios.ts
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import {
  resolveTenantCode,
  getTenantCodeFromStorage,
} from "@/shared/tenant";

type RetryConfig = AxiosRequestConfig & {
  _retry?: boolean;
};

type RefreshResponse = { access: string };

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || "").trim();

// 디버그용 (원본 유지)
console.log("VITE_API_BASE_URL =", import.meta.env.VITE_API_BASE_URL);

function getAccessToken(): string | null {
  try {
    const t = localStorage.getItem("access");
    return t ? t : null;
  } catch {
    return null;
  }
}

function getRefreshToken(): string | null {
  try {
    const t = localStorage.getItem("refresh");
    return t ? t : null;
  } catch {
    return null;
  }
}

function setAccessToken(token: string) {
  try {
    localStorage.setItem("access", token);
  } catch {
    // ignore
  }
}

function clearTokens() {
  try {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
  } catch {
    // ignore
  }
}

/**
 * Enterprise Refresh Concurrency Control
 * - multiple requests may fail with 401 simultaneously
 * - refresh only once, queue others, then replay
 */
let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

function enqueueRefresh(cb: (token: string | null) => void) {
  refreshQueue.push(cb);
}

function flushRefreshQueue(token: string | null) {
  const q = [...refreshQueue];
  refreshQueue = [];
  q.forEach((cb) => cb(token));
}

function buildTenantHeader(): string | null {
  // Deterministic: storage first (UI can set), then resolver
  const stored = getTenantCodeFromStorage();
  if (stored) return stored;

  const r = resolveTenantCode();
  return r.ok ? r.code : null;
}

function shouldSkipAuth(url?: string) {
  const u = String(url || "");
  // backend bypass: /api/v1/token/, /api/v1/token/refresh/
  // but it's OK to still attach tenant if available; auth header should be omitted if no access exists
  return u.includes("/token/") || u.includes("/token/refresh/");
}

function isAxiosError(e: any): e is AxiosError {
  return !!e?.isAxiosError;
}

const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  timeout: 20_000,
  // JWT-only contract: do NOT rely on cookies
  withCredentials: false,
});

/**
 * Request interceptor
 * - attach JWT Bearer (if available)
 * - attach tenant header (if resolved)
 * - attach correlation headers (optional operational)
 */
api.interceptors.request.use((config) => {
  const cfg = config;

  // Attach tenant if resolved
  const tenantCode = buildTenantHeader();
  if (tenantCode) {
    cfg.headers = cfg.headers ?? {};
    (cfg.headers as any)["X-Tenant-Code"] = tenantCode;
  }

  // Attach Authorization if access exists (JWT)
  if (!shouldSkipAuth(cfg.url)) {
    const access = getAccessToken();
    if (access) {
      cfg.headers = cfg.headers ?? {};
      (cfg.headers as any).Authorization = `Bearer ${access}`;
    }
  }

  // Optional operational headers
  cfg.headers = cfg.headers ?? {};
  (cfg.headers as any)["X-Client"] = "academyfront";
  (cfg.headers as any)["X-Client-Version"] = String(import.meta.env.VITE_APP_VERSION || "dev");

  return cfg;
});

/**
 * Refresh token (raw axios instance without interceptors to avoid loops)
 */
async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  try {
    const res = await axios.post<RefreshResponse>(
      `${API_BASE}/api/v1/token/refresh/`,
      { refresh },
      { timeout: 20_000, withCredentials: false }
    );
    const newAccess = String(res.data?.access || "").trim();
    if (!newAccess) return null;
    setAccessToken(newAccess);
    return newAccess;
  } catch {
    return null;
  }
}

/**
 * Response interceptor
 * - 401: attempt refresh ONCE, then replay original request
 * - 403: do not refresh (tenant/membership/role), fail-fast
 */
api.interceptors.response.use(
  (res: AxiosResponse) => res,
  async (err: any) => {
    if (!isAxiosError(err)) throw err;

    const status = err.response?.status;
    const original = err.config as RetryConfig | undefined;

    // network or no config
    if (!original) throw err;

    // 403: tenant/membership/permission issue (refresh won't help)
    if (status === 403) {
      throw err;
    }

    // 401: try refresh once
    if (status === 401 && !original._retry && !shouldSkipAuth(original.url)) {
      original._retry = true;

      // If already refreshing: queue and replay when ready
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          enqueueRefresh((token) => {
            if (!token) {
              clearTokens();
              reject(err);
              return;
            }
            original.headers = original.headers ?? {};
            (original.headers as any).Authorization = `Bearer ${token}`;
            resolve(api.request(original));
          });
        });
      }

      isRefreshing = true;
      const newAccess = await refreshAccessToken();
      isRefreshing = false;

      // Flush waiting queue
      flushRefreshQueue(newAccess);

      if (!newAccess) {
        clearTokens();
        throw err;
      }

      // Replay original request with new token
      original.headers = original.headers ?? {};
      (original.headers as any).Authorization = `Bearer ${newAccess}`;
      return api.request(original);
    }

    throw err;
  }
);

export default api;
