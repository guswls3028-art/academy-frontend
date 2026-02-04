// PATH: src/features/exams/api/questionApi.ts
import { api } from "@/shared/api";

export interface ExamQuestion {
  id: number;
  sheet: number;
  number: number;
  score: number;
  image?: string;
  region_meta?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export function fetchQuestionsByExam(examId: number) {
  return api.get<ExamQuestion[]>(`/exams/${examId}/questions/`);
}
