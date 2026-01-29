// PATH: src/features/sessions/api/sessionScoreSummary.ts

import api from "@/shared/api/axios";

export type ScoreGroupSummary = {
  count: number;
  avg: number;
  min?: number;
  max?: number;
  pass_count?: number;
};

export type SessionScoreSummary = {
  total: ScoreGroupSummary;
  offline: ScoreGroupSummary;
  online: ScoreGroupSummary;
};

/**
 * ✅ 세션 성적 통계 요약
 * - 온라인/오프라인 분리
 * - 모든 계산은 backend 기준
 */
export async function fetchSessionScoreSummary(
  sessionId: number
): Promise<SessionScoreSummary> {
  const res = await api.get(
    `/sessions/${sessionId}/score-summary/`
  );
  return res.data;
}
