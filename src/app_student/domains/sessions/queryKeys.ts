// PATH: src/app_student/domains/sessions/queryKeys.ts

const root = ["student-sessions"] as const;

export const studentSessionQueryKeys = {
  root,
  home: [...root, "home"] as const,
  detail: (sessionId: number) => ["student-session", sessionId] as const,
};
