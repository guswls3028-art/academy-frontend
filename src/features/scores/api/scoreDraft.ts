// PATH: src/features/scores/api/scoreDraft.ts
/**
 * Score edit draft API — 임시 저장/복원. 최종 반영은 "편집 종료" 시 patch API로만 수행.
 */

import api from "@/shared/api/axios";

export type PendingChange =
  | { type: "examTotal"; examId: number; enrollmentId: number; score: number; maxScore?: number }
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
