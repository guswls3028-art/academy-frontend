// PATH: src/app_teacher/domains/exams/queryKeys.ts
export const teacherExamsQueryKeys = {
  exams: ["teacher-exams"] as const,
  homeworks: ["teacher-homeworks"] as const,
  exam: (examId: number) => ["teacher-exam", examId] as const,
  examResults: (examId: number) => ["teacher-exam-results", examId] as const,
  examEnrollmentRows: (examId: number, sessionIds: readonly number[]) =>
    ["teacher-exam-enrollment-rows", examId, sessionIds] as const,
  homework: (homeworkId: number) => ["teacher-homework", homeworkId] as const,
  homeworkSubmissions: (homeworkId: number) => ["teacher-homework-submissions", homeworkId] as const,
  bundles: ["teacher-exam-bundles"] as const,
  bundle: (bundleId?: number) => ["teacher-exam-bundle", bundleId] as const,
  examTemplatesUsage: ["teacher-exam-templates-usage"] as const,
  homeworkTemplatesUsage: ["teacher-homework-templates-usage"] as const,
  omrDefaults: (examId: number) => ["teacher-omr-defaults", examId] as const,
  omrEnrollments: (examId: number, sessionIds: readonly number[]) =>
    ["teacher-omr-exam-enrollments", examId, sessionIds] as const,
  omrEnrollmentsForExam: (examId: number) => ["teacher-omr-exam-enrollments", examId] as const,
};
