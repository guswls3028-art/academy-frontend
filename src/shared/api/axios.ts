// PATH: src/shared/api/axios.ts
import axios, {
  AxiosError,
  AxiosHeaders,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  type AxiosHeaderValue,
} from "axios";
import { asyncStatusStore } from "@/shared/ui/asyncStatus/asyncStatusStore";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { captureApiError } from "@/shared/lib/sentryContext";
import {
  getSessionItem,
  removeSessionItem,
  setSessionItem,
} from "@/shared/utils/safeSessionStorage";
import {
  AuthTokenStorageError,
  clearAuthTokenEnvelope,
  notifyAuthTokenStorageError,
  publishRefreshedTokenEnvelope,
  readAuthTokenEnvelope,
  readAuthTokenEnvelopeSafely,
  withAuthSessionLock,
} from "@/shared/auth/tokenSession";
import {
  endStudentSupportSession,
  getStudentSupportAccessToken,
  isStudentSupportWindow,
} from "@/shared/auth/supportPreviewSession";

type RetryConfig = AxiosRequestConfig & {
  _retry?: boolean;
  _asyncId?: string;
  _transientRetryCount?: number;
  _authGeneration?: string | null;
};

/** AllowAny 엔드포인트(예: /core/program/) 호출 시 만료 토큰 401 방지 */
export type ApiRequestConfig = AxiosRequestConfig & { skipAuth?: boolean };

type RefreshResponse = { access: string; refresh?: string };
type AuthAccessResult = {
  access: string;
  refresh: string;
  generation: string;
  sessionChanged: boolean;
  reusedRotation: boolean;
};
type HeaderSeed = AxiosHeaders | Record<string, AxiosHeaderValue> | string | undefined;

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || "").trim();

export function getAccessToken(): string | null {
  if (isStudentSupportWindow()) return getStudentSupportAccessToken();
  return readAuthTokenEnvelopeSafely()?.access ?? null;
}

/** 토큰 정리 SSOT — 모든 로그아웃/세션만료 경로에서 이 함수를 사용 */
export function clearTokens(expectedGeneration?: string | null) {
  if (isStudentSupportWindow()) {
    endStudentSupportSession();
    removeSessionItem("session_expired");
    removeSessionItem("session_return_path");
    removeSessionItem("product_analytics_session_id");
    window.dispatchEvent(new Event("product-analytics-session-reset"));
    return;
  }
  try {
    clearAuthTokenEnvelope(expectedGeneration);
  } catch (error) {
    if (error instanceof AuthTokenStorageError) notifyAuthTokenStorageError(error);
    throw error;
  }
  try {
    localStorage.removeItem("parent_selected_student_id");
    localStorage.removeItem("hakwonplus:excel-job-recovery:v1");
    // tenant-scoped parent selection keys cleanup
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith("parent_selected_student_id_")) {
        localStorage.removeItem(k);
      }
    }
    removeSessionItem("session_expired");
    removeSessionItem("session_return_path");
    removeSessionItem("tenantCode");
    removeSessionItem("product_analytics_session_id");
    window.dispatchEvent(new Event("product-analytics-session-reset"));
  } catch {
    // Non-auth preference/session cleanup remains best effort. The token
    // generation removal above is the fail-closed logout boundary.
  }
}

/** 세션 만료 시 현재 경로를 저장하여 재로그인 후 복귀할 수 있게 한다 */
export function saveReturnPath() {
  if (isStudentSupportWindow()) return;
  try {
    const path = window.location.pathname + window.location.search + window.location.hash;
    // /login 자체이거나 빈 경로는 저장하지 않음
    if (path && path !== "/login" && !path.startsWith("/login")) {
      setSessionItem("session_return_path", path);
    }
  } catch { /* ignore */ }
}

/** 저장된 복귀 경로를 꺼내고 삭제 (1회용) */
export function consumeReturnPath(): string | null {
  try {
    const path = getSessionItem("session_return_path");
    removeSessionItem("session_return_path");
    return path || null;
  } catch {
    return null;
  }
}

/** 세션 종료 중복 방지 플래그 — axios interceptor가 이미 /login 리다이렉트 중이면 true */
export let isSessionEnding = false;

export function markSessionEnding() {
  isSessionEnding = true;
}

export function resetSessionEnding() {
  isSessionEnding = false;
}

