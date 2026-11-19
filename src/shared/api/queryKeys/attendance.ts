export const attendanceQueryKeys = {
  qrActiveLectures: ["attendance-qr", "active-lectures"] as const,
  qrLectureSessions: (lectureId?: number) => ["attendance-qr", "lecture-sessions", lectureId] as const,
  lectureEnrollmentsRoot: ["lecture-enrollments"] as const,
  enrolledIds: (sessionId: number | null | undefined) => ["attendance-enrolled-ids", sessionId] as const,
} as const;
