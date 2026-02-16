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

/** hostname → 테넌트 코드 (중앙 API로 요청할 때만 사용) */
const HOSTNAME_TO_TENANT_CODE: Record<string, string> = {
  "tchul.com": "tchul",
  "www.tchul.com": "tchul",
  "limglish.kr": "limglish",
  "www.limglish.kr": "limglish",
  "ymath.co.kr": "ymath",
  "www.ymath.co.kr": "ymath",
  "hakwonplus.com": "hakwonplus",
  "www.hakwonplus.com": "hakwonplus",
};

/**
 * 테넌트 코드 추출: 1) /login/tchul 2) hostname 3) sessionStorage
 * 중앙 API(다른 호스트)로 요청할 때만 사용.
 */
function getTenantCodeForRequest(): string | null {
  try {
    if (typeof window === "undefined") return null;
    const pathname = window.location.pathname;
    const parts = pathname.split("/").filter(Boolean);
    const loginIdx = parts.indexOf("login");
    const fromPath =
      loginIdx >= 0 && parts[loginIdx + 1] ? parts[loginIdx + 1] : null;
    if (fromPath) {
      sessionStorage.setItem("tenantCode", fromPath);
      return fromPath;
    }
    const fromHost =
      HOSTNAME_TO_TENANT_CODE[window.location.hostname] ||
      HOSTNAME_TO_TENANT_CODE[window.location.hostname.replace(/^www\./, "")];
    if (fromHost) {
      sessionStorage.setItem("tenantCode", fromHost);
      return fromHost;
    }
    return sessionStorage.getItem("tenantCode");
  } catch {
    return null;
  }
}

/**
 * 1테넌트 = 1도메인이면 API 요청 Host와 페이지 Host가 같음 → request.get_host()로 테넌트 판별 가능.
 * 중앙 API(다른 호스트)로 요청할 때만 X-Tenant-Code 전송.
 */
function isCrossOriginApi(): boolean {
  if (typeof window === "undefined" || !API_BASE) return false;
  try {
    const apiHost = new URL(API_BASE.replace(/\/$/, "") || "http://x").hostname;
    const pageHost = window.location.hostname;
    return apiHost !== pageHost;
  } catch {
    return false;
  }
}

/**
 * Request interceptor
 * - attach JWT Bearer (if available)
 * - X-Tenant-Code: 중앙 API(다른 호스트)로 요청할 때만 전송. 1테넌트=1도메인이면 Host만으로 판별하므로 미전송.
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

  // 1테넌트=1도메인(tchul.com, ymath.co.kr 등)이면 API도 같은 도메인 → Host로 테넌트 판별, 헤더 불필요.
  // 중앙 API(api.hakwonplus.com 등 다른 호스트)로 요청할 때만 X-Tenant-Code 전송.
  if (isCrossOriginApi()) {
    const tenantCode = getTenantCodeForRequest();
    if (tenantCode) {
      (cfg.headers as any)["X-Tenant-Code"] = tenantCode;
    }
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
