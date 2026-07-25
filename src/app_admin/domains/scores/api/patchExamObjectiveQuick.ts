/**
 * Exam Objective Score Quick Patch API
 * 객관식 점수만 입력. total_score = objective_score + sum(ResultItem) 로 서버 동기화.
 */

import api from "@/shared/api/axios";
import { scoreEditorRequestHeaders } from "./scoreDraft";

export async function patchExamObjectiveScoreQuick(params: {
  sessionId: number;
  examId: number;
  enrollmentId: number;
  score: number;
}) {
  const res = await api.patch(
    `/results/admin/exams/${params.examId}/enrollments/${params.enrollmentId}/objective/`,
    { score: params.score },
    {
      headers: {
        ...await scoreEditorRequestHeaders(),
        "X-Score-Session-Id": String(params.sessionId),
      },
    },
  );
  return res.data;
}
