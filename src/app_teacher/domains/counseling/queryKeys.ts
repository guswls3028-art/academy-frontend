// PATH: src/app_teacher/domains/counseling/queryKeys.ts
export const teacherCounselingQueryKeys = {
  posts: ["teacher-counseling"] as const,
  replies: (postId: number) => ["teacher-counseling-replies", postId] as const,
};
