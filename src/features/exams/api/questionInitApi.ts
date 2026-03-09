import api from "@/shared/api/axios";
import type { ExamQuestion } from "./questionApi";

export function initExamQuestions(params: {
  examId: number;
  total_questions: number;
  default_score?: number;
}) {
  return api.post<ExamQuestion[]>(
    `/exams/${params.examId}/questions/init/`,
    {
      total_questions: params.total_questions,
      default_score: params.default_score,
    }
  );
}

