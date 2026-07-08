const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function extractYouTubeVideoId(value: string | null | undefined): string | null {
  const text = (value || "").trim();
  if (!text) return null;
  if (YOUTUBE_ID_RE.test(text)) return text;

  const raw = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(text) ? text : `https://${text}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);
  const clean = (candidate: string | null | undefined) =>
    candidate && YOUTUBE_ID_RE.test(candidate.trim()) ? candidate.trim() : null;

  if (host === "youtu.be") {
    return clean(parts[0]);
  }

  if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    const queryId = clean(url.searchParams.get("v"));
    if (queryId) return queryId;
    if (parts.length >= 2 && ["embed", "shorts", "live", "v"].includes(parts[0])) {
      return clean(parts[1]);
    }
  }

  return null;
}

export function isYouTubeSource(sourceType: string | null | undefined): boolean {
  return (sourceType || "").trim().toLowerCase() === "youtube";
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
