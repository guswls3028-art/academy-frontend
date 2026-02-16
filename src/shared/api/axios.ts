// PATH: src/shared/api/axios.ts
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";
import { asyncStatusStore } from "@/shared/ui/asyncStatus/asyncStatusStore";

type RetryConfig = AxiosRequestConfig & {
  _retry?: boolean;
  _asyncId?: string;
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

function shouldSkipAuth(url?: string) {
  const u = String(url || "");
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
 * 테넌트 코드 추출: /login/tchul → tchul (로그인 후 /admin 이동해도 sessionStorage로 유지)
 */
function getTenantCodeForRequest(): string | null {
  try {
    const pathname = typeof window !== "undefined" ? window.location.pathname : "";
    const parts = pathname.split("/").filter(Boolean);
    const loginIdx = parts.indexOf("login");
    const fromPath =
      loginIdx >= 0 && parts[loginIdx + 1] ? parts[loginIdx + 1] : null;
    if (fromPath) {
      sessionStorage.setItem("tenantCode", fromPath);
      return fromPath;
    }
    return sessionStorage.getItem("tenantCode");
  } catch {
    return null;
  }
}

/**
 * Request interceptor
 * - attach JWT Bearer (if available)
 * - attach X-Tenant-Code when SPA is on tenant domain (e.g. tchul.com) but API is api.hakwonplus.com
 */
api.interceptors.request.use((config) => {
  const cfg = config;

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
  (cfg.headers as any)["X-Client-Version"] = String(
    import.meta.env.VITE_APP_VERSION || "dev"
  );

  // 중앙 API(api.hakwonplus.com)로 요청 시 테넌트 식별용 (백엔드 resolver가 Host 대신 이걸 사용)
  const tenantCode = getTenantCodeForRequest();
  if (tenantCode) {
    (cfg.headers as any)["X-Tenant-Code"] = tenantCode;
  }

  // 전역 비동기 상태 SSOT: 요청 시작 시 Pending 등록
  const asyncId = asyncStatusStore.trackRequest(
    cfg.method ?? "get",
    cfg.url,
    cfg as AxiosRequestConfig & { meta?: { asyncLabel?: string } }
  );
  if (asyncId) (cfg as RetryConfig)._asyncId = asyncId;

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
 * - 비동기 SSOT: 성공/실패 시 해당 요청 완료 처리
 * - 401: attempt refresh ONCE, then replay original request
 * - 403: do not refresh (membership/role), fail-fast
 */
api.interceptors.response.use(
  (res: AxiosResponse) => {
    const id = (res.config as RetryConfig)._asyncId;
    if (id) asyncStatusStore.completeTask(id, "success");
    return res;
  },
  async (err: any) => {
    const config = err?.config as RetryConfig | undefined;
    const asyncId = config?._asyncId;
    if (asyncId)
      asyncStatusStore.completeTask(
        asyncId,
        "error",
        err?.response?.data?.detail ?? err?.message ?? "오류"
      );
    if (!isAxiosError(err)) throw err;

    const status = err.response?.status;
    const original = err.config as RetryConfig | undefined;

    if (!original) throw err;

    if (status === 403) {
      throw err;
    }

    if (status === 401 && !original._retry && !shouldSkipAuth(original.url)) {
      original._retry = true;

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

      flushRefreshQueue(newAccess);

      if (!newAccess) {
        clearTokens();
        throw err;
      }

      original.headers = original.headers ?? {};
      (original.headers as any).Authorization = `Bearer ${newAccess}`;
      return api.request(original);
    }

    throw err;
  }
);

export default api;
