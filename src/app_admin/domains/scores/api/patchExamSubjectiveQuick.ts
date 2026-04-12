/**
 * Exam Subjective Score Quick Patch API
 * 주관식 점수(합계)만 입력. total_score = objective_score + subjective_score 로 서버 동기화.
 */

import api from "@/shared/api/axios";

export async function patchExamSubjectiveScoreQuick(params: {
  examId: number;
  enrollmentId: number;
  score: number;
}) {
  const res = await api.patch(
    `/results/admin/exams/${params.examId}/enrollments/${params.enrollmentId}/subjective/`,
    { score: params.score }
  );
  return res.data;
}
