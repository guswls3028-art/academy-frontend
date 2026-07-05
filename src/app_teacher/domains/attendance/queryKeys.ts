// PATH: src/app_teacher/domains/attendance/queryKeys.ts
export const teacherAttendanceQueryKeys = {
  attendance: (sessionId: number) => ["attendance", sessionId] as const,
  sessionAttendance: (sessionId: number) => ["session-attendance", sessionId] as const,
};
