// PATH: src/features/scores/api/patchHomeworkQuick.ts
/**
 * Homework Quick Patch API
 *
 * ✅ LOCKED SPEC
 * - PATCH /homework/scores/quick/
 * - 프론트는 계산/판정 금지 → 서버 결과만 신뢰
 */

import api from "@/shared/api/axios";

export async function patchHomeworkQuick(params: {
  sessionId: number;
  enrollmentId: number;
  homeworkId: number;
  score: number;
  maxScore?: number | null;
}) {
  const res = await api.patch("/homework/scores/quick/", {
    session_id: params.sessionId,
    enrollment_id: params.enrollmentId,
    homework_id: params.homeworkId,
    score: params.score,
    max_score: params.maxScore ?? null,
  });

  return res.data;
}
