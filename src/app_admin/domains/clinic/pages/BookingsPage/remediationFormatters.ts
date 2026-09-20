import type { CSSProperties } from "react";
import type { ClinicTarget } from "../../api/clinicTargets";

export function formatNextAttempt(latestIndex?: number): string {
  const next = (latestIndex ?? 1) + 1;
  return `${next}차`;
}

export function formatScoreDisplay(item: ClinicTarget): string {
  const score = getScoreValueLabel(item);
  if (score === "-" || item.reason === "missing") return score;
  return `${score} / 기준 ${getCutlineLabel(item)}`;
}

export function getScoreValueLabel(item: ClinicTarget): string {
  if (item.reason === "missing") {
    return item.source_type === "homework" ? "미제출" : "미응시";
  }
  const score = item.source_type === "homework" ? item.homework_score : item.exam_score;
  if (score == null) return "-";
  return `${score}점`;
}

export function getCutlineLabel(item: ClinicTarget): string {
  if (
    item.source_type === "homework" &&
    item.homework_cutline_mode === "PERCENT" &&
    item.homework_cutline_value != null
  ) {
    return `${item.homework_cutline_value}%`;
  }
  const cutline = item.source_type === "homework"
    ? item.homework_cutline
    : item.cutline_score;
  return cutline == null ? "-" : `${cutline}점`;
}

export const REASON_LABEL: Record<string, string> = {
  score: "불합격",
  confidence: "신뢰도 낮음",
  missing: "미응시·미제출",
};

const REASON_COLOR: Record<string, string> = {
  score: "var(--color-error)",
  confidence: "var(--color-info, #3b82f6)",
  missing: "var(--color-warning, #f59e0b)",
};

export function reasonBorderStyle(reason: string | null | undefined): CSSProperties {
  return { borderColor: REASON_COLOR[reason ?? "score"] };
}

export function reasonColorStyle(reason: string | null | undefined): CSSProperties {
  return { color: REASON_COLOR[reason ?? "score"] };
}

export function indicatorStyle(reason: string | null | undefined, isResolved: boolean): CSSProperties {
  return {
    backgroundColor: isResolved ? "var(--color-success)" : REASON_COLOR[reason ?? "score"],
  };
}

export function formatReasonLabel(item: ClinicTarget): string {
  if (item.reason === "missing") {
    return item.source_type === "homework" ? "미제출" : "미응시";
  }
  return REASON_LABEL[item.reason ?? "score"];
}

const RESOLUTION_LABEL: Record<string, string> = {
  EXAM_PASS: "시험 통과", HOMEWORK_PASS: "과제 통과", MANUAL_OVERRIDE: "수동 통과",
  WAIVED: "면제", CARRIED_OVER: "다음 차수 이월", SOURCE_REMOVED: "원본 항목 삭제",
};
export const resolutionLabel = (item: ClinicTarget) => RESOLUTION_LABEL[item.resolution_type ?? ""] ?? "해결 완료";
