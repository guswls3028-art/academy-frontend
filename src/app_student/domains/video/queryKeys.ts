export const studentVideoQueryKeys = {
  me: ["student-video-me"] as const,
  stats: ["student-video-stats"] as const,
  sessionVideos: (sessionId: number | null | undefined, enrollmentId?: number | null) =>
    ["student-session-videos", sessionId, enrollmentId ?? null] as const,
  playback: (videoId: number | null | undefined, enrollmentId?: number | null) =>
    ["student-video-playback", videoId, enrollmentId ?? null] as const,
  comments: (videoId: number) => ["video-comments", videoId] as const,
};