function endExpiredSession(expectedGeneration?: string | null) {
  const supportWindow = isStudentSupportWindow();
  if (!supportWindow && isSessionEnding) return;
  clearTokens(expectedGeneration);
  if (supportWindow) {
    window.location.href = "/support-preview-ended";
    return;
  }

  markSessionEnding();
  try {
    setSessionItem("session_expired", "1");
  } catch { /* ignore */ }
  saveReturnPath();
  window.location.href = "/login";
}

function shouldSkipAuth(url?: string, config?: ApiRequestConfig) {
  const u = String(url || "");
  if (config?.skipAuth === true) return true;
  return u.includes("/token/") || u.includes("/token/refresh/");
}

function isTokenEndpoint(url?: string): boolean {
  const u = String(url || "");
  return u.includes("/token/") || u.includes("/token/refresh/");
}

function setRequestHeader(config: AxiosRequestConfig, key: string, value: string) {
  const headers = AxiosHeaders.from(config.headers as HeaderSeed);
  headers.set(key, value);
  config.headers = headers;
}

function getParentSelectedStudentIdForHeader(): string | null {
  if (typeof window === "undefined") return null;
  if (!window.location.pathname.startsWith("/student")) return null;

  const tenantCode = getTenantCodeForApiRequest();
  if (!tenantCode) return null;

  try {
    const raw = localStorage.getItem(`parent_selected_student_id_${tenantCode}`);
    if (!raw) return null;
    const id = Number.parseInt(raw, 10);
    return Number.isFinite(id) && id > 0 ? String(id) : null;
  } catch {
    return null;
  }
}

function hasRequestHeader(config: AxiosRequestConfig, key: string): boolean {
  return AxiosHeaders.from(config.headers as HeaderSeed).has(key);
}

function currentSessionResult(
  submittedGeneration: string,
  submittedRefresh: string,
): AuthAccessResult | null {
  const current = readAuthTokenEnvelope();
  if (!current || isTokenExpiredOrSoon(current.access)) return null;
  if (current.generation !== submittedGeneration) {
    return { ...current, sessionChanged: true, reusedRotation: false };
  }
  if (current.refresh !== submittedRefresh) {
    return { ...current, sessionChanged: false, reusedRotation: true };
  }
  return null;
}

async function requestRefreshedAccess(
  generation: string,
  refresh: string,
): Promise<AuthAccessResult | null> {
  try {
    const headers: Record<string, string> = {};
    const tenantCode = getTenantCodeForApiRequest();
    if (tenantCode) headers["X-Tenant-Code"] = tenantCode;

    const res = await axios.post<RefreshResponse>(
      `${API_BASE}/api/v1/token/refresh/`,
      { refresh },
      { timeout: 20_000, withCredentials: false, headers }
    );

    const newAccess = String(res.data?.access || "").trim();
    if (!newAccess) {
      return currentSessionResult(generation, refresh);
    }

    const newRefresh = String(res.data?.refresh || "").trim();
    const published = publishRefreshedTokenEnvelope(
      generation,
      refresh,
      newAccess,
      newRefresh || refresh,
    );
    if (!published) return currentSessionResult(generation, refresh);
    return {
      ...published,
      sessionChanged: false,
      reusedRotation: false,
    };
  } catch (error) {
    if (error instanceof AuthTokenStorageError) throw error;
    // Browsers without Web Locks can still race across tabs. If another tab
    // already rotated the shared token while this request was in flight, reuse
    // that valid result instead of expiring the newly authenticated session.
    return currentSessionResult(generation, refresh);
  }
}

/**
 * Refresh token single-flight boundary.
 *
 * The module promise joins proactive and reactive refreshes in one tab. The
 * Web Lock serializes the same rotation across tabs; a waiter reuses the token
 * another tab already rotated instead of submitting the now-blacklisted old
 * refresh token and clearing the valid replacement.
 */
let refreshPromise: { generation: string; pending: Promise<AuthAccessResult | null> } | null = null;

