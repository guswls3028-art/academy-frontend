export type VideoPlaybackResponseKind = "bootstrap" | "access" | "invalid" | "other";

export function classifyVideoPlaybackResponse(
  rawUrl: string,
  method: string,
  videoId: number,
): VideoPlaybackResponseKind {
  const url = new URL(rawUrl);
  if (url.pathname !== `/api/v1/student/video/videos/${videoId}/playback/`) return "other";

  const entries = [...url.searchParams.entries()];
  const enrollment = url.searchParams.get("enrollment");
  const hasPositiveEnrollment = enrollment !== null && /^[1-9][0-9]*$/.test(enrollment);
  const validBootstrapQuery = entries.length === 0
    || (hasPositiveEnrollment && entries.length === 1 && entries[0]?.[0] === "enrollment");
  if (method === "POST" && validBootstrapQuery) return "bootstrap";

  const validAccessQuery = url.searchParams.get("access_check") === "1"
    && (enrollment === null || hasPositiveEnrollment)
    && entries.length === (enrollment === null ? 1 : 2)
    && new Set(entries.map(([key]) => key)).size === entries.length;
  if (method === "GET" && validAccessQuery) return "access";

  return "invalid";
}
