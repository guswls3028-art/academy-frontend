/**
 * PATH: src/features/results/api/adminExamItemScore.ts
 *
 * ✅ Admin Subjective Item Score API
 *
 * 책임:
 * - 주관식 문항 점수 단위 PATCH
 *
 * ❗ 규칙:
 * - 성공/실패 여부만 판단
 * - 결과 상태는 반드시 detail 재조회로 확인
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
