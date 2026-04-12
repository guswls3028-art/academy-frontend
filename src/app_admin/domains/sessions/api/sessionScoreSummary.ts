// PATH: src/app_admin/domains/sessions/api/sessionScoreSummary.ts

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
 * - 백엔드 SSOT: GET /api/v1/results/admin/sessions/<session_id>/score-summary/
 * - 응답은 participant_count, avg_score, min_score, max_score, pass_rate, clinic_rate, attempt_stats (flat)
 * - UI는 total/offline/online 그룹을 사용하므로 여기서 매핑 (오프라인/온라인 분리는 백엔드 미제공 시 동일 값)
 */
export async function fetchSessionScoreSummary(
  sessionId: number
): Promise<SessionScoreSummary> {
  const res = await api.get(
    `/results/admin/sessions/${sessionId}/score-summary/`
  );
  const d = res.data as {
    participant_count: number;
    avg_score: number;
    min_score: number;
    max_score: number;
    pass_rate: number;
    clinic_rate: number;
    attempt_stats?: { avg_attempts: number; retake_ratio: number };
  };
  const count = Number(d.participant_count) || 0;
  const passCount = Math.round(count * (Number(d.pass_rate) || 0));
  const group: ScoreGroupSummary = {
    count,
    avg: Number(d.avg_score) ?? 0,
    min: Number(d.min_score),
    max: Number(d.max_score),
    pass_count: passCount,
  };
  return {
    total: group,
    offline: group,
    online: count === 0 ? group : { count: 0, avg: 0, min: 0, max: 0, pass_count: 0 },
  };
}
