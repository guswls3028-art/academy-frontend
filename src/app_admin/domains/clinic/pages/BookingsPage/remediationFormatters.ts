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
