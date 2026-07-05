// PATH: src/app_student/domains/community/queryKeys.ts

export const studentCommunityQueryKeys = {
  myActivity: (limit: number) => ["student", "community", "my-activity", limit] as const,
  me: ["student", "me"] as const,
  videoMe: ["student", "video", "me"] as const,
  notificationCounts: ["student", "notifications", "counts"] as const,

  noticePosts: ["student", "notice", "posts"] as const,
  noticePost: (postId: number) => ["student", "notice", "post", postId] as const,
  boardPosts: ["student", "board", "posts"] as const,
  boardPost: (postId: number) => ["student", "board", "post", postId] as const,
  materialsPosts: ["student", "materials", "posts"] as const,
  materialsPost: (postId: number) => ["student", "materials", "post", postId] as const,

  qnaQuestions: ["student", "qna", "questions"] as const,
  qnaQuestion: (questionId: number) => ["student", "qna", "question", questionId] as const,
  qnaReplies: (questionId: number) => ["student", "qna", "replies", questionId] as const,

  counselRequests: ["student", "counsel", "requests"] as const,
  counselRequest: (requestId: number) => ["student", "counsel", "request", requestId] as const,
  counselReplies: (requestId: number) => ["student", "counsel", "replies", requestId] as const,
};
