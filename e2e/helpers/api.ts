/**
 * E2E API Helper — 브라우저 컨텍스트에서 인증된 API 호출
 *
 * - JWT + X-Tenant-Code 자동 전달
 * - 401 응답 시 localStorage.refresh 로 자동 갱신 후 1회 재시도
 *   (긴 polling 테스트 — matchup OCR 5분, clinic trigger 폴링 등 — 에서 access 만료 silent 401 방지)
 */
import { type Page } from "@playwright/test";

const API_BASE = process.env.E2E_API_URL || "https://api.hakwonplus.com";

export async function apiCall(
  page: Page,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  data?: Record<string, unknown>,
): Promise<{ status: number; body: any }> {
  return page.evaluate(
    async ({ method, path, data, apiBase }) => {
      // 현재 페이지 hostname → tenant code (프론트엔드와 동일 매핑)
      const host = window.location.hostname.toLowerCase();
      const tenantMap: Record<string, string> = {
        "tchul.com": "tchul", "www.tchul.com": "tchul",
        "hakwonplus.com": "hakwonplus", "www.hakwonplus.com": "hakwonplus",
        "limglish.kr": "limglish", "www.limglish.kr": "limglish",
        "ymath.co.kr": "ymath", "www.ymath.co.kr": "ymath",
        "sswe.co.kr": "sswe", "www.sswe.co.kr": "sswe",
        "dnbacademy.co.kr": "dnb", "www.dnbacademy.co.kr": "dnb",
        "localhost": "hakwonplus",
      };
      const tenantCode = tenantMap[host] || "hakwonplus";

      const url = path.startsWith("http") ? path : `${apiBase}/api/v1${path}`;

      const buildHeaders = (): Record<string, string> => {
        const token = localStorage.getItem("access") || "";
        return {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Tenant-Code": tenantCode,
        };
      };

      const buildOpts = (): RequestInit => {
        const opts: RequestInit = { method, headers: buildHeaders() };
        if (data && method !== "GET") opts.body = JSON.stringify(data);
        return opts;
      };

      // ── 1차 호출 ──
      let res = await fetch(url, buildOpts());

      // ── 401 → refresh 1회 시도 ──
      if (res.status === 401) {
        const refresh = localStorage.getItem("refresh") || "";
        if (refresh) {
          const refreshRes = await fetch(`${apiBase}/api/v1/token/refresh/`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Tenant-Code": tenantCode },
            body: JSON.stringify({ refresh }),
          });
          if (refreshRes.ok) {
            const tokens = (await refreshRes.json()) as { access: string; refresh?: string };
            if (tokens.access) {
              localStorage.setItem("access", tokens.access);
              if (tokens.refresh) localStorage.setItem("refresh", tokens.refresh);
              // 갱신된 토큰으로 원래 요청 재시도
              res = await fetch(url, buildOpts());
            }
          }
        }
      }

      let body: any;
      try { body = await res.json(); } catch { body = null; }
      return { status: res.status, body };
    },
    { method, path, data, apiBase: API_BASE },
  );
}
