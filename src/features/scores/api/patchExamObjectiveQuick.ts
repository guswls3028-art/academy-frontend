/**
 * Exam Objective Score Quick Patch API
 * 객관식 점수만 입력. total_score = objective_score + sum(ResultItem) 로 서버 동기화.
 */

import api from "@/shared/api/axios";

export async function patchExamObjectiveScoreQuick(params: {
  examId: number;
  enrollmentId: number;
  score: number;
}) {
  const res = await api.patch(
    `/results/admin/exams/${params.examId}/enrollments/${params.enrollmentId}/objective/`,
    { score: params.score }
  );
  return res.data;
}
