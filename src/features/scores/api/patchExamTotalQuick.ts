/**
 * Exam Total Score Quick Patch API
 *
 * ✅ 목적
 * - 성적 탭에서 "합산 점수"를 바로 입력할 수 있도록 total_score를 수동으로 수정
 * - 서버가 pass/fail/클리닉 계산을 이어서 수행할 수 있도록 results 도메인 엔드포인트를 사용
 *
 * ⚠️ 주의
 * - 문항별(ResultItem) 합과 total_score가 불일치할 수 있음 (모드 전환 시 사용자가 선택)
 */

import api from "@/shared/api/axios";

export async function patchExamTotalScoreQuick(params: {
  examId: number;
  enrollmentId: number;
  score: number;
  maxScore?: number | null;
}) {
  const res = await api.patch(
    `/results/admin/exams/${params.examId}/enrollments/${params.enrollmentId}/score/`,
    {
      score: params.score,
      max_score: params.maxScore ?? null,
    }
  );
  return res.data;
}

