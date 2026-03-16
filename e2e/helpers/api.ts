/**
 * E2E API Helper — 브라우저 컨텍스트에서 인증된 API 호출
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
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
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
