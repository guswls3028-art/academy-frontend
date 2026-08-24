/**
 * E2E API Helper — 브라우저 컨텍스트에서 인증된 API 호출
 *
 * - JWT + X-Tenant-Code 자동 전달
 * - generation envelope 우선, legacy raw token은 기존 fixture fallback
 * - 401 응답 시 active session을 확인해 refresh 후 1회 재시도
 *   (긴 polling 테스트 — matchup OCR 5분, clinic trigger 폴링 등 — 에서 access 만료 silent 401 방지)
 */
import { type Page } from "@playwright/test";
import { assertAccountNotificationRequestSafe } from "./accountNotificationSafety";

const API_BASE = process.env.E2E_API_URL || "https://api.hakwonplus.com";

type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type AuthStorageMode = "envelope" | "legacy" | "none";
type ApiCallArgs = {
  access: string;
  generation: string;
  host: string;
  refresh: string;
  storageMode: AuthStorageMode;
  tenantCode: string;
};

const ACTIVE_GENERATION_KEY = "academy:auth-active-generation:v1";
const GENERATION_PREFIX = "academy:auth-tokens:v1:";

export type ApiCallResult<TBody = unknown> = { status: number; body: TBody };

export async function apiCall<TBody = unknown>(
  page: Page,
  method: ApiMethod,
  path: string,
  data?: Record<string, unknown>,
): Promise<ApiCallResult<TBody>> {
  const auth = await page.evaluate(
    ({ activeGenerationKey, generationPrefix }): ApiCallArgs => {
      const generation = String(localStorage.getItem(activeGenerationKey) || "").trim();
      if (generation) {
        try {
          const parsed = JSON.parse(
            localStorage.getItem(`${generationPrefix}${generation}`) || "null",
          ) as Partial<{ access: string; refresh: string; generation: string }> | null;
          if (
            parsed?.generation === generation
            && String(parsed.access || "").trim()
            && String(parsed.refresh || "").trim()
          ) {
            return {
              access: String(parsed.access).trim(),
              generation,
              host: window.location.hostname.toLowerCase(),
              refresh: String(parsed.refresh).trim(),
              storageMode: "envelope",
              tenantCode: sessionStorage.getItem("tenantCode") || "",
            };
          }
        } catch {
          // An active pointer never falls back to potentially stale legacy keys.
        }
        return {
          access: "",
          generation,
          host: window.location.hostname.toLowerCase(),
          refresh: "",
          storageMode: "none",
          tenantCode: sessionStorage.getItem("tenantCode") || "",
        };
      }
      return {
        access: localStorage.getItem("access") || "",
        generation: "",
        host: window.location.hostname.toLowerCase(),
        refresh: localStorage.getItem("refresh") || "",
        storageMode: "legacy",
        tenantCode: sessionStorage.getItem("tenantCode") || "",
      };
    },
    { activeGenerationKey: ACTIVE_GENERATION_KEY, generationPrefix: GENERATION_PREFIX },
  );
  const tenantCode = auth.tenantCode || getTenantCodeFromHost(auth.host);
  const url = path.startsWith("http") ? path : `${API_BASE}/api/v1${path}`;
  assertAccountNotificationRequestSafe(url, method, data);

  const buildHeaders = (access: string): Record<string, string> => ({
    Authorization: `Bearer ${access}`,
    "Content-Type": "application/json",
    "X-Tenant-Code": tenantCode,
  });

  const requestOptions = (access: string) => ({
    method,
    headers: buildHeaders(access),
    ...(data && method !== "GET" ? { data } : {}),
  });

  let access = auth.access;
  let res = await page.request.fetch(url, requestOptions(access));

  if (res.status() === 401 && auth.refresh) {
    const refreshRes = await page.request.post(`${API_BASE}/api/v1/token/refresh/`, {
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-Code": tenantCode,
      },
      data: { refresh: auth.refresh },
    });
    if (refreshRes.ok()) {
      const tokens = (await refreshRes.json()) as { access?: string; refresh?: string };
      if (tokens.access) {
        const published = await page.evaluate(({
          activeGenerationKey,
          expectedGeneration,
          expectedRefresh,
          generationPrefix,
          nextAccess,
          nextRefresh,
          storageMode,
        }) => {
          if (storageMode === "envelope") {
            if (localStorage.getItem(activeGenerationKey) !== expectedGeneration) return false;
            const envelopeKey = `${generationPrefix}${expectedGeneration}`;
            let current: Partial<{ access: string; refresh: string; generation: string }> | null;
            try {
              current = JSON.parse(localStorage.getItem(envelopeKey) || "null");
            } catch {
              return false;
            }
            if (
              current?.generation !== expectedGeneration
              || current.refresh !== expectedRefresh
            ) return false;
            localStorage.setItem(envelopeKey, JSON.stringify({
              access: nextAccess,
              refresh: nextRefresh || expectedRefresh,
              generation: expectedGeneration,
            }));
            return localStorage.getItem(activeGenerationKey) === expectedGeneration;
          }
          if (storageMode !== "legacy") return false;
          if (localStorage.getItem(activeGenerationKey)) return false;
          if (localStorage.getItem("refresh") !== expectedRefresh) return false;
          localStorage.setItem("access", nextAccess);
          localStorage.setItem("refresh", nextRefresh || expectedRefresh);
          return !localStorage.getItem(activeGenerationKey);
        }, {
          activeGenerationKey: ACTIVE_GENERATION_KEY,
          expectedGeneration: auth.generation,
          expectedRefresh: auth.refresh,
          generationPrefix: GENERATION_PREFIX,
          nextAccess: tokens.access,
          nextRefresh: tokens.refresh,
          storageMode: auth.storageMode,
        });
        if (published) {
          access = tokens.access;
          res = await page.request.fetch(url, requestOptions(access));
        }
      }
    }
  }

  let body: unknown = null;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status(), body } as ApiCallResult<TBody>;
}

function getTenantCodeFromHost(host: string): string {
  const tenantMap: Record<string, string> = {
    "tchul.com": "tchul", "www.tchul.com": "tchul",
    "hakwonplus.com": "hakwonplus", "www.hakwonplus.com": "hakwonplus",
    "limglish.kr": "limglish", "www.limglish.kr": "limglish",
    "ymath.co.kr": "ymath", "www.ymath.co.kr": "ymath",
    "sswe.co.kr": "sswe", "www.sswe.co.kr": "sswe",
    "dnbacademy.co.kr": "dnb", "www.dnbacademy.co.kr": "dnb",
    "localhost": "hakwonplus",
    "127.0.0.1": "hakwonplus",
  };
  return tenantMap[host] || "hakwonplus";
}
