// PATH: src/features/scores/api/patchHomeworkQuick.ts
/**
 * Homework Quick Patch API
 *
 * ✅ LOCKED SPEC
 * - PATCH /homework/scores/quick/
 * - 프론트는 계산/판정 금지 → 서버 결과만 신뢰
 *
 * ✅ 확장(최소):
 * - meta_status: "NOT_SUBMITTED" | null (미제출 저장/해제)
 * - score: number | null (미입력/미제출을 위해 null 허용)
 */

import api from "@/shared/api/axios";

export type HomeworkMetaStatus = "NOT_SUBMITTED";

export async function patchHomeworkQuick(params: {
  sessionId: number;
  enrollmentId: number;
  homeworkId: number;

  // ✅ 확장: null 허용
  score: number | null;

  maxScore?: number | null;

  // ✅ 확장: 미제출 저장/해제
  metaStatus?: HomeworkMetaStatus | null;
}) {
  const res = await api.patch("/homework/scores/quick/", {
    session_id: params.sessionId,
    enrollment_id: params.enrollmentId,
    homework_id: params.homeworkId,
    score: params.score,
    max_score: params.maxScore ?? null,
    meta_status: params.metaStatus ?? null,
  });

  return res.data;
}
