export function resolvePublicReportUrl(rawUrl: string): string {
  if (!rawUrl) return "";
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  const apiBase = ((import.meta.env.VITE_API_BASE_URL as string) || "").replace(/\/api\/v1\/?$/, "");
  return `${apiBase}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
}
