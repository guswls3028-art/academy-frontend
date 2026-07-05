export const adminVideoQueryKeys = {
  landingStats: ["admin-videos-landing-stats"] as const,
  lectures: ["admin-videos-lectures"] as const,
  lectureSessionsAll: ["lecture-sessions-all"] as const,
  publicSession: ["public-session"] as const,
  folders: ["video-folders"] as const,
  foldersForSession: (sessionId?: number | null) => ["video-folders", sessionId] as const,
  sessionVideos: ["session-videos"] as const,
  sessionVideosScoped: (scopeId?: number | null) => ["session-videos", scopeId] as const,
  sessionVideosInFolder: (sessionId?: number | null, folderId?: number | null) =>
    ["session-videos", sessionId, folderId] as const,
  stats: ["video-stats"] as const,
  statsForVideo: (videoId: number) => ["video-stats", videoId] as const,
  permissionStats: (videoId: number) => ["video", videoId, "stats"] as const,
  achievement: (videoId: number) => ["video", videoId, "achievement"] as const,
  comments: (videoId: number) => ["admin-video-comments", videoId] as const,
  engagement: (videoId: number) => ["video-engagement", videoId] as const,
};
