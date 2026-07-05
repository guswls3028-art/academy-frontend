// PATH: src/app_admin/domains/sessions/queryKeys.ts

export const adminSessionQueryKeys = {
  session: ["session"] as const,
  sessionDetail: (sessionId: number | null | undefined) => ["session", sessionId] as const,
  lecture: (lectureId: number | null | undefined) => ["lecture", lectureId] as const,
  adminExam: (examId: number) => ["admin-exam", examId] as const,

  lectureSessions: (lectureId: number | null | undefined) => ["lecture-sessions", lectureId] as const,
  lectureSections: (lectureId: number | null | undefined) => ["lecture-sections", lectureId] as const,
  sectionAssignments: (lectureId: number | null | undefined) => ["section-assignments", lectureId] as const,
  sessionEnrollments: (sessionId: number | null | undefined) => ["session-enrollments", sessionId] as const,
  attendance: (sessionId: number | null | undefined) => ["attendance", sessionId] as const,
  attendanceMatrix: (lectureId: number | null | undefined) => ["attendance-matrix", lectureId] as const,
};
