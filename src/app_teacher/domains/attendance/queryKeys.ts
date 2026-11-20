// PATH: src/app_teacher/domains/attendance/queryKeys.ts
export const teacherAttendanceQueryKeys = {
  all: ["attendance"] as const,
  allSessionAttendance: ["session-attendance"] as const,
  matrices: ["attendance-matrix"] as const,
  sessionEnrollments: ["session-enrollments"] as const,
  enrolledIds: ["attendance-enrolled-ids"] as const,
  attendance: (sessionId: number) => ["attendance", sessionId] as const,
  completeAttendance: (sessionId: number) => ["attendance", sessionId, "complete"] as const,
  completeAttendanceScope: (sessionId: number, schedule: string | undefined) =>
    ["attendance", sessionId, "complete", schedule ?? 'all'] as const,
  sessionAttendance: (sessionId: number) => ["session-attendance", sessionId] as const,
};
