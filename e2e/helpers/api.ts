/**
 * E2E API Helper — 브라우저 컨텍스트에서 인증된 API 호출
 *
 * - JWT + X-Tenant-Code 자동 전달
 * - 401 응답 시 localStorage.refresh 로 자동 갱신 후 1회 재시도
 *   (긴 polling 테스트 — matchup OCR 5분, clinic trigger 폴링 등 — 에서 access 만료 silent 401 방지)
 */
import { type Page } from "@playwright/test";

const API_BASE = process.env.E2E_API_URL || "https://api.hakwonplus.com";

type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type ApiCallArgs = {
  access: string;
  host: string;
  refresh: string;
  tenantCode: string;
};

export type ApiCallResult<TBody = unknown> = { status: number; body: TBody };

export async function apiCall<TBody = unknown>(
  page: Page,
  method: ApiMethod,
  path: string,
  data?: Record<string, unknown>,
): Promise<ApiCallResult<TBody>> {
  const auth = await page.evaluate(
    (): ApiCallArgs => ({
      access: localStorage.getItem("access") || "",
      refresh: localStorage.getItem("refresh") || "",
      host: window.location.hostname.toLowerCase(),
      tenantCode: sessionStorage.getItem("tenantCode") || "",
    }),
  );
  const tenantCode = auth.tenantCode || getTenantCodeFromHost(auth.host);
  const url = path.startsWith("http") ? path : `${API_BASE}/api/v1${path}`;

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
        access = tokens.access;
        await page.evaluate(({ nextAccess, nextRefresh }) => {
          localStorage.setItem("access", nextAccess);
          if (nextRefresh) localStorage.setItem("refresh", nextRefresh);
        }, { nextAccess: tokens.access, nextRefresh: tokens.refresh });
        res = await page.request.fetch(url, requestOptions(access));
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
