// PATH: src/app_admin/domains/homework/queryKeys.ts

import { assessmentQueryKeys } from "@/shared/api/queryKeys/assessments";
import { scoresQueryKeys } from "@/shared/api/queryKeys/scores";

export const QUERY_KEYS = {
  // ===== Scores (Session 성적 탭 단일 진실) =====
  SESSION_SCORES: scoresQueryKeys.sessionScores,

  // ===== Homework (단일 진실들) =====
  ADMIN_HOMEWORK: (homeworkId: number) =>
    ["admin-homework", homeworkId] as const,

  HOMEWORK_SUBMISSIONS: (homeworkId: number) =>
    ["homework-submissions", homeworkId] as const,

  HOMEWORK_POLICY: assessmentQueryKeys.homeworkPolicy,

  HOMEWORK_ASSIGNMENTS: (homeworkId: number) =>
    ["homework-assignments", homeworkId] as const,

  HOMEWORK_SESSION_ENROLLMENTS: (sessionId: number) =>
    ["homework-session-enrollments", sessionId] as const,

  HOMEWORKS_LIST: (sessionId: number) => ["homeworks", sessionId] as const,
};