async function refreshAccessToken(): Promise<AuthAccessResult | null> {
  const initial = readAuthTokenEnvelope();
  if (!initial) return null;
  if (refreshPromise?.generation === initial.generation) return refreshPromise.pending;

  const refreshUnderLock = async (): Promise<AuthAccessResult | null> => {
    const current = readAuthTokenEnvelope();
    if (!current) return null;
    if (
      current.generation !== initial.generation
      || current.refresh !== initial.refresh
    ) {
      return currentSessionResult(initial.generation, initial.refresh);
    }
    return requestRefreshedAccess(current.generation, current.refresh);
  };

  const pending = withAuthSessionLock(refreshUnderLock).finally(() => {
    if (refreshPromise?.pending === pending) refreshPromise = null;
  });
  refreshPromise = { generation: initial.generation, pending };
  return pending;
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
async function ensureFreshToken(): Promise<AuthAccessResult | null> {
  const current = readAuthTokenEnvelope();
  if (!current) return null;
  if (!isTokenExpiredOrSoon(current.access)) {
    return {
      ...current,
      sessionChanged: false,
      reusedRotation: false,
    };
  }

  return refreshAccessToken();
}

export function isApiError(e: unknown): e is AxiosError {
  return axios.isAxiosError(e);
}

export function getApiErrorStatus(e: unknown): number | null {
  return isApiError(e) ? (e.response?.status ?? null) : null;
}

export function isApiErrorStatus(e: unknown, status: number | readonly number[]): boolean {
  const actual = getApiErrorStatus(e);
  return Array.isArray(status) ? actual != null && status.includes(actual) : actual === status;
}

function getApiErrorMessage(err: unknown): string {
  if (isApiError(err)) {
    const data = err.response?.data;
    if (data && typeof data === "object" && "detail" in data) {
      const detail = data.detail;
      if (typeof detail === "string" && detail.trim()) return detail;
    }
    if (typeof data === "string" && data.trim()) return data;
    if (err.message) return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return "오류";
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
  const retryCfg = cfg as RetryConfig;

  // Attach Authorization if access exists (JWT)
  // skipAuth: true → 로그인 전 /core/program/ 등 AllowAny 엔드포인트용 (만료 토큰 시 401 방지)
  if (!shouldSkipAuth(cfg.url, cfg)) {
    if (isStudentSupportWindow()) {
      const supportAccess = getStudentSupportAccessToken();
      if (supportAccess) setRequestHeader(cfg, "Authorization", `Bearer ${supportAccess}`);
    } else {
      try {
        const current = readAuthTokenEnvelope();
        const currentGeneration = current?.generation ?? null;
        if (
          retryCfg._authGeneration !== undefined
          && retryCfg._authGeneration !== currentGeneration
        ) {
          throw new axios.CanceledError("Authentication session changed.");
        }
        if (retryCfg._authGeneration === undefined) {
          retryCfg._authGeneration = currentGeneration;
        }

        // 선제적 토큰 리프레시: 만료 임박 시 요청 전에 갱신하여 401 방지
        const auth = await ensureFreshToken();
        if (auth?.sessionChanged || (auth && auth.generation !== retryCfg._authGeneration)) {
          throw new axios.CanceledError("Authentication session changed.");
        }
        if (auth) setRequestHeader(cfg, "Authorization", `Bearer ${auth.access}`);
      } catch (error) {
        if (error instanceof AuthTokenStorageError) notifyAuthTokenStorageError(error);
        throw error;
      }
    }
  }

  // Optional operational headers
  setRequestHeader(cfg, "X-Client", "academyfront");
  setRequestHeader(cfg, "X-Client-Version", String(
    import.meta.env.VITE_APP_VERSION || "dev"
  ));

  // 테넌트 코드가 있으면 항상 전송 (B 구조: tchul.com → api.hakwonplus.com 에서 필수)
  const tenantCode = getTenantCodeForApiRequest();
  if (tenantCode) {
    setRequestHeader(cfg, "X-Tenant-Code", tenantCode);
  }

  const selectedStudentId = getParentSelectedStudentIdForHeader();
  if (selectedStudentId && !hasRequestHeader(cfg, "X-Student-Id")) {
    setRequestHeader(cfg, "X-Student-Id", selectedStudentId);
  }

  // 전역 비동기 상태 SSOT: 요청 시작 시 Pending 등록. 내부 재시도는 같은 task를 유지한다.
  if (!retryCfg._asyncId) {
    const asyncId = asyncStatusStore.trackRequest(
      cfg.method ?? "get",
      cfg.url,
      cfg as AxiosRequestConfig & { meta?: { asyncLabel?: string } }
    );
    if (asyncId) retryCfg._asyncId = asyncId;
  }

  return cfg;
});

/**
 * 네트워크 에러와 CORS-blocked 401 분리:
 * - err.response 부재 + Authorization 헤더만으로 401 단정하면 오프라인/DNS 실패/
 *   연결 거부 등 일반 네트워크 장애도 강제 로그아웃으로 이어진다.
 * - axios는 일반 네트워크 실패에 err.code 'ERR_NETWORK' / 'ECONNABORTED' /
 *   'ENOTFOUND' / 'ECONNRESET' 등을 채운다 → 이 경우는 인증 실패가 아닌 네트워크 실패.
 * - CORS-blocked 401은 브라우저에서 클라이언트 코드가 신뢰성 있게 구별 불가 →
 *   안전한 default는 "네트워크 에러로 처리"(세션 보존). 실제 401 상태만 refresh/로그아웃.
 */
const NETWORK_ERROR_CODES = new Set([
  "ECONNABORTED",     // 타임아웃
  "ERR_NETWORK",      // 일반 네트워크 실패
  "ENOTFOUND",        // DNS 실패
  "ECONNRESET",       // 연결 끊김
  "ECONNREFUSED",     // 서버 거부
  "ETIMEDOUT",        // 타임아웃
  "ERR_INTERNET_DISCONNECTED",
]);

const TRANSIENT_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const TRANSIENT_RETRY_METHODS = new Set(["get", "head", "options"]);
const MAX_TRANSIENT_RETRIES = 2;
const TRANSIENT_RETRY_BASE_DELAY_MS = 350;

function isNetworkError(err: AxiosError): boolean {
  if (err.response) return false;
  if (err.code && NETWORK_ERROR_CODES.has(err.code)) return true;
  // err.code 없이 response 없는 케이스: 'Network Error' 메시지 휴리스틱
  if (typeof err.message === "string" && /network/i.test(err.message)) return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalizedMethod(config?: AxiosRequestConfig): string {
  return String(config?.method || "get").toLowerCase();
}

function isAbortLikeError(err: AxiosError): boolean {
  const message = `${err.code || ""} ${err.message || ""}`;
  return /ERR_CANCELED|AbortError|canceled|cancelled/i.test(message);
}

function retryAfterDelayMs(err: AxiosError): number | null {
  const raw = err.response?.headers?.["retry-after"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || !value.trim()) return null;

  const seconds = Number.parseFloat(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, Math.min(seconds * 1000, 3_000));
  }

  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, Math.min(dateMs - Date.now(), 3_000));
  }
  return null;
}

