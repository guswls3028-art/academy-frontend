// src/features/media/playback/utils/resolvePlayUrl.ts

function stripTrailingSlash(s: string) {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

export function resolvePlayUrl(playUrl: string): string {
  if (!playUrl) return playUrl;

  // 이미 절대 URL
  if (playUrl.startsWith("http://") || playUrl.startsWith("https://")) {
    return playUrl;
  }

  const cdn = (import.meta as any).env?.VITE_CDN_URL as string | undefined;
  const api = (import.meta as any).env?.VITE_API_URL as string | undefined;

  const base = cdn || api || "";
  if (!base) {
    // base 없으면 상대경로 그대로 (dev에서 proxy 쓰는 경우)
    return playUrl;
  }

  return `${stripTrailingSlash(base)}${playUrl.startsWith("/") ? "" : "/"}${playUrl}`;
}
