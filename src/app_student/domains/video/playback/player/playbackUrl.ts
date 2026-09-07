export function resolveStudentVideoPlayUrl(playUrl: string): string | null {
  let url = playUrl || "";
  if (!url) return null;
  try {
    new URL(url);
    return url;
  } catch {
    const apiBase = String(
      import.meta.env.VITE_API_BASE_URL || "https://api.hakwonplus.com",
    ).trim();
    const base = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
    const path = url.startsWith("/") ? url : `/${url}`;
    url = `${base}${path}`;
  }
  try {
    new URL(url);
    return url;
  } catch {
    return null;
  }
}
