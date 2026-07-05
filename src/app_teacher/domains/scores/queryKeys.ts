// PATH: src/app_teacher/domains/scores/queryKeys.ts
export const teacherScoresQueryKeys = {
  sessionExams: (sessionId: number) => ["session-exams", sessionId] as const,
  sessionEnrollments: (sessionId: number) => ["session-enrollments-for-scores", sessionId] as const,
  examResults: (examId: number) => ["exam-results", examId] as const,
};
