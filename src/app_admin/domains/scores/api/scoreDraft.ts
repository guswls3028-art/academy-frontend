// PATH: src/app_admin/domains/scores/api/scoreDraft.ts
/**
 * Score edit recovery API.
 * 실제 성적 PATCH 전에 복구용 변경 목록을 저장하고, PATCH 완료 뒤 commit으로 비운다.
 */

import api from "@/shared/api/axios";

export type PendingChange =
  | { type: "examTotal"; examId: number; enrollmentId: number; score: number; maxScore?: number; metaStatus?: "NOT_SUBMITTED" }
  | { type: "examObjective"; examId: number; enrollmentId: number; score: number }
  | { type: "examSubjective"; examId: number; enrollmentId: number; score: number }
  | {
      type: "homework";
      enrollmentId: number;
      homeworkId: number;
      score: number | null;
      metaStatus?: "NOT_SUBMITTED";
    };

export async function getScoreDraft(sessionId: number): Promise<{ changes: PendingChange[] }> {
  const res = await api.get(`/results/admin/sessions/${sessionId}/score-draft/`);
  return res.data as { changes: PendingChange[] };
}

export async function putScoreDraft(
  sessionId: number,
  changes: PendingChange[]
): Promise<{ changes: PendingChange[] }> {
  const res = await api.put(`/results/admin/sessions/${sessionId}/score-draft/`, {
    changes,
  });
  return res.data as { changes: PendingChange[] };
}

export async function postScoreDraftCommit(sessionId: number): Promise<void> {
  await api.post(`/results/admin/sessions/${sessionId}/score-draft/commit/`);
}
