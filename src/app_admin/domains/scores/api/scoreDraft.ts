// PATH: src/app_admin/domains/scores/api/scoreDraft.ts
/**
 * Score edit recovery API.
 * 실제 성적 PATCH 전에 복구용 변경 목록을 저장하고, PATCH 완료 뒤 commit으로 비운다.
 */

import api from "@/shared/api/axios";
import {
  scoreEditorRequestHeaders,
} from "@/shared/scoring/scoreEditLease";

export {
  resolvedScoreEditorClientId,
  resolvedScoreEditorRecoveryId,
  scoreEditorRequestHeaders,
} from "@/shared/scoring/scoreEditLease";

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

export type ScoreActiveCell = {
  type: "homework";
  enrollmentId: number;
  homeworkId: number;
};

export type ScoreActiveEditor = {
  client_id: string;
  editor_user_id: number;
  editor_name: string;
  active_cell: ScoreActiveCell;
};

export type ScoreDraftSnapshot = {
  changes: PendingChange[];
  stale?: boolean;
  active_editors: ScoreActiveEditor[];
};

export async function getScoreDraft(
  sessionId: number,
): Promise<ScoreDraftSnapshot> {
  const res = await api.get(`/results/admin/sessions/${sessionId}/score-draft/`, {
    headers: await scoreEditorRequestHeaders(),
  });
  const data = res.data as Partial<ScoreDraftSnapshot>;
  return {
    changes: data.changes ?? [],
    stale: data.stale,
    active_editors: data.active_editors ?? [],
  };
}

export async function putScoreDraft(
  sessionId: number,
  changes: PendingChange[],
  options?: { acknowledgeStale?: boolean; activeCell?: ScoreActiveCell | null },
): Promise<ScoreDraftSnapshot> {
  const res = await api.put(`/results/admin/sessions/${sessionId}/score-draft/`, {
    changes,
    acknowledge_stale: options?.acknowledgeStale ?? false,
    active_cell: options?.activeCell ?? null,
  }, {
    headers: await scoreEditorRequestHeaders(),
  });
  const data = res.data as Partial<ScoreDraftSnapshot>;
  return {
    changes: data.changes ?? [],
    stale: data.stale,
    active_editors: data.active_editors ?? [],
  };
}

export async function postScoreDraftCommit(
  sessionId: number,
  releaseLease = false,
): Promise<void> {
  await api.post(
    `/results/admin/sessions/${sessionId}/score-draft/commit/`,
    { release_lease: releaseLease },
    { headers: await scoreEditorRequestHeaders() },
  );
}

export function isScoreEditLockedError(error: unknown): boolean {
  const response = (error as {
    response?: { status?: number; data?: { code?: string } };
  } | null)?.response;
  return response?.status === 409 && response.data?.code === "SCORE_EDIT_LOCKED";
}

export function isScoreEditStaleError(error: unknown): boolean {
  const response = (error as {
    response?: { status?: number; data?: { code?: string } };
  } | null)?.response;
  return response?.status === 409 && response.data?.code === "SCORE_EDIT_STALE";
}
