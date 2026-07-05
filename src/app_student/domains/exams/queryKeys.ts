// PATH: src/app_student/domains/exams/queryKeys.ts

export const studentExamQueryKeys = {
  root: ["student", "exams"] as const,
  list: (params?: { session_id?: number; include_upcoming?: boolean }) =>
    ["student", "exams", params ?? {}] as const,
  detail: (examId: number) => ["student", "exams", examId] as const,
  questions: (tenantCode: string, examId: number) =>
    ["student", "exams", "questions", tenantCode, examId] as const,
  result: (examId: number) => ["student", "exams", "result", examId] as const,
  resultItems: (examId: number) => ["student", "exams", "result", "items", examId] as const,
  gradesRoot: ["student", "grades"] as const,
  dashboard: ["student-dashboard"] as const,
};
