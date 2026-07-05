// PATH: src/app_teacher/domains/results/queryKeys.ts
export const teacherResultsQueryKeys = {
  activeLectures: ["lectures-mobile", true] as const,
  examsForLecture: (lectureId: number | null) => ["results-exams", lectureId] as const,
  detail: (examId: number | null) => ["results-detail", examId] as const,
  statsLectures: ["tc-stats-lectures"] as const,
  statsExams: (lectureId: number | null) => ["tc-stats-exams", lectureId] as const,
  examSummary: (examId: number | null) => ["tc-exam-summary", examId] as const,
  questionStats: (examId: number | null) => ["tc-question-stats", examId] as const,
  statsExamResults: (examId: number | null) => ["tc-exam-results", examId] as const,
  homeworkScores: (lectureId: number | null) => ["tc-hw-scores", lectureId] as const,
  pendingSubmissions: ["teacher-pending-submissions"] as const,
  pendingSubmissionsList: (filter: string) => ["teacher-pending-submissions", filter] as const,
  scoreEntryResults: (examId: number) => ["exam-results", examId] as const,
  teacherExamResults: (examId: number) => ["teacher-exam-results", examId] as const,
  sessionExamResults: (examId: number) => ["exam-results-session", examId] as const,
};