function shouldRetryTransientApiError(err: AxiosError, config: RetryConfig): boolean {
  if (config.signal?.aborted || isAbortLikeError(err)) return false;
  if (!TRANSIENT_RETRY_METHODS.has(normalizedMethod(config))) return false;
  if (isTokenEndpoint(config.url)) return false;
  if ((config._transientRetryCount ?? 0) >= MAX_TRANSIENT_RETRIES) return false;

  const status = err.response?.status;
  if (typeof status === "number" && TRANSIENT_HTTP_STATUSES.has(status)) return true;
  return isNetworkError(err);
}

async function retryTransientApiRequest(config: RetryConfig, err: AxiosError): Promise<AxiosResponse> {
  const retryCount = (config._transientRetryCount ?? 0) + 1;
  config._transientRetryCount = retryCount;
  const retryAfter = retryAfterDelayMs(err);
  const backoff = TRANSIENT_RETRY_BASE_DELAY_MS * 2 ** (retryCount - 1);
  const jitter = Math.floor(Math.random() * 120);
  await sleep(retryAfter ?? backoff + jitter);
  return api.request(config);
}

/**
 * Response interceptor
 * - 비동기 SSOT: 성공/실패 시 해당 요청 완료 처리
 * - 401: attempt refresh ONCE, then replay original request
 * - 403: do not refresh (membership/role), fail-fast
 * - 네트워크 에러(오프라인/DNS/timeout): isNetworkError로 분리해 토큰 보존 + throw
 *   (CORS-blocked 401은 클라이언트에서 신뢰성 있게 구별 불가 → 안전한 default는 세션 보존)
 */
