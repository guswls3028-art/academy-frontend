// 여러 차시(주차)의 성적을 묶어 순위를 계산한다.
// 점수 원본은 서버가 차시별로 계산한 exam_total / homework_total 이다.
// (보류·임시·결시 점수는 서버 합계에서 이미 제외되어 0점으로 섞이지 않는다.)

import type {
  AssessmentTotal,
  SessionScoreRow,
  SessionScoresResponse,
} from "@/shared/api/contracts/sessionScores";

export type RankingScope = "all" | "exam" | "homework";

export const RANKING_SCOPE_LABEL: Record<RankingScope, string> = {
  all: "종합",
  exam: "시험",
  homework: "과제",
};

export type PeriodRankingEntry = {
  enrollmentId: number;
  studentName: string;
  lectureChipLabel: string | null;
  lectureColor: string | null;
  score: number;
  maxScore: number;
  /** 반영된 평가 중 점수가 확정된 수 */
  scoredCount: number;
  /** 이 학생에게 배정된 반영 대상 평가 수 */
  selectedCount: number;
  /** 점수가 확정된 평가가 하나도 없으면 null (순위 제외) */
  rank: number | null;
};

function totalsForScope(row: SessionScoreRow, scope: RankingScope): AssessmentTotal[] {
  const totals: Array<AssessmentTotal | undefined> =
    scope === "exam"
      ? [row.exam_total]
      : scope === "homework"
        ? [row.homework_total]
        : [row.exam_total, row.homework_total];
  return totals.filter((total): total is AssessmentTotal => total != null);
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildPeriodRanking(
  responses: SessionScoresResponse[],
  scope: RankingScope,
): PeriodRankingEntry[] {
  const byEnrollment = new Map<number, PeriodRankingEntry>();
  for (const response of responses) {
    for (const row of response.rows ?? []) {
      const totals = totalsForScope(row, scope);
      const selected = totals.reduce((sum, total) => sum + (total.selected_count || 0), 0);
      if (selected <= 0) continue;
      const current = byEnrollment.get(row.enrollment_id) ?? {
        enrollmentId: row.enrollment_id,
        studentName: row.student_name,
        lectureChipLabel: row.lecture_chip_label ?? null,
        lectureColor: row.lecture_color ?? null,
        score: 0,
        maxScore: 0,
        scoredCount: 0,
        selectedCount: 0,
        rank: null,
      };
      for (const total of totals) {
        current.score += Number.isFinite(total.score) ? Number(total.score) : 0;
        current.maxScore += Number.isFinite(total.max_score) ? Number(total.max_score) : 0;
        current.scoredCount += total.scored_count || 0;
        current.selectedCount += total.selected_count || 0;
      }
      // 가장 최근 차시의 이름 표기를 사용한다.
      current.studentName = row.student_name || current.studentName;
      byEnrollment.set(row.enrollment_id, current);
    }
  }

  const entries = [...byEnrollment.values()].map((entry) => ({
    ...entry,
    score: roundScore(entry.score),
    maxScore: roundScore(entry.maxScore),
  }));
  const ranked = entries
    .filter((entry) => entry.scoredCount > 0)
    .sort((a, b) => b.score - a.score || a.studentName.localeCompare(b.studentName, "ko") || a.enrollmentId - b.enrollmentId);
  // 표준 공동 순위(1, 2, 2, 4): 서버 석차와 같은 규칙.
  let previousScore: number | null = null;
  let previousRank = 0;
  ranked.forEach((entry, index) => {
    entry.rank = previousScore !== null && entry.score === previousScore ? previousRank : index + 1;
    previousScore = entry.score;
    previousRank = entry.rank;
  });
  const unranked = entries
    .filter((entry) => entry.scoredCount === 0)
    .sort((a, b) => a.studentName.localeCompare(b.studentName, "ko") || a.enrollmentId - b.enrollmentId);
  return [...ranked, ...unranked];
}

/** 공동 순위를 포함해 상위 N등까지 (예: 3등까지 → 공동 3등 모두 포함) */
export function topRanked(entries: PeriodRankingEntry[], limit: number): PeriodRankingEntry[] {
  return entries.filter((entry) => entry.rank != null && entry.rank <= limit);
}

export function formatRankingScore(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
