export const teacherVideoQueryKeys = {
  list: ["teacher-videos"] as const,
  detail: (videoId: number) => ["teacher-video", videoId] as const,
  stats: (videoId: number) => ["teacher-video-stats", videoId] as const,
  comments: (videoId: number) => ["teacher-video-comments", videoId] as const,
};
