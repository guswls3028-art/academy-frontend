/**
 * E2E API Helper — 브라우저 컨텍스트에서 인증된 API 호출
 * JWT + X-Tenant-Code 자동 전달
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
      const token = localStorage.getItem("access") || "";
      // 현재 페이지 hostname에서 tenant code 추출 (프론트엔드와 동일 로직)
      const host = window.location.hostname.toLowerCase();
      const tenantMap: Record<string, string> = {
        "tchul.com": "tchul", "www.tchul.com": "tchul",
        "hakwonplus.com": "hakwonplus", "www.hakwonplus.com": "hakwonplus",
        "limglish.kr": "limglish", "www.limglish.kr": "limglish",
        "ymath.co.kr": "ymath", "www.ymath.co.kr": "ymath",
        "sswe.co.kr": "sswe", "www.sswe.co.kr": "sswe",
        "localhost": "hakwonplus",
      };
      const tenantCode = tenantMap[host] || "hakwonplus";

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Tenant-Code": tenantCode,
      };
      const opts: RequestInit = { method, headers };
      if (data && method !== "GET") {
        opts.body = JSON.stringify(data);
      }
      const url = path.startsWith("http") ? path : `${apiBase}/api/v1${path}`;
      const res = await fetch(url, opts);
      let body: any;
      try { body = await res.json(); } catch { body = null; }
      return { status: res.status, body };
    },
    { method, path, data, apiBase: API_BASE },
  );
}
