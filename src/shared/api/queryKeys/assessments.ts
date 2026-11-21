export const assessmentQueryKeys = {
  staffHomeworks: ["teacher-homeworks"] as const,
  allLectureSessions: ["lecture-sessions-all"] as const,
  allLectures: ["admin-exams-lectures"] as const,
  sessionHomeworks: (sessionId: number) => ["session-homeworks", sessionId] as const,
};
