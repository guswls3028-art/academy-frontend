import type {
  AdminExamResultRow,
  QuestionStat,
} from "@admin/domains/results/types/results.types";

export type ExamResultsInsightModel = {
  scoredCount: number;
  unscoredCount: number;
  average: number;
  median: number;
  stdDev: number;
  stdRate: number;
  topTenAverage: number;
  highest: number;
  hasPassCriterion: boolean;
  passCriterionCount: number;
  passCount: number;
  failCount: number;
  passRate: number;
  remediatedCount: number;
  distribution: Array<{
    label: string;
    count: number;
  }>;
  questionAccuracy: Array<QuestionStat & { accuracyPercent: number }>;
};

const DISTRIBUTION_BANDS = [
  { lower: 0, upper: 20, label: "0–20%" },
  { lower: 20, upper: 40, label: ">20–40%" },
  { lower: 40, upper: 60, label: ">40–60%" },
  { lower: 60, upper: 80, label: ">60–80%" },
  { lower: 80, upper: 100, label: ">80–100%" },
] as const;

function mean(values: number[]): number {
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function populationStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function topTenAverage(values: number[]): number {
  if (values.length === 0) return 0;
  const count = Math.max(1, Math.ceil(values.length * 0.1));
  return mean([...values].sort((left, right) => right - left).slice(0, count));
}

export function buildExamResultsInsightModel({
  results,
  questionStats,
  maxScore,
  passScore,
}: {
  results: AdminExamResultRow[];
  questionStats: QuestionStat[];
  maxScore: number;
  passScore: number;
}): ExamResultsInsightModel {
  const safeMaxScore = Number.isFinite(maxScore) && maxScore > 0 ? maxScore : 100;
  const scoredRows = results.flatMap((row) => {
    if (row.result_status != null && row.result_status !== "DONE") return [];
    const score = typeof row.ranking_score === "number"
      ? row.ranking_score
      : row.final_score;
    return typeof score === "number" && Number.isFinite(score)
      ? [{ row, score }]
      : [];
  });
  const scores = scoredRows.map(({ score }) => score);
  const scoreRates = scores.map((score) => Math.min(100, Math.max(0, (score / safeMaxScore) * 100)));
  const passCriteria = scoredRows.map(({ row }) => (
    typeof row.pass_score === "number" && Number.isFinite(row.pass_score)
      ? row.pass_score
      : passScore
  ));
  const criterionRows = scoredRows.flatMap((scoredRow, index) => {
    const criterion = passCriteria[index];
    return Number.isFinite(criterion) && criterion > 0
      ? [{ ...scoredRow, criterion }]
      : [];
  });
  const hasPassCriterion = criterionRows.length > 0;
  const passCount = hasPassCriterion
    ? criterionRows.filter(({ row, score, criterion }) => (
      row.passed === true
      || (row.passed == null && score >= criterion)
    )).length
    : 0;
  const failCount = hasPassCriterion ? Math.max(criterionRows.length - passCount, 0) : 0;
  const passRate = hasPassCriterion ? passCount / criterionRows.length : 0;
  const remediatedCount = scoredRows.filter(({ row }) => row.remediated === true).length;
  const stdRate = populationStdDev(scoreRates);

  const questionAccuracy = [...questionStats]
    .sort((left, right) => (
      left.accuracy - right.accuracy
      || right.attempts - left.attempts
      || left.question_number - right.question_number
    ))
    .map((question) => ({
      ...question,
      accuracyPercent: question.accuracy * 100,
    }));
  const distribution = DISTRIBUTION_BANDS.map((band) => {
    const count = scoreRates.filter((rate) => (
      (band.lower === 0 ? rate >= band.lower : rate > band.lower)
      && rate <= band.upper
    )).length;
    return {
      label: band.label,
      count,
    };
  });

  return {
    scoredCount: scores.length,
    unscoredCount: Math.max(results.length - scores.length, 0),
    average: mean(scores),
    median: median(scores),
    stdDev: populationStdDev(scores),
    stdRate,
    topTenAverage: topTenAverage(scores),
    highest: scores.length > 0 ? Math.max(...scores) : 0,
    hasPassCriterion,
    passCriterionCount: criterionRows.length,
    passCount,
    failCount,
    passRate,
    remediatedCount,
    distribution,
    questionAccuracy,
  };
}
