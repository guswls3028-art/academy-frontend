// PATH: src/app_student/shared/api/queryKeys.ts

export const studentQueryKeys = {
  me: ["student", "me"] as const,
  notificationCounts: ["student", "notifications", "counts"] as const,
  clinicBookings: ["student", "clinic", "bookings"] as const,
  qnaQuestions: ["student", "qna", "questions"] as const,
  counselRequests: ["student", "counsel", "requests"] as const,
  gradesSummary: ["student", "grades", "summary"] as const,
  gradesRoot: ["student", "grades"] as const,
  dashboard: ["student-dashboard"] as const,
  examsRoot: ["student", "exams"] as const,
  examsList: (params?: { session_id?: number; include_upcoming?: boolean }) =>
    ["student", "exams", params ?? {}] as const,
};
