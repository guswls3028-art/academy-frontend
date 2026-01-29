// PATH: src/features/scores/api/patchItemScore.ts
/**
 * Subjective item score patch (Results 도메인 단일 계약)
 * - optimistic update 금지
 */

import api from "@/shared/api/axios";

export async function patchExamItemScore(params: {
  examId: number;
  enrollmentId: number;
  questionId: number;
  score: number;
}) {
  const { examId, enrollmentId, questionId, score } = params;

  const res = await api.patch(
    `/results/admin/exams/${examId}/enrollments/${enrollmentId}/items/${questionId}/`,
    { score }
  );

  return res.data;
}
