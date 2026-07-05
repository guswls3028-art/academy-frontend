// PATH: src/app_admin/domains/scores/api/queryKeys.ts

import { scoresQueryKeys as sharedScoresQueryKeys } from "@/shared/api/queryKeys/scores";

export const scoresQueryKeys = {
  ...sharedScoresQueryKeys,
  attendanceMatrix: (lectureId: number | null | undefined) => ["attendance-matrix", lectureId] as const,
  sessionEnrollments: (sessionId: number | null | undefined) => ["session-enrollments", sessionId] as const,
  adminExam: (examId: number) => ["admin-exam", examId] as const,
  adminExamDetail: (examId: number, enrollmentId: number) =>
    ["admin-exam-detail", examId, enrollmentId] as const,
  attemptHistory: (
    sourceType: "exam" | "homework",
    sourceId: number,
    enrollmentId: number,
  ) => ["attempt-history", sourceType, sourceId, enrollmentId] as const,
  clinicTargets: ["clinic-targets"] as const,
  adminExamResults: ["admin-exam-results"] as const,
};
