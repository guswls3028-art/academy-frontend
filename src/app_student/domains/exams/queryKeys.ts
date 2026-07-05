// PATH: src/app_student/domains/exams/queryKeys.ts

import { studentQueryKeys } from "@student/shared/api/queryKeys";

export const studentExamQueryKeys = {
  root: studentQueryKeys.examsRoot,
  list: studentQueryKeys.examsList,
  detail: (examId: number) => ["student", "exams", examId] as const,
  questions: (tenantCode: string, examId: number) =>
    ["student", "exams", "questions", tenantCode, examId] as const,
  result: (examId: number) => ["student", "exams", "result", examId] as const,
  resultItems: (examId: number) => ["student", "exams", "result", "items", examId] as const,
  gradesRoot: studentQueryKeys.gradesRoot,
  dashboard: studentQueryKeys.dashboard,
};
