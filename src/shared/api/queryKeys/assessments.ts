export const assessmentQueryKeys = {
  homeworkPolicy: (sessionId: number) => ["homework-policy", sessionId] as const,
  sessionHomeworks: (sessionId: number) => ["session-homeworks", sessionId] as const,
};
