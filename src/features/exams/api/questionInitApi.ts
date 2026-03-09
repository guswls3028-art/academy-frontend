import api from "@/shared/api/axios";
import type { ExamQuestion } from "./questionApi";

export type InitExamQuestionsParams =
  | {
      examId: number;
      total_questions: number;
      default_score?: number;
    }
  | {
      examId: number;
      choice_count: number;
      choice_score: number;
      essay_count: number;
      essay_score: number;
    };

export function initExamQuestions(params: InitExamQuestionsParams) {
  const body =
    "total_questions" in params
      ? {
          total_questions: params.total_questions,
          default_score: params.default_score,
        }
      : {
          choice_count: params.choice_count,
          choice_score: params.choice_score,
          essay_count: params.essay_count,
          essay_score: params.essay_score,
        };
  return api.post<ExamQuestion[]>(
    `/exams/${params.examId}/questions/init/`,
    body
  );
}

