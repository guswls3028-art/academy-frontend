export const attendanceQueryKeys = {
  lectureEnrollmentsRoot: ["lecture-enrollments"] as const,
  enrolledIds: (sessionId: number | null | undefined) => ["attendance-enrolled-ids", sessionId] as const,
} as const;
