// PATH: src/features/scores/api/reorderSession.ts
import api from "@/shared/api/axios";

/**
 * POST /results/admin/sessions/{sessionId}/reorder/
 * 성적탭 시험/과제 표시 순서 변경
 */
export async function reorderSession(
  sessionId: number,
  order: { exams?: number[]; homeworks?: number[] },
) {
  const res = await api.post(
    `/results/admin/sessions/${sessionId}/reorder/`,
    order,
  );
  return res.data;
}
