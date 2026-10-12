// PATH: src/app_teacher/domains/attendance/queryKeys.ts
export const teacherAttendanceQueryKeys = {
  attendance: (sessionId: number) => ["attendance", sessionId] as const,
  completeAttendance: (sessionId: number) => ["attendance", sessionId, "complete"] as const,
  sessionAttendance: (sessionId: number) => ["session-attendance", sessionId] as const,
};
