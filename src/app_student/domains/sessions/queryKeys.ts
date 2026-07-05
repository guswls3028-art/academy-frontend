// PATH: src/app_student/domains/sessions/queryKeys.ts

export const studentSessionQueryKeys = {
  root: ["student-sessions"] as const,
  detail: (sessionId: number) => ["student-session", sessionId] as const,
};
