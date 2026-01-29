// PATH: src/features/homework/queryKeys.ts

export const QUERY_KEYS = {
  // ===== Scores (Session 성적 탭 단일 진실) =====
  SESSION_SCORES: (sessionId: number) => ["session-scores", sessionId] as const,

  // ===== Homework (단일 진실들) =====
  ADMIN_HOMEWORK: (homeworkId: number) =>
    ["admin-homework", homeworkId] as const,

  HOMEWORK_POLICY: (sessionId: number) =>
    ["homework-policy", sessionId] as const,

  HOMEWORK_ASSIGNMENTS: (homeworkId: number) =>
    ["homework-assignments", homeworkId] as const,

  HOMEWORK_SESSION_ENROLLMENTS: (sessionId: number) =>
    ["homework-session-enrollments", sessionId] as const,

  HOMEWORKS_LIST: (sessionId: number) => ["homeworks", sessionId] as const,
};
