// PATH: src/shared/api/axios.ts
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";
import { asyncStatusStore } from "@/shared/ui/asyncStatus/asyncStatusStore";
import { getTenantCodeForApiRequest } from "@/shared/tenant";

type RetryConfig = AxiosRequestConfig & {
  _retry?: boolean;
  _asyncId?: string;
};

/** AllowAny 엔드포인트(예: /core/program/) 호출 시 만료 토큰 401 방지 */
export type ApiRequestConfig = AxiosRequestConfig & { skipAuth?: boolean };

type RefreshResponse = { access: string };

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || "").trim();

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

function shouldSkipAuth(url?: string, config?: AxiosRequestConfig) {
  const u = String(url || "");
  if ((config as any)?.skipAuth === true) return true;
  return u.includes("/token/") || u.includes("/token/refresh/");
}

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
 * JWT exp 디코딩 (base64url → JSON).
 * 토큰이 만료되었거나 EXPIRY_BUFFER_SEC 이내로 만료 예정이면 true 반환.
 */
const EXPIRY_BUFFER_SEC = 30;

function isTokenExpiredOrSoon(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    const exp = payload?.exp;
    if (typeof exp !== "number") return true;
    return Date.now() / 1000 >= exp - EXPIRY_BUFFER_SEC;
  } catch {
    return true; // 파싱 실패 → 만료로 취급
  }
}

/**
 * 요청 전 선제적 토큰 리프레시.
 * access 토큰이 곧 만료되면 request interceptor 단계에서 미리 refresh 하여
 * 401 응답 자체를 방지한다 (브라우저 콘솔 401 로그 제거).
 */
let proactiveRefreshPromise: Promise<string | null> | null = null;

async function ensureFreshToken(): Promise<string | null> {
  const access = getAccessToken();
  if (!access) return null;
  if (!isTokenExpiredOrSoon(access)) return access;

  // 이미 리프레시 진행 중이면 대기
  if (proactiveRefreshPromise) return proactiveRefreshPromise;

  proactiveRefreshPromise = refreshAccessToken().finally(() => {
    proactiveRefreshPromise = null;
  });
  return proactiveRefreshPromise;
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
 * 테넌트 코드: shared/tenant SSOT 사용 (hostname → config → X-Tenant-Code)
 * 중앙 API(api.hakwonplus.com)로 요청 시 필수.
 */

/**
 * Request interceptor
 * - attach JWT Bearer (if available)
 * - X-Tenant-Code: 테넌트 코드가 있으면 항상 전송. 중앙 API(api.hakwonplus.com)는 이걸로 테넌트 판별.
 *   (1테넌트=1도메인이면 백엔드가 Host로 판별하고 헤더는 무시됨)
 */
api.interceptors.request.use(async (config) => {
  const cfg = config;

  // Attach Authorization if access exists (JWT)
  // skipAuth: true → 로그인 전 /core/program/ 등 AllowAny 엔드포인트용 (만료 토큰 시 401 방지)
  if (!shouldSkipAuth(cfg.url, cfg)) {
    // 선제적 토큰 리프레시: 만료 임박 시 요청 전에 갱신하여 401 방지
    const access = await ensureFreshToken();
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

  // 테넌트 코드가 있으면 항상 전송 (B 구조: tchul.com → api.hakwonplus.com 에서 필수)
  const tenantCode = getTenantCodeForApiRequest();
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
 * CORS-blocked 401 감지:
 * 서버가 401 응답에 CORS 헤더를 빠뜨리면 브라우저가 응답을 차단하여
 * err.response 가 undefined 인 네트워크 에러로 나타남.
 * 이때 Authorization 헤더가 있었으면 인증 실패로 간주.
 */
function isCorsBlocked401(err: AxiosError): boolean {
  if (err.response) return false; // 서버 응답이 있으면 CORS 차단 아님
  if (err.code === "ECONNABORTED") return false; // 타임아웃
  const auth = (err.config?.headers as any)?.Authorization;
  return !!auth; // Authorization 헤더가 있었는데 응답 없음 → CORS 차단된 401 가능성
}

/**
 * Response interceptor
 * - 비동기 SSOT: 성공/실패 시 해당 요청 완료 처리
 * - 401: attempt refresh ONCE, then replay original request
 * - 403: do not refresh (membership/role), fail-fast
 * - CORS-blocked 401: 네트워크 에러로 나타나는 경우에도 인증 실패 처리
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

    if (status === 402) {
      // Subscription expired — broadcast to UI
      try { window.dispatchEvent(new CustomEvent("subscription-expired", { detail: err.response?.data })); } catch { /* ignore */ }
      throw err;
    }

    if (status === 403) {
      throw err;
    }

    // 401 또는 CORS 차단된 401: refresh 시도
    const is401 = status === 401;
    const isCorsAuth = !is401 && isCorsBlocked401(err);

    if ((is401 || isCorsAuth) && !original._retry && !shouldSkipAuth(original.url, original)) {
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
        // 세션 만료 플래그 — AuthContext에서 감지하여 안내 메시지 표시
        try { sessionStorage.setItem("session_expired", "1"); } catch { /* ignore */ }
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
