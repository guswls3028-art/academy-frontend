// PATH: src/app_admin/domains/results/queryKeys.ts

export const adminResultsQueryKeys = {
  landingStats: ["admin-results-landing-stats"] as const,
  studentPerformance: (period: number | "all", lectureId: number | null, filters: object) =>
    ["admin-results-student-performance", period, lectureId, filters] as const,
  lectures: ["admin-results-lectures"] as const,
  lectureSessionsAll: ["lecture-sessions-all"] as const,

  adminExamResults: (examId: number | null | undefined) => ["admin-exam-results", examId] as const,
  adminExamDetail: (examId: number | null | undefined, enrollmentId?: number | null) =>
    enrollmentId == null ? ["admin-exam-detail", examId] as const : ["admin-exam-detail", examId, enrollmentId] as const,
  adminExamSummary: (examId: number | null | undefined) => ["admin-exam-summary", examId] as const,
  examQuestionStats: (examId: number | null | undefined) => ["exam-question-stats", examId] as const,
  examQuestions: (examId: number | null | undefined) => ["exam-questions", examId] as const,
  myExamResult: (examId: number) => ["my-exam-result", examId] as const,

  examAttempts: (examId: number, enrollmentId: number) => ["exam-attempts", examId, enrollmentId] as const,
  attemptHistoryExam: (examId: number, enrollmentId: number) => ["attempt-history", "exam", examId, enrollmentId] as const,
  wrongNotes: (enrollmentId: number, examId: number | undefined) => ["wrong-notes", enrollmentId, examId] as const,

  omrReviewList: (examId: number) => ["omr-review-list", examId] as const,
  omrReviewDetail: (submissionId: number | null | undefined) => ["omr-review-detail", submissionId] as const,
  omrCandidates: (queryKeyId: string, query: string) => ["omr-candidates", queryKeyId, query] as const,

  sessionScores: ["session-scores"] as const,
  clinicTargets: ["clinic-targets"] as const,
};
