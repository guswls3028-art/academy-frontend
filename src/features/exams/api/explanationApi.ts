// PATH: src/features/exams/api/explanationApi.ts
// 문항 해설 API

import api from "@/shared/api/axios";

export interface QuestionExplanation {
  id: number;
  question: number;
  text: string;
  image_key: string;
  image_url: string | null;
  source: "ai_extracted" | "manual";
  match_confidence: number | null;
  created_at: string;
  updated_at: string;
}

export interface BulkExplanationItem {
  question_id: number;
  text: string;
  image_key?: string;
}

/** 시험 문항 해설 전체 조회 */
export async function fetchExplanations(examId: number): Promise<QuestionExplanation[]> {
  const resp = await api.get<QuestionExplanation[]>(`/exams/${examId}/explanations/`);
  return resp.data;
}

/** 해설 일괄 저장 */
export async function saveExplanationsBulk(
  examId: number,
  explanations: BulkExplanationItem[],
): Promise<QuestionExplanation[]> {
  const resp = await api.post<QuestionExplanation[]>(
    `/exams/${examId}/explanations/bulk/`,
    { explanations },
  );
  return resp.data;
}

/** 단일 문항 해설 조회 */
export async function fetchQuestionExplanation(questionId: number): Promise<QuestionExplanation> {
  const resp = await api.get<QuestionExplanation>(`/exams/questions/${questionId}/explanation/`);
  return resp.data;
}

/** 단일 문항 해설 저장 */
export async function saveQuestionExplanation(
  questionId: number,
  data: { text: string; image_key?: string },
): Promise<QuestionExplanation> {
  const resp = await api.put<QuestionExplanation>(
    `/exams/questions/${questionId}/explanation/`,
    data,
  );
  return resp.data;
}
