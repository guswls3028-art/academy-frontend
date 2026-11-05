const SESSION_SCORES_ROOT = ["session-scores"] as const;

export const scoresQueryKeys = {
  sessionScoresRoot: SESSION_SCORES_ROOT,
  sessionScores: (sessionId: number) => [...SESSION_SCORES_ROOT, sessionId] as const,
  sessionScoresScope: (sessionId: number, schedule: string | undefined) => schedule === undefined
    ? [...SESSION_SCORES_ROOT, sessionId] as const
    : [...SESSION_SCORES_ROOT, sessionId, 'schedule', schedule] as const,
  examItems: (examId: number, enrollmentId: number) =>
    ["exam-items", examId, enrollmentId] as const,
  attendance: (sessionId: number) => ["attendance", sessionId] as const,
  attendanceScope: (sessionId: number, pageSize: number | undefined, schedule: string | undefined) =>
    ["attendance", sessionId, pageSize ?? "default", 'schedule', schedule ?? 'all'] as const,
  sessionScoreSummary: (sessionId: number) =>
    ["session-score-summary", sessionId] as const,
  submission: (submissionId: number) => ["submission", submissionId] as const,
} as const;
