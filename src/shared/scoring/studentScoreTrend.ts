import type { StudentExamTrendPoint } from "@/shared/api/contracts/studentGrades";

export const ALL_LECTURES = "all" as const;
export type StudentScoreLectureFilter = typeof ALL_LECTURES | number;
export type StudentScoreTrendMetric = "score_pct" | "rank" | "percentile";

export type StudentScoreTrendDisplayPoint = StudentExamTrendPoint & {
  display_round_index: number;
  round_label: string;
  metric_value?: number;
};

export type StudentScoreTrendMetrics = {
  count: number;
  average: number | null;
  latest: number | null;
  best: number | null;
  change: number | null;
  firstToLatest: number | null;
};

export function studentScoreTrendMetricValue(
  point: StudentExamTrendPoint,
  metric: StudentScoreTrendMetric,
): number | null {
  if (metric === "score_pct") return Number.isFinite(point.score_pct) ? point.score_pct : null;
  if (point.cohort_size == null || point.cohort_size <= 1) return null;
  const value = metric === "rank" ? point.rank : point.percentile;
  return value != null && Number.isFinite(value) ? value : null;
}

export function filterStudentScoreTrend(
  points: StudentExamTrendPoint[],
  lectureFilter: StudentScoreLectureFilter,
): StudentScoreTrendDisplayPoint[] {
  const filtered = lectureFilter === ALL_LECTURES
    ? points
    : points.filter((point) => point.lecture_id === lectureFilter);
  return filtered.map((point, index) => ({
    ...point,
    display_round_index: index + 1,
    round_label: `${index + 1}회차`,
  }));
}

export function summarizeStudentScoreTrend(
  points: StudentScoreTrendDisplayPoint[],
  metric: StudentScoreTrendMetric = "score_pct",
): StudentScoreTrendMetrics {
  const values = points
    .map((point) => studentScoreTrendMetricValue(point, metric))
    .filter((value): value is number => value != null);
  if (values.length === 0) {
    return { count: 0, average: null, latest: null, best: null, change: null, firstToLatest: null };
  }
  const latest = values[values.length - 1];
  const previous = values.length > 1 ? values[values.length - 2] : null;
  return {
    count: values.length,
    average: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10,
    latest,
    best: metric === "score_pct" ? Math.max(...values) : Math.min(...values),
    change: previous == null ? null : Math.round((latest - previous) * 10) / 10,
    firstToLatest: values.length < 2 ? null : Math.round((latest - values[0]) * 10) / 10,
  };
}
