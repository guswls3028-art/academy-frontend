// PATH: src/app_admin/domains/community/queryKeys.ts

export const adminCommunityQueryKeys = {
  scopeNodes: ["community-scope-nodes"] as const,
  lecturesList: ["lectures-list"] as const,
  lectureSessions: (lectureId: number | null | undefined) => ["lecture-sessions", lectureId] as const,

  boardPosts: ["community-board-posts-all"] as const,
  boardPostsList: (query: string) => ["community-board-posts-all", query] as const,
  noticePosts: ["community-notice-posts"] as const,
  noticePostsList: (query: string) => ["community-notice-posts", query] as const,
  materialsPosts: ["community-materials-posts-all"] as const,
  materialsPostsList: (query: string) => ["community-materials-posts-all", query] as const,
  counselPosts: ["community-counsel-posts"] as const,
  questions: ["community-questions"] as const,
  questionsAll: ["community-questions", "all"] as const,

  post: (postId: number | null | undefined) => ["community-post", postId] as const,
  postReplies: (postId: number | null | undefined) => ["post-replies", postId] as const,
  counts: (postType: string) => ["community", postType, "counts"] as const,
  adminNotificationCounts: ["admin", "notification-counts"] as const,
};
