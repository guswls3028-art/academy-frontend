import type {
  AdminExamResultRow,
  QuestionStat,
} from "@admin/domains/results/types/results.types";

export type InsightTone = "positive" | "attention" | "critical" | "neutral";

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
  direction: { title: string; detail: string; tone: InsightTone };
  cutReview: { title: string; detail: string; tone: InsightTone };
  nextAction: { title: string; detail: string; tone: InsightTone };
  distribution: Array<{
    label: string;
    rawRange: string;
    count: number;
    ratio: number;
  }>;
  priorityQuestions: Array<
    QuestionStat & {
      accuracyPercent: number;
      priority: string;
      action: string;
      tone: InsightTone;
    }
  >;
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

function questionRecommendation(accuracy: number) {
  if (accuracy < 0.3) {
    return { priority: "최우선", action: "공통 개념 재설명", tone: "critical" as const };
  }
  if (accuracy < 0.5) {
    return { priority: "우선", action: "풀이 시범 후 재시험", tone: "attention" as const };
  }
  if (accuracy < 0.7) {
    return { priority: "보충", action: "유사 문항 추가", tone: "neutral" as const };
  }
  return { priority: "확인", action: "개별 오답 확인", tone: "positive" as const };
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
  const hasUnconfiguredPassCriteria = criterionRows.length < scoredRows.length;
  const uniquePassCriteria = new Set(passCriteria);
  const passCriterionLabel = uniquePassCriteria.size > 1
    ? "강의별 기준"
    : `${passCriteria[0] ?? passScore}점 기준`;
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

  const priorityQuestions = [...questionStats]
    .sort((left, right) => (
      left.accuracy - right.accuracy
      || right.attempts - left.attempts
      || left.question_number - right.question_number
    ))
    .map((question) => ({
      ...question,
      accuracyPercent: question.accuracy * 100,
      ...questionRecommendation(question.accuracy),
    }));
  const weakQuestions = priorityQuestions.filter((question) => question.accuracy < 0.5);
  const criticalQuestions = priorityQuestions.filter((question) => question.accuracy < 0.3);

  let direction: ExamResultsInsightModel["direction"];
  if (scores.length < 5) {
    direction = {
      title: "표본 확인 후 판단",
      detail: "응시 인원이 5명 미만입니다. 개인 결과를 함께 보고 수업 방향을 확정하세요.",
      tone: "neutral",
    };
  } else if ((hasPassCriterion && passRate < 0.4) || criticalQuestions.length >= 2) {
    direction = {
      title: "전체 재설명 우선",
      detail: "미달 비율 또는 최저 정답률 문항이 높아 공통 개념부터 다시 설명하는 편이 안전합니다.",
      tone: "critical",
    };
  } else if (stdRate >= 20) {
    direction = {
      title: "수준별 보충 권장",
      detail: "점수 편차가 큽니다. 공통 설명 뒤 난이도를 나눠 재풀이하는 편이 효율적입니다.",
      tone: "attention",
    };
  } else if (weakQuestions.length > 0) {
    direction = {
      title: "취약 문항 재풀이",
      detail: "전체 흐름은 유지하고 정답률 50% 미만 문항을 중심으로 보충하세요.",
      tone: "attention",
    };
  } else {
    direction = {
      title: "현재 수업 흐름 유지",
      detail: "합격률과 문항 정답률이 안정적입니다. 개인 오답 확인 중심으로 마무리할 수 있습니다.",
      tone: "positive",
    };
  }

  const failRate = scores.length > 0 ? 1 - passRate : 0;
  let cutReview: ExamResultsInsightModel["cutReview"];
  if (!hasPassCriterion) {
    cutReview = {
      title: "합격 기준 설정 필요",
      detail: "합격 컷이 설정되지 않아 합격·미달 인원을 계산하지 않았습니다. 시험 설정에서 기준 점수를 먼저 확인하세요.",
      tone: "attention",
    };
  } else if (hasUnconfiguredPassCriteria) {
    cutReview = {
      title: "일부 강의 기준 설정 필요",
      detail: `귀가 기준이 없는 ${scoredRows.length - criterionRows.length}명은 합격률에서 제외했습니다. 강의별 기준을 먼저 확인하세요.`,
      tone: "attention",
    };
  } else if (scores.length < 5) {
    cutReview = {
      title: "컷 판단 보류",
      detail: `현재 ${passCriterionLabel}을 유지하고 표본이 쌓인 뒤 검토하세요.`,
      tone: "neutral",
    };
  } else if (failRate >= 0.6) {
    cutReview = {
      title: "난이도·문항 오류 먼저 확인",
      detail: `현재 컷에서 ${failCount}명이 미달입니다. 컷 변경 전 시험 난이도와 문항 오류를 확인하세요.`,
      tone: "critical",
    };
  } else if (failRate <= 0.1) {
    cutReview = {
      title: "유지 또는 다음 시험 상향 검토",
      detail: "미달 비율이 10% 이하입니다. 수업 목표에 따라 다음 시험부터 조정할 수 있습니다.",
      tone: "positive",
    };
  } else {
    cutReview = {
      title: "현재 컷으로 운영 가능",
      detail: `이번 시험은 현 기준으로 ${failCount}명의 보충 대상을 운영하세요.`,
      tone: "neutral",
    };
  }

  const actionTargets = (criticalQuestions.length > 0 ? criticalQuestions : weakQuestions).slice(0, 3);
  const nextAction = actionTargets.length > 0
    ? {
        title: `${actionTargets.map((question) => `${question.question_number}번`).join(" · ")} 재풀이`,
        detail: criticalQuestions.length > 0
          ? "개념 확인 → 대표 풀이 → 유사 문항 순서로 공통 보충하세요."
          : "정답률이 낮은 순서입니다. 학생별 오답표와 함께 대상자를 나누세요.",
        tone: criticalQuestions.length > 0 ? "critical" as const : "attention" as const,
      }
    : {
        title: "학생별 오답 확인",
        detail: "공통 취약 문항이 뚜렷하지 않습니다. 개인 오답과 복습 지정 문항을 확인하세요.",
        tone: "positive" as const,
      };

  const distribution = DISTRIBUTION_BANDS.map((band) => {
    const count = scoreRates.filter((rate) => (
      (band.lower === 0 ? rate >= band.lower : rate > band.lower)
      && rate <= band.upper
    )).length;
    return {
      label: band.label,
      rawRange: `${band.lower === 0 ? "" : ">"}${(safeMaxScore * band.lower / 100).toFixed(0)}–${(safeMaxScore * band.upper / 100).toFixed(0)}점`,
      count,
      ratio: scores.length > 0 ? count / scores.length : 0,
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
    direction,
    cutReview,
    nextAction,
    distribution,
    priorityQuestions,
  };
}