api.interceptors.response.use(
  (res: AxiosResponse) => {
    const responseConfig = res.config as RetryConfig;
    const id = responseConfig._asyncId;
    if (responseConfig._authGeneration !== undefined) {
      const currentGeneration = readAuthTokenEnvelopeSafely()?.generation ?? null;
      if (responseConfig._authGeneration !== currentGeneration) {
        if (id) asyncStatusStore.completeTask(id, "error", "Authentication session changed.");
        throw new axios.CanceledError("Authentication session changed.");
      }
    }
    if (id) asyncStatusStore.completeTask(id, "success");
    return res;
  },
  async (err: unknown) => {
    const config = isApiError(err) ? err.config as RetryConfig | undefined : undefined;
    const asyncId = config?._asyncId;
    if (!isApiError(err)) throw err;

    const status = err.response?.status;
    const original = err.config as RetryConfig | undefined;

    if (!original) throw err;

    // Reject every stale response class before retry/status handling. A delayed
    // 403/404/network/timeout from account A must never reach account B's
    // AuthContext or query consumers.
    if (original._authGeneration !== undefined) {
      const currentGeneration = readAuthTokenEnvelopeSafely()?.generation ?? null;
      if (original._authGeneration !== currentGeneration) {
        if (asyncId) {
          asyncStatusStore.completeTask(asyncId, "error", "Authentication session changed.");
        }
        throw new axios.CanceledError("Authentication session changed.");
      }
    }

    if (shouldRetryTransientApiError(err, original)) {
      return retryTransientApiRequest(original, err);
    }

    // Sentry API 에러 추적: 최종 실패한 4xx/5xx 응답만 전송
    const errStatus = err.response?.status;
    if (errStatus && errStatus >= 400) {
      captureApiError(
        err.config?.method || "unknown",
        err.config?.url || "unknown",
        errStatus,
      );
    }

    const completeAsyncError = () => {
      if (asyncId)
        asyncStatusStore.completeTask(
          asyncId,
          "error",
          getApiErrorMessage(err)
        );
    };

    if (status === 402) {
      // Subscription expired — broadcast to UI
      try { window.dispatchEvent(new CustomEvent("subscription-expired", { detail: err.response?.data })); } catch { /* ignore */ }
      completeAsyncError();
      throw err;
    }

    if (status === 403) {
      completeAsyncError();
      throw err;
    }

    // 네트워크 장애(오프라인/DNS/연결끊김/타임아웃)는 인증 실패가 아니므로
    // 토큰 정리 없이 그대로 throw → 호출 측이 retry/UX 처리.
    if (isNetworkError(err)) {
      completeAsyncError();
      throw err;
    }

    // 대리보기는 관리자 localStorage 세션과 분리된 일회성 access-only 창이다.
    // 관리자 refresh envelope를 재사용하지 않고 전용 세션만 종료한다.
    if (status === 401 && isStudentSupportWindow() && !shouldSkipAuth(original.url, original)) {
      endExpiredSession();
      completeAsyncError();
      throw err;
    }

    // 401만 refresh 시도 (위에서 네트워크 에러는 이미 분리됨)
    if (status === 401 && !original._retry && !shouldSkipAuth(original.url, original)) {
      const currentGeneration = readAuthTokenEnvelopeSafely()?.generation ?? null;
      if (
        original._authGeneration !== undefined
        && original._authGeneration !== currentGeneration
      ) {
        completeAsyncError();
        throw err;
      }
      original._retry = true;

      let refreshed: AuthAccessResult | null;
      try {
        refreshed = await refreshAccessToken();
      } catch (error) {
        if (error instanceof AuthTokenStorageError) {
          notifyAuthTokenStorageError(error);
          completeAsyncError();
        }
        throw error;
      }

      if (!refreshed) {
        if (
          original._authGeneration === undefined
          || original._authGeneration === readAuthTokenEnvelopeSafely()?.generation
        ) {
          endExpiredSession(original._authGeneration);
        }
        completeAsyncError();
        throw err;
      }

      if (refreshed.sessionChanged || refreshed.generation !== original._authGeneration) {
        completeAsyncError();
        throw err;
      }

      setRequestHeader(original, "Authorization", `Bearer ${refreshed.access}`);
      return api.request(original);
    }

    // A refresh can succeed at the token endpoint while the replay is still
    // rejected (for example, stale authorization during a rolling deploy).
    // Never leave that unusable token in storage and trap the SPA in 401 loops.
    if (status === 401 && original._retry && !shouldSkipAuth(original.url, original)) {
      if (
        original._authGeneration === undefined
        || original._authGeneration === readAuthTokenEnvelopeSafely()?.generation
      ) {
        endExpiredSession(original._authGeneration);
      }
      completeAsyncError();
      throw err;
    }

    completeAsyncError();
    throw err;
  }
);

export default api;
