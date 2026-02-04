// PATH: src/features/exams/api/answerKeyApi.ts
import { api } from "@/shared/api";

export interface AnswerKey {
  id: number;
  exam: number; // template exam id
  answers: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export async function fetchAnswerKeyByExam(examId: number) {
  // backend: AnswerKeyViewSet.get_queryset() uses ?exam=<id> and resolves template
  return api.get<AnswerKey[]>(`/exams/answer-keys/`, { params: { exam: examId } });
}

export async function createAnswerKey(payload: { exam: number; answers: Record<string, string> }) {
  return api.post<AnswerKey>(`/exams/answer-keys/`, payload);
}

export async function updateAnswerKey(id: number, payload: { answers: Record<string, string> }) {
  return api.put<AnswerKey>(`/exams/answer-keys/${id}/`, payload);
}
