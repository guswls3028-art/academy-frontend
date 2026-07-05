// PATH: src/app_admin/domains/lectures/queryKeys.ts

export const adminLectureQueryKeys = {
  lectures: ["lectures"] as const,
  lecture: (lectureId: number | null | undefined) => ["lecture", lectureId] as const,
  lectureInstructorOptions: ["lecture-instructor-options"] as const,
  staffMe: ["staff-me"] as const,

  lectureSessions: ["lecture-sessions"] as const,
  lectureSessionsForLecture: (lectureId: number | null | undefined) => ["lecture-sessions", lectureId] as const,
  sessionsForLecture: (lectureId: number | null | undefined) => ["sessions", lectureId] as const,
  sessionDetail: (sessionId: number | null | undefined) => ["session-detail", sessionId] as const,

  attendance: (sessionId: number, page: number, search: string, status: string) =>
    ["attendance", sessionId, page, search, status] as const,
  attendanceForSession: (sessionId: number | null | undefined) => ["attendance", sessionId] as const,
  attendanceForPdf: (sessionId: number | null | undefined) => ["attendance-for-pdf", sessionId] as const,
  attendanceMatrix: (lectureId: number | null | undefined) => ["attendance-matrix", lectureId] as const,
  attendanceEnrolledIds: (sessionId: number | null | undefined) => ["attendance-enrolled-ids", sessionId] as const,

  lectureSections: (lectureId: number | null | undefined) => ["lecture-sections", lectureId] as const,
  sectionAssignments: (lectureId: number | null | undefined) => ["section-assignments", lectureId] as const,
  lectureEnrollments: (lectureId: number | null | undefined) => ["lecture-enrollments", lectureId] as const,
  sessionEnrollments: (sessionId: number | null | undefined) => ["session-enrollments", sessionId] as const,

  sessionVideos: (sessionId: number | null | undefined) => ["session-videos", sessionId] as const,
  sessionEnrollModalStudents: ["session-enroll-modal-students"] as const,
  sessionEnrollModalStudentsList: (
    search: string,
    filters: object,
    sort: string,
    page: number,
  ) => ["session-enroll-modal-students", search, filters, sort, page] as const,
};
