// PATH: src/app_admin/domains/scores/api/patchItemScore.ts
/**
 * Subjective item score patch (Results 도메인 단일 계약)
 * - optimistic update 금지
 */

import api from "@/shared/api/axios";
import { scoreEditorRequestHeaders } from "./scoreDraft";

export async function patchExamItemScore(params: {
  sessionId: number;
  examId: number;
  enrollmentId: number;
  questionId: number;
  score: number;
  answer?: string;
}) {
  const { sessionId, examId, enrollmentId, questionId, score, answer } = params;

  const payload: Record<string, unknown> = { score };
  if (answer !== undefined) payload.answer = answer;

  const res = await api.patch(
    `/results/admin/exams/${examId}/enrollments/${enrollmentId}/items/${questionId}/`,
    payload,
    {
      headers: {
        ...await scoreEditorRequestHeaders(),
        "X-Score-Session-Id": String(sessionId),
      },
    },
  );

  return res.data;
}
