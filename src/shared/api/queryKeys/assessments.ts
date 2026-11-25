const studentHomeworkFiles = (studentId: number) => ["staff-student-homework-files", studentId] as const;

export const assessmentQueryKeys = {
  homeworkMediaPreview: (homeworkId: number, fileId: string | undefined, mediaSetFingerprint: string | null) =>
    ["homework-media-preview", homeworkId, fileId, mediaSetFingerprint] as const,

  adminHomeworkSubmissions: (homeworkId: number) => ["homework-submissions", homeworkId] as const,
  teacherHomeworkSubmissions: (homeworkId: number) => ["teacher-homework-submissions", homeworkId] as const,
  studentHomeworkFiles,
  studentHomeworkFilesPage: (studentId: number, page: number) => [...studentHomeworkFiles(studentId), page] as const,
  staffHomeworks: ["teacher-homeworks"] as const,
  allLectureSessions: ["lecture-sessions-all"] as const,
  allLectures: ["admin-exams-lectures"] as const,
  sessionHomeworks: (sessionId: number) => ["session-homeworks", sessionId] as const,
};
