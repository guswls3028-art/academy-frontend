// PATH: src/features/scores/api/queryKeys.ts
/**
 * 성적(scores) 도메인 React Query 키 SSOT
 * - 캐시 무효화·프리페치 시 동일 키 사용으로 정합성 유지
 */

export const scoresQueryKeys = {
  /** GET /results/admin/sessions/:sessionId/scores/ */
  sessionScores: (sessionId: number) => ["session-scores", sessionId] as const,

  /** GET /results/admin/exams/:examId/enrollments/:enrollmentId/ (문항별 점수) */
  examItems: (examId: number, enrollmentId: number) =>
    ["exam-items", examId, enrollmentId] as const,

  /** GET 출결 (lectures 도메인) */
  attendance: (sessionId: number) => ["attendance", sessionId] as const,

  /** GET 세션 성적 요약 */
  sessionScoreSummary: (sessionId: number) =>
    ["session-score-summary", sessionId] as const,

  /** 제출 상태 폴링 */
  submission: (submissionId: number) => ["submission", submissionId] as const,
} as const;
